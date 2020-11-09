const test = require('ava').default;
const childProc = require('child_process');
const fse = require('fs-extra');
const main = require('../src');
const stHandler = require('../src/stamp-handler');
const {validateOptions} = require('../src/helpers');
const {wasLastCommitAutoAddCache, makeTempDir, buildTestDir, delay} = require('../tst-helpers');

/** @type {string[]} */
const createdTempDirPaths = [];

const setup = async (cacheFileName = 'cache.json') => {
	const tempDirPath = await makeTempDir();
	createdTempDirPaths.push(tempDirPath);
	const cacheFilePath = `${tempDirPath}/${cacheFileName}`;
	// Git init - will fail if git is not installed
	childProc.execSync(`git init`, {
		cwd: tempDirPath
	});
	// Create JSON cacheFile
	const cacheObj = {};
	await fse.createFile(cacheFilePath);
	await fse.writeFile(cacheFilePath, JSON.stringify(cacheObj, null, 2));
	return {
		tempDirPath,
		cacheFilePath,
		cacheFileName
	};
};

test('Update cache file and auto-commit', async (t) => {
	const {tempDirPath, cacheFilePath, cacheFileName} = await setup();
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
	 * @type {import('../src/types').InputOptions}
	 */
	const dummyOptions = {
		files: [],
		// Note the use of "post" for gitCommitHook
		// This should trigger adding of the cache file to the commit
		gitCommitHook: 'post',
		projectRootPath: tempDirPath,
		outputToFile: true
	};
	stHandler.updateTimestampsCacheFile(cacheFilePath, cacheObj, validateOptions(dummyOptions));
	// Now read back the file and check
	const saved = await fse.readJSON(cacheFilePath);
	t.deepEqual(cacheObj, saved);

	// Check that the file was checked into git
	t.truthy(wasLastCommitAutoAddCache(tempDirPath, cacheFileName));
});

test('Reuse timestamps from cache file when possible', async (t) => {
	const {tempDirPath, cacheFilePath, cacheFileName} = await setup();
	const {testFilesRelative} = await buildTestDir(tempDirPath, false, cacheFileName);
	const startTimeSec = Math.floor((new Date().getTime()) / 1000);
	// Add a cache stamp for alpha, with a creation date wayyyy in the past
	const fakeAlphaCreated = 100;
	// File that is outside of test set; should be left alone
	const nonTestingFileName = 'dont-modify-me.gif';
	const fakeNonsenseStamp = -100;
	/** @type {import('../src/types').StampCache} */
	const dummyCache = {
		[testFilesRelative.alpha]: {
			created: fakeAlphaCreated,
			modified: fakeAlphaCreated
		},
		[nonTestingFileName]: {
			created: fakeNonsenseStamp,
			modified: fakeNonsenseStamp
		}
	};
	await fse.writeJSON(cacheFilePath, dummyCache);
	/**
	 * @type {import('../src/types').InputOptions}
	 */
	const dummyOptions = {
		files: [],
		projectRootPath: tempDirPath,
		outputToFile: true,
		outputFileName: cacheFileName
	};
	await delay(1000);
	const result = await main.getStamps(dummyOptions);
	/** @type {import('../src/types').StampCache} */
	const saved = await fse.readJSON(cacheFilePath);
	// Make sure that alpha.created was preserved in both JS result and saved file
	t.true(result[testFilesRelative.alpha].created === fakeAlphaCreated);
	t.true(saved[testFilesRelative.alpha].created === fakeAlphaCreated);
	// But, alpha should be updated
	t.true(result[testFilesRelative.alpha].modified !== fakeAlphaCreated);
	t.true(result[testFilesRelative.alpha].modified > (startTimeSec - 10));
	// And, file outside our set should have been left alone
	t.true(saved[nonTestingFileName].created === fakeNonsenseStamp);
	t.true(saved[nonTestingFileName].modified === fakeNonsenseStamp);
});

// Teardown - delete test files
test.after.always(async () => {
	await Promise.all(createdTempDirPaths.map(p => {
		return fse.remove(p);
	}));
});
