// @ts-check
const childProc = require('child_process');
const path = require('path');
const fse = require('fs-extra');
const {replaceInObj, projectRootPathTrailingSlash} = require('./helpers');

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
 * Build a test dir based on inputs
 * @param {string} tempDirPath - The full path of the temp dir
 * @param {string} tempSubDirName - the name of the subdir
 * @param {boolean} gitInit - if `git init` should be ran in dir
 * @param {string} [cacheFileName] - If cache file should be created, pass name
 * @returns {object} info about created test dir
 */
function buildTestDir(tempDirPath, tempSubDirName, gitInit, cacheFileName) {
	const testFiles = {
		alpha: `${tempDirPath}/alpha.txt`,
		bravo: `${tempDirPath}/bravo.txt`,
		charlie: `${tempDirPath}/charlie.txt`,
		subdir: {
			delta: `${tempDirPath}/${tempSubDirName}/delta.txt`,
			echo: `${tempDirPath}/${tempSubDirName}/echo.txt`
		}
	};
	const testFilesRelative = replaceInObj(testFiles, filePath => {
		return path.normalize(filePath).replace(path.normalize(projectRootPathTrailingSlash), '');
	});
	fse.ensureDirSync(tempDirPath);
	fse.emptyDirSync(tempDirPath);
	fse.ensureFileSync(testFiles.alpha);
	fse.ensureFileSync(testFiles.bravo);
	fse.ensureFileSync(testFiles.charlie);
	fse.ensureDirSync(`${tempDirPath}/${tempSubDirName}`);
	fse.ensureFileSync(testFiles.subdir.delta);
	fse.ensureFileSync(testFiles.subdir.echo);
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

module.exports = {
	wasLastCommitAutoAddCache,
	iDebugLog,
	buildTestDir,
	removeTestDir,
	touchFileSync
};
