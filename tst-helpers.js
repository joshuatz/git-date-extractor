const childProc = require('child_process');
const fse = require('fs-extra');
const {replaceInObj, posixNormalize} = require('./src/helpers');
const os = require('os');
const {sep} = require('path');

/**
 * Test if the last commit in the log is from self (auto add of cache file)
 * @param {string} gitDir - Path where the commit was made
 * @param {string} cacheFileName - Filename (not path) of the cache file that was added
 * @returns {boolean} If commit was from self
 */
function wasLastCommitAutoAddCache(gitDir, cacheFileName) {
	try {
		const gitCommitMsg = childProc.execSync(`git show -s --format=%s`, {
			cwd: gitDir
		}).toString();
		const changedFiles = childProc.execSync(`git show HEAD --name-only --format=%b`, {
			cwd: gitDir
		}).toString().trim();
		const commitMsgMatch = /AUTO: Updated/.test(gitCommitMsg);
		const changedFilesMatch = changedFiles === cacheFileName;
		return commitMsgMatch && changedFilesMatch;
	// eslint-disable-next-line no-unused-vars
	} catch (error) {
		return false;
	}
}

/* istanbul ignore next */
/**
 * Log something to the console and (if configured) log file
 * @param {any} msg
 */
function iDebugLog(msg) {
	console.log(msg);
	if (typeof (msg) === 'object') {
		msg = JSON.stringify(msg);
	}
	msg = '\n' + msg;
	const debugLog = './debug.txt';
	fse.exists(debugLog, function(exists) {
		if (exists) {
			fse.writeFileSync(debugLog, msg, {
				flag: 'a'
			});
		}
	});
}

/**
 * Get list of test files paths to use (not created)
 * @param {string} dirPath - The full path dir where temp files should go
 */
function getTestFilePaths(dirPath) {
	dirPath = posixNormalize(dirPath);
	const subDirName = 'subdir';
	const dotDirName = '.dotdir';
	return {
		alpha: `${dirPath}/alpha.txt`,
		bravo: `${dirPath}/bravo.txt`,
		charlie: `${dirPath}/charlie.txt`,
		space: `${dirPath}/space test.png`,
		specialChars: `${dirPath}/special-chars.file.gif`,
		subdir: {
			delta: `${dirPath}/${subDirName}/delta.txt`,
			echo: `${dirPath}/${subDirName}/echo.txt`
		},
		[dotDirName]: {
			foxtrot: `${dirPath}/${dotDirName}/foxtrot.txt`
		}
	};
}

async function makeTempDir() {
	return fse.mkdtemp(`${os.tmpdir()}${sep}`);
}

/**
 * Build a local directory, filled with dummy files
 * @param {string} dirPath - Absolute path of where the directory should be created
 * @param {import('./src/types').DirListing} dirListing - Listing of files to create, using absolute paths
 * @param {boolean} [empty] - Clear the directory out first, before building files
 */
async function buildDir(dirPath, dirListing, empty = false) {
	await fse.ensureDir(dirPath);
	if (empty) {
		await fse.emptyDir(dirPath);
	}
	/**
	 * @param {string | import('./src/types').DirListing} pathOrObj
	 * @returns {Promise<any>}
	 */
	const recursingCreator = async (pathOrObj) => {
		if (typeof pathOrObj === 'string') {
			return fse.ensureFile(pathOrObj);
		}

		return Promise.all(Object.keys(pathOrObj).map(key => {
			const val = pathOrObj[key];
			return recursingCreator(val);
		}));
	};

	await recursingCreator(dirListing);
}

/**
 * Build a test dir based on inputs
 * @param {string} tempDirPath - The full path of the temp dir
 * @param {boolean} gitInit - if `git init` should be ran in dir
 * @param {string} [cacheFileName] - If cache file should be created, pass name
 */
