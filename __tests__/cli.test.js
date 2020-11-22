const test = require('ava').default;
const {makeTempDir, buildTestDir, testForStampInResults} = require('../tst-helpers');

const childProc = require('child_process');
const fse = require('fs-extra');
const {posixNormalize} = require('../src/helpers');

/** @type {string} */
let tempDirPath;
/** @type {import('../src/types').UnpackedPromise<ReturnType<typeof buildTestDir>>} */
let builderRes;

const CLI_CALL_PATH = posixNormalize(`${__dirname}/../src/cli.js`);

test.before(async () => {
	tempDirPath = await makeTempDir();
	builderRes = await buildTestDir(tempDirPath, true);
});

test.after.always(async () => {
	await fse.remove(tempDirPath);
});

test('CLI Test, Auto-Detection of Project Directory', async t => {
	const outputFileName = 'explicit-stamps.json';
	const consoleOut = childProc.execSync(`node ${CLI_CALL_PATH} --outputToFile --outputFileName ${outputFileName}`, {
		cwd: tempDirPath,
		encoding: 'utf8'
	}).toString();
	t.regex(consoleOut, /Total execution time/mi);
	// Check JSON output
	const parsedJson = await fse.readJSON(`${tempDirPath}/${outputFileName}`);
	testForStampInResults(t, builderRes.testFilesRelative, parsedJson, [builderRes.testFilesRelative[".dotdir"].foxtrot]);
});

test('CLI Test, Explicit Project Directory', async t => {
	const outputFileName = 'detection-stamps.json';
	const consoleOut = childProc.execSync(`node ${CLI_CALL_PATH} --projectRootPath ${tempDirPath} --outputToFile --outputFileName ${outputFileName}`, {
		encoding: 'utf8'
	}).toString();
	t.regex(consoleOut, /Total execution time/mi);
	// Check JSON output
	const parsedJson = await fse.readJSON(`${tempDirPath}/${outputFileName}`);
	testForStampInResults(t, builderRes.testFilesRelative, parsedJson, [builderRes.testFilesRelative[".dotdir"].foxtrot]);
});
