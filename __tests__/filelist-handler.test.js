/// <reference path="../types.d.ts"/>
// @ts-check
const test = require('ava').default;
const path = require('path');
const fse = require('fs-extra');
const FilelistHandler = require('../src/filelist-handler');
const {replaceInObj, validateOptions, posixNormalize} = require('../src/helpers');
const {getTestFilePaths, buildDir} = require('../src/tst-helpers');

// Set up some paths for testing
// Test folder will be built in project root to avoid auto-filter based on __tests__ dirname
const tempDirName = 'tempdir-filehandler';
const tempDirPath = posixNormalize(__dirname + '/../' + tempDirName);
const tempSubDirName = 'subdir';
const tempSubDirPath = `${tempDirPath}/${tempSubDirName}`;
const projectRootPathTrailingSlash = tempDirPath + '/';

const testFiles = getTestFilePaths(tempDirPath);

const testFilesRelative = replaceInObj(testFiles, function(filePath) {
	return path.normalize(filePath).replace(path.normalize(projectRootPathTrailingSlash), '');
});

// Create directory and files for testing
test.before(() => {
	buildDir(tempDirPath, testFiles);
});

// Teardown dir and files
test.after.always(async () => {
	// Just delete the top leve dir
	await fse.emptyDir(tempDirPath);
	await fse.rmdir(tempDirPath);
});

test('Restricting files by directory (onlyIn)', t => {
	/**
	 * @type {InputOptions}
	 */
	const dummyOptions = {
		onlyIn: [tempSubDirPath],
		files: [],
		gitCommitHook: 'none',
		outputToFile: false,
		projectRootPath: tempDirPath
	};
	const instance = new FilelistHandler(validateOptions(dummyOptions));
	const expected = [
		{
			fullPath: path.normalize(testFiles.subdir.delta),
			relativeToProjRoot: testFilesRelative.subdir.delta
		},
		{
			fullPath: path.normalize(testFiles.subdir.echo),
			relativeToProjRoot: testFilesRelative.subdir.echo
		}
	];
	t.deepEqual(instance.filePaths, expected);
});

test('Restrict by directory + allowFiles override', t => {
	// Without the use of allowFiles, normally alpha.txt would be blocked by the onlyIn option, since it is not in the subdir
	/**
	 * @type {InputOptions}
	 */
	const dummyOptions = {
		onlyIn: [tempSubDirPath],
		files: [testFiles.alpha, testFiles.subdir.delta, testFiles.subdir.echo],
		allowFiles: 'alpha.txt',
		gitCommitHook: 'none',
		outputToFile: false,
		projectRootPath: tempDirPath
	};
	const instance = new FilelistHandler(validateOptions(dummyOptions));
	const expected = [
		{
			fullPath: path.normalize(testFiles.alpha),
			relativeToProjRoot: testFilesRelative.alpha
		},
		{
			fullPath: path.normalize(testFiles.subdir.delta),
			relativeToProjRoot: testFilesRelative.subdir.delta
		},
		{
			fullPath: path.normalize(testFiles.subdir.echo),
			relativeToProjRoot: testFilesRelative.subdir.echo
		}
	];
	t.deepEqual(instance.filePaths, expected);
});

test('Restricting files by explicit file list', t => {
	/**
	 * @type {InputOptions}
	 */
	const dummyOptions = {
		onlyIn: [],
		files: [testFiles.alpha, testFiles.bravo, testFiles.subdir.delta, testFilesRelative.subdir.echo],
		blockFiles: ['bravo.txt'],
		gitCommitHook: 'none',
		outputToFile: false,
		projectRootPath: tempDirPath
	};
	const instance = new FilelistHandler(validateOptions(dummyOptions));
	const expected = [
		{
			fullPath: path.normalize(testFiles.alpha),
			relativeToProjRoot: testFilesRelative.alpha
		},
		{
			fullPath: path.normalize(testFiles.subdir.delta),
			relativeToProjRoot: testFilesRelative.subdir.delta
		},
		{
			fullPath: path.normalize(testFiles.subdir.echo),
			relativeToProjRoot: testFilesRelative.subdir.echo
		}
	];
	t.deepEqual(instance.filePaths, expected);
});

test('Testing automatic dir parsing and filtering, + block list', t => {
	/**
	 * @type {InputOptions}
	 */
	const dummyOptions = {
		onlyIn: [],
		blockFiles: [testFiles.alpha, testFiles.charlie],
		gitCommitHook: 'none',
		outputToFile: false,
		projectRootPath: tempDirPath
	};
	const instance = new FilelistHandler(validateOptions(dummyOptions));
	const expected = [
		{
			fullPath: path.normalize(testFiles.bravo),
			relativeToProjRoot: testFilesRelative.bravo
		},
		{
			fullPath: path.normalize(testFiles.subdir.delta),
			relativeToProjRoot: testFilesRelative.subdir.delta
		},
		{
			fullPath: path.normalize(testFiles.subdir.echo),
			relativeToProjRoot: testFilesRelative.subdir.echo
		}
	];
	t.deepEqual(instance.filePaths, expected);
});
