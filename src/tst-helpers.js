// @ts-check
const childProc = require('child_process');
const fse = require('fs-extra');
const path = require('path');
const { replaceInObj, projectRootPathTrailingSlash } = require('./helpers');

/**
 * Test if the last commit in the log is from self (auto add of cache file)
 * @param {string} gitDir - Path where the commit was made
 * @param {string} cacheFileName - Filename (not path) of the cache file that was added
 */
function wasLastCommitAutoAddCache(gitDir,cacheFileName){
	try {
		const gitCommitMsg = childProc.execSync(`git show -s --format=%s`,{
			cwd: gitDir
		}).toString();
		const changedFiles = childProc.execSync(`git show HEAD --name-only --format=%b`,{
			cwd: gitDir
		}).toString().trim();
		const commitMsgMatch = /AUTO: Updated/.test(gitCommitMsg);
		const changedFilesMatch = changedFiles === cacheFileName;
		return commitMsgMatch && changedFilesMatch;
	}
	catch (e){
		return false;
	}
}

/* istanbul ignore next */
function debugLog(msg){
	console.log(msg);
	if (typeof(msg)==='object'){
		msg = JSON.stringify(msg);
	}
	msg = '\n' + msg;
	const debugLog = './debug.txt';
	fse.exists(debugLog,function(exists){
		if (exists){
			fse.writeFileSync(debugLog,msg,{
				flag: 'a'
			});
		}
	})
}

/**
 *
 * @param {string} tempDirPath
 * @param {string} tempSubDirName
 * @param {boolean} gitInit
 * @param {string} [cacheFileName]
 */
function buildTestDir(tempDirPath,tempSubDirName,gitInit,cacheFileName){
	const testFiles = {
		alpha: `${tempDirPath}/alpha.txt`,
		bravo: `${tempDirPath}/bravo.txt`,
		charlie: `${tempDirPath}/charlie.txt`,
		subdir: {
			delta: `${tempDirPath}/${tempSubDirName}/delta.txt`,
			echo: `${tempDirPath}/${tempSubDirName}/echo.txt`
		}
	};
	const testFilesRelative = replaceInObj(testFiles,function(filePath){
		return path.normalize(filePath).replace(path.normalize(projectRootPathTrailingSlash),'');
	});
	fse.ensureDirSync(tempDirPath);
	fse.emptyDirSync(tempDirPath);
	fse.ensureFileSync(testFiles.alpha);
	fse.ensureFileSync(testFiles.bravo);
	fse.ensureFileSync(testFiles.charlie);
	fse.ensureDirSync(`${tempDirPath}/${tempSubDirName}`);
	fse.ensureFileSync(testFiles.subdir.delta);
	fse.ensureFileSync(testFiles.subdir.echo);
	if (typeof(cacheFileName)==='string'){
		fse.ensureFileSync(`${tempDirPath}/${cacheFileName}`);
	}
	const stamp = Math.floor((new Date()).getTime()/1000);
	/* istanbul ignore else */
	if (gitInit){
		childProc.execSync(`git init`,{
			cwd: tempDirPath
		});
	}
	return {
		testFiles,
		testFilesRelative,
		stamp
	}
}

async function removeTestDir(tempDirPath){
	// Just delete the top level dir
	await fse.emptyDir(tempDirPath);
	await fse.rmdir(tempDirPath);
}

module.exports = {
	wasLastCommitAutoAddCache,
	debugLog,
	buildTestDir,
	removeTestDir
}
