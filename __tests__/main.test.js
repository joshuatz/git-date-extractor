// @ts-check
import test from 'ava';
import { resolve } from 'path';
const main = require('../');
const fse = require('fs-extra');
const path = require('path');
const childProc = require('child_process');
const { replaceInObj, projectRootPathTrailingSlash } = require('../helpers');
const { wasLastCommitAutoAddCache } = require('../test-helpers');

// Set up some paths for testing
const tempDirName = 'tempdir-main';
const tempDirPath = __dirname + '/' + tempDirName
const cacheFileName = 'cache.json';
const cacheFilePath = `${tempDirPath}/${cacheFileName}`;
const tempSubDirName = 'subdir';

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

const execOptions = {
	cwd: tempDirPath
}

let timingsSec = {};

// Create directory and files for testing
test.before(t => {
	fse.ensureDirSync(tempDirPath);
	fse.ensureFileSync(testFiles.alpha);
	fse.ensureFileSync(testFiles.bravo);
	fse.ensureFileSync(testFiles.charlie);
	fse.ensureDirSync(`${tempDirPath}/${tempSubDirName}`);
	fse.ensureFileSync(testFiles.subdir.delta);
	fse.ensureFileSync(testFiles.subdir.echo);

	// Git init
	childProc.execSync(`git init`,{
		cwd: tempDirPath
	});
	// Git commit all the files
	childProc.execSync('git add . && git commit -m "added files"',execOptions);
	timingsSec.gitAdd = Math.floor((new Date()).getTime()/1000);
});


/**
 * This is really a full integration test
 */
test('main - integration test', async t=> {
	// Wait a bit so that we can make sure return values are based on git log and not file stat
	await (new Promise((res,rej)=>{
		setTimeout(()=>{
			resolve();
		},5000);
	}));
	// Now run full process - get stamps, save to file, etc.
	/**
	 * @type {InputOptions}
	 */
	const dummyOptions = {
		projectRootPath: tempDirPath,
		gitCommitHook: 'post',
		outputToFile: true,
		outputFileName: cacheFileName
	};
	// Run
	const result = main.getStamps(dummyOptions);
	const savedResult = JSON.parse(fse.readFileSync(cacheFilePath).toString());
	// Check that the value passed back via JS matches what was saved to JSON
	t.deepEqual(result,savedResult);
	// Check that last commit was from self
	t.truthy(wasLastCommitAutoAddCache(tempDirPath,cacheFileName));
});


// Teardown dir and files
test.after.always(async t => {
	// Just delete the top leve dir
	await fse.emptyDir(tempDirPath);
	await fse.rmdir(tempDirPath);
});
