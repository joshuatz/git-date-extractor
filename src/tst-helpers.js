// @ts-check
const childProc = require('child_process');
const path = require('path');
const fse = require('fs-extra');
const {replaceInObj, projectRootPathTrailingSlash, posixNormalize} = require('./helpers');

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

/**
 * Build a local directory, filled with dummy files
 * @param {string} dirPath - Absolute path of where the directory should be created
 * @param {DirListing} dirListing - Listing of files to create, using absolute paths
 */
function buildDir(dirPath, dirListing) {
	/**
	 * Note: build operation must be done non-async, since
	 * file creation depends on dir creation
	 */
	fse.ensureDirSync(dirPath);
	fse.emptyDirSync(dirPath);
	for (const key in dirListing) {
		const val = dirListing[key];
		if (typeof val === 'string') {
			fse.ensureFileSync(val);
		} else {
			buildDir(`${dirPath}/${key}`, val);
		}
	}
}

/**
 * Build a test dir based on inputs
 * @param {string} tempDirPath - The full path of the temp dir
 * @param {boolean} gitInit - if `git init` should be ran in dir
 * @param {string} [cacheFileName] - If cache file should be created, pass name
 */
function buildTestDir(tempDirPath, gitInit, cacheFileName) {
	const testFiles = getTestFilePaths(tempDirPath);
	const testFilesRelative = replaceInObj(testFiles, filePath => {
		return path.normalize(filePath).replace(path.normalize(projectRootPathTrailingSlash), '');
	});
	const testFilesNamesOnly = replaceInObj(testFiles, filePath => {
		const filename = path.normalize(filePath).replace(path.normalize(tempDirPath), '');
		// Remove any beginning slashes, and posix normalize
		return posixNormalize(filename.replace(/^[\/\\]{1,2}/g, ''));
	});
	buildDir(tempDirPath, testFilesRelative);
	if (typeof (cacheFileName) === 'string') {
		fse.ensureFileSync(`${tempDirPath}/${cacheFileName}`);
	}
	const stamp = Math.floor((new Date()).getTime() / 1000);
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
		stamp
	};
}

async function removeTestDir(tempDirPath) {
	// Just delete the top level dir
	await fse.emptyDir(tempDirPath);
	await fse.rmdir(tempDirPath);
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
 * @param {DirListing} files - Input file list
 * @param {StampCache} results - Output results from scraper
 */
function testForStampInResults(testContext, files, results) {
	for (const key in files) {
		if (typeof files[key] === 'object') {
			/** @type {DirListing} */
			const dirListing = (files[key]);
			testForStampInResults(testContext, dirListing, results);
		} else {
			/** @type {string} */
			const filePath = (files[key]);
			const stampEntry = results[filePath];
			const testMsg = JSON.stringify({
				filePath,
				stampEntry,
				results
			}, null, 4);
			testContext.true(typeof stampEntry === 'object', testMsg);
			testContext.true(typeof stampEntry.created === 'number', testMsg);
			testContext.true(typeof stampEntry.modified === 'number', testMsg);
		}
	}
}

module.exports = {
	wasLastCommitAutoAddCache,
	iDebugLog,
	buildTestDir,
	removeTestDir,
	touchFileSync,
	getTestFilePaths,
	buildDir,
	testForStampInResults
};
