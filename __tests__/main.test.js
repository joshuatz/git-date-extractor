// @ts-check

/**
 * Notes:
 *  - The build up and tear down for this is complicated and could be refactored into a reusable function
 *  - Due to the sharing of the same test dir, these tests have to be run in serial, or else they conflict
 *  - If test dir generator func is written, should be easy to refactor back to concurrent test with separate test dirs
 */


import test from 'ava';
const main = require('../');
const fse = require('fs-extra');
const path = require('path');
const childProc = require('child_process');
const { replaceInObj, projectRootPathTrailingSlash, posixNormalize } = require('../helpers');
const tstHelpers = require('../tst-helpers');

// Set up some paths for testing

const cacheFileName = 'cache.json';
const tempSubDirName = 'subdir';
const tempDirNames = {
	mainPostTest: 'tempdir-main-post',
	mainPreTest: 'tempdir-main-pre'
}

let timingsSec = {};

/**
 * This is really a full integration test
 */
test.serial('main - integration test - git post commit', async t=> {
	// Create test dir
	const tempDirName = tempDirNames.mainPostTest;
	const tempDirPath = posixNormalize(__dirname + '/' + tempDirName);
	const cacheFilePath = posixNormalize(`${tempDirPath}/${cacheFileName}`);
	const {testFiles} = tstHelpers.buildTestDir(tempDirPath,tempSubDirName);
	const checkTimeDelayMs = 5000;
	// Git add the files, since we are emulating a post commit
	childProc.execSync('git add . && git commit -m "added files"',{
		cwd: tempDirPath
	});
	// Since created will be pulled off git history, update timings
	timingsSec.created = Math.floor((new Date()).getTime()/1000);
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
	childProc.execSync('git add . && git commit -m "added files"',{
		cwd: tempDirPath
	});
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
	t.truthy(tstHelpers.wasLastCommitAutoAddCache(tempDirPath,cacheFileName));
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

test.serial('main - integration test - git pre commit', async t => {
	// Create test dir
	const tempDirName = tempDirNames.mainPreTest;
	const tempDirPath = posixNormalize(__dirname + '/' + tempDirName);
	const cacheFilePath = posixNormalize(`${tempDirPath}/${cacheFileName}`);
	const {testFiles} = tstHelpers.buildTestDir(tempDirPath,tempSubDirName);
	const checkTimeDelayMs = 3000;
	// Wait a bit so that we can make sure there is a difference in stamps
	await (new Promise((res,rej)=>{
		setTimeout(()=>{
			res();
		},checkTimeDelayMs);
	}));
	// Touch alpha so that it will have a different mtime value
	fse.writeFileSync(testFiles.alpha,'test',{
		flag: 'a'
	});
	// Now run full process - get stamps, save to file, etc.
	/**
	 * @type {InputOptions}
	 */
	const dummyOptions = {
		projectRootPath: tempDirPath,
		gitCommitHook: 'pre',
		outputToFile: true,
		outputFileName: cacheFileName,
		outputFileGitAdd: true
	};
	// Run
	const result = main.getStamps(dummyOptions);
	// Now the cache file should be *staged* but **not** committed, since we used `pre`
	t.falsy(tstHelpers.wasLastCommitAutoAddCache(tempDirPath,cacheFileName));
	// Check that actual numbers came back for stamps
	let alphaStamp = result['alpha.txt'];
	tstHelpers.debugLog(alphaStamp);
	t.true(typeof(alphaStamp.created)==='number');
	t.true(typeof(alphaStamp.modified)==='number');
	// Check time difference in stamps. Note that both modified and created stamps should be based off file stat, since no git history has been created
	const timeDelay = Number(alphaStamp.modified) - Number(result['alpha.txt'].created);
	// Assume a 1 second variance is ok
	const timeDiff = Math.abs((Math.floor(checkTimeDelayMs/1000)) - timeDelay);
	t.true(timeDiff <= 1);
});

// Teardown dir and files
test.after.always(async t => {
	for (let key in tempDirNames){
		const tempDirPath = posixNormalize(__dirname + '/' + tempDirNames[key]);
		tstHelpers.removeTestDir(tempDirPath);
	}
});
