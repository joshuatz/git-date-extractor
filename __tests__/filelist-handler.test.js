/// <reference path="../types.d.ts"/>
// @ts-check
import test from 'ava';
const FilelistHandler = require('../src/filelist-handler');
const {replaceInObj, validateOptions, posixNormalize} = require('../src/helpers');
const fse = require('fs-extra');
const path = require('path');
const {debugLog} = require('../src/tst-helpers');

// Set up some paths for testing
// Test folder will be built in project root to avoid auto-filter based on __tests__ dirname
const tempDirName = 'tempdir-filehandler';
const tempDirPath = posixNormalize(__dirname + '/../' + tempDirName);
const tempSubDirName = 'subdir';
const tempSubDirPath = `${tempDirPath}/${tempSubDirName}`;
const tempDotDirName = '.dotdir';
const tempDotDirPath = `${tempDirPath}/${tempDotDirName}`;

const projectRootPathTrailingSlash = tempDirPath + '/';

const testFiles = {
	alpha: `${tempDirPath}/alpha.txt`,
	bravo: `${tempDirPath}/bravo.txt`,
	charlie: `${tempDirPath}/charlie.txt`,
	subdir: {
		delta: `${tempDirPath}/${tempSubDirName}/delta.txt`,
		echo: `${tempDirPath}/${tempSubDirName}/echo.txt`
	},
	".dotdir": {
		foxtrot: `${tempDirPath}/${tempDotDirName}/foxtrot.txt`
	}
};

const testFilesRelative = replaceInObj(testFiles,function(filePath){
	return path.normalize(filePath).replace(path.normalize(projectRootPathTrailingSlash),'');
});

// Create directory and files for testing
test.before(t => {
	fse.ensureDirSync(tempDirPath);
	fse.ensureFileSync(testFiles.alpha);
	fse.ensureFileSync(testFiles.bravo);
	fse.ensureFileSync(testFiles.charlie);
	fse.ensureDirSync(tempSubDirPath);
	fse.ensureFileSync(testFiles.subdir.delta);
	fse.ensureFileSync(testFiles.subdir.echo);
	fse.ensureDirSync(tempDotDirPath);
	fse.ensureFileSync(testFiles[".dotdir"].foxtrot);
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
	}
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
	}
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

test('Testing automatic dir parsing and filtering, + block list', t=> {
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

// Teardown dir and files
test.after.always(async t => {
	// Just delete the top leve dir
	await fse.emptyDir(tempDirPath);
	await fse.rmdir(tempDirPath);
});