async function buildTestDir(tempDirPath, gitInit, cacheFileName) {
	// Make sure tempDirPath does *not* end with slash
	tempDirPath = tempDirPath.replace(/[\/\\]+$/, '');
	const testFiles = getTestFilePaths(tempDirPath);

	// Some pre-formatted different versions of the test file paths
	const testFilesRelative = /** @type {ReturnType<typeof getTestFilePaths>} */ (replaceInObj(testFiles, filePath => {
		return posixNormalize(filePath).replace(posixNormalize(`${tempDirPath}/`), '');
	}));
	const testFilesNamesOnly = /** @type {ReturnType<typeof getTestFilePaths>} */ (replaceInObj(testFiles, filePath => {
		const filename = posixNormalize(filePath).replace(posixNormalize(tempDirPath), '');
		// Remove any beginning slashes, and posix normalize
		return posixNormalize(filename.replace(/^[\/\\]{1,2}/g, ''));
	}));

	// Actually build the files
	await buildDir(tempDirPath, testFiles);

	// Create empty cache file
	if (typeof (cacheFileName) === 'string') {
		fse.ensureFileSync(`${tempDirPath}/${cacheFileName}`);
	}

	/* istanbul ignore else */
	if (gitInit) {
		childProc.execSync(`git init`, {
			cwd: tempDirPath
		});
	}

	return {
		testFiles,
		testFilesRelative,
		testFilesNamesOnly,
		stamp: Math.floor((new Date()).getTime() / 1000)
	};
}

/**
 * Touch a file (change mtime and/or add text)
 * @param {string} filePath - File to "touch"
 * @param {boolean} byAppending - By appending text
 * @param {boolean} [OPT_useShell] - Use `touch` command
 * @returns {void}
 */
function touchFileSync(filePath, byAppending, OPT_useShell) {
	const useShell = typeof (OPT_useShell) === 'boolean' ? OPT_useShell : false;
	if (byAppending === true) {
		// Make sure to actually change file contents to trigger git
		fse.writeFileSync(filePath, 'TOUCHED', {
			flag: 'a'
		});
	}
	else if (useShell) {
		childProc.execSync(`touch ${filePath} -m`);
	}
	else {
		const now = new Date();
		try {
			fse.utimesSync(filePath, now, now);
		// eslint-disable-next-line no-unused-vars
		} catch (error) {
			fse.closeSync(fse.openSync(filePath, 'w'));
		}
	}
}

/**
 * Require that all input files have a corresponding stamp entry in results
 * @param {import('ava').ExecutionContext} testContext
 * @param {import('./src/types').DirListing} files - Input file list. Should be relative (or whatever matches `results` object keys format)
 * @param {import('./src/types').StampCache} results - Output results from scraper
 * @param {string[]} [skipFiles] Files to excludes from checking
 */
function testForStampInResults(testContext, files, results, skipFiles = []) {
	for (const key in files) {
		if (typeof files[key] === 'object') {
			/** @type {import('./src/types').DirListing} */
			const dirListing = (files[key]);
			testForStampInResults(testContext, dirListing, results, skipFiles);
		} else {
			/** @type {string} */
			const filePath = (files[key]);
			if (!skipFiles.includes(filePath)) {
				const stampEntry = results[filePath];
				const testMsg = JSON.stringify({
					filePath,
					skipFiles,
					stampEntry,
					results
				}, null, 4);
				testContext.true(typeof stampEntry === 'object', testMsg);
				testContext.true(typeof stampEntry.created === 'number', testMsg);
				testContext.true(typeof stampEntry.modified === 'number', testMsg);
			}
		}
	}
}

/** @param {number} delayMs */
const delay = (delayMs) => {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve();
		}, delayMs);
	});
};

module.exports = {
	wasLastCommitAutoAddCache,
	iDebugLog,
	buildTestDir,
	touchFileSync,
	getTestFilePaths,
	buildDir,
	testForStampInResults,
	makeTempDir,
	delay
};
