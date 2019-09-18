// @ts-check
import test from 'ava';
const fse = require('fs-extra');
const stHandler = require('../stamp-handler');
const childProc = require('child_process');
const { validateOptions } = require('../helpers');
const { wasLastCommitAutoAddCache } = require('../tst-helpers');

// Set up some paths for testing
const tempDirName = 'tempdir-stamphandler';
const tempDirPath = __dirname + '/' + tempDirName
const cacheFileName = 'cache.json';
const cacheFilePath = `${tempDirPath}/${cacheFileName}`;

// Create test files
test.before(t => {
	fse.ensureDirSync(tempDirPath);
	// git init - will fail if git is not installed
	childProc.execSync(`git init`,{
		cwd: tempDirPath
	});
	// Create JSON cacheFile
	const cacheObj = {};
	fse.createFileSync(cacheFilePath);
	fse.writeFileSync(cacheFilePath,JSON.stringify(cacheObj,null,2));
});

test.serial('save cache file', t => {
	const nowStamp = (new Date()).getTime();
	// Save without touching git
	const cacheObj = {
		alpha: 'alpha',
		bravo: 240,
		nested: {
			charlie: nowStamp
		}
	};
	/**
	 * @type {InputOptions}
	 */
	const dummyOptions = {
		files: [],
		gitCommitHook: 'post',
		projectRootPath: tempDirPath,
		outputToFile: true
	}
	stHandler.updateTimestampsCacheFile(cacheFilePath,cacheObj,validateOptions(dummyOptions));
	// Now read back the file and check
	const saved = JSON.parse(fse.readFileSync(cacheFilePath).toString());
	t.deepEqual(cacheObj,saved);
});

test.serial('cache file git commmit', t => {
	// Check that the file was checked into git
	t.truthy(wasLastCommitAutoAddCache(tempDirPath,cacheFileName));
});

// Teardown - delete test files
test.after.always(t => {
	fse.emptyDirSync(tempDirPath);
	fse.rmdirSync(tempDirPath);
});
