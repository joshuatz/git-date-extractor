// @ts-check
import test from 'ava';
import { resolve } from 'path';
const main = require('../');
const fse = require('fs-extra');
const path = require('path');
const childProc = require('child_process');
const { replaceInObj, projectRootPathTrailingSlash, posixNormalize } = require('../helpers');
const { wasLastCommitAutoAddCache } = require('../tst-helpers');

// Set up some paths for testing
const tempDirName = 'tempdir-main';
const tempDirPath = posixNormalize(__dirname + '/' + tempDirName)
const cacheFileName = 'cache.json';
const cacheFilePath = posixNormalize(`${tempDirPath}/${cacheFileName}`);
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
const checkTimeDelayMs = 5000;

// Create directory and files for testing
test.before(t => {
	fse.ensureDirSync(tempDirPath);
	fse.emptyDirSync(tempDirPath);
	fse.ensureFileSync(testFiles.alpha);
	fse.ensureFileSync(testFiles.bravo);
	fse.ensureFileSync(testFiles.charlie);
	fse.ensureDirSync(`${tempDirPath}/${tempSubDirName}`);
	fse.ensureFileSync(testFiles.subdir.delta);
	fse.ensureFileSync(testFiles.subdir.echo);

	// Git init
	childProc.execSync(`git init`,execOptions);
	childProc.execSync('git add . && git commit -m "added files"',execOptions);
	timingsSec.created = Math.floor((new Date()).getTime()/1000);
});


/**
 * This is really a full integration test
 */
test('main - integration test', async t=> {
	// Wait a bit so that we can make sure there is a difference in stamps
	await (new Promise((res,rej)=>{
		setTimeout(()=>{
			res();
		},checkTimeDelayMs);
	}));
	// Touch alpha so it can be re-staged and committed - thus giving it a later modification stamp
	fse.writeFileSync(testFiles.alpha,'test',{
		flag: 'a'
	});
	// Git commit all the files
	childProc.execSync('git add . && git commit -m "added files"',execOptions);
	timingsSec.gitAdd = Math.floor((new Date()).getTime()/1000);
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
	// Check that actual numbers came back for stamps
	let alphaStamp = result['alpha.txt'];
	t.true(typeof(alphaStamp.created)==='number');
	t.true(typeof(alphaStamp.modified)==='number');
	// Important: Check the time difference between file creation and modified. If processor failed, these will be the same due to file stat. If success, then there should be a 10 second diff between creation (file stat) and modified (git add)
	const timeDelay = Number(alphaStamp.modified) - Number(result['alpha.txt'].created);
	// Assume a 1 second variance is ok
	const timeDiff = Math.abs((Math.floor(checkTimeDelayMs/1000)) - timeDelay);
	t.true(timeDiff <= 1);
});


// Teardown dir and files
test.after.always(async t => {
	// Just delete the top leve dir
	await fse.emptyDir(tempDirPath);
	await fse.rmdir(tempDirPath);
});
