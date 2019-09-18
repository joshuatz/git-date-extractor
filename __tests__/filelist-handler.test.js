/// <reference path="../types.d.ts"/>
// @ts-check
import test from 'ava';
const FilelistHandler = require('../filelist-handler');
const {projectRootPath, projectRootPathTrailingSlash, replaceInObj, validateOptions} = require('../helpers');
const fse = require('fs-extra');
const path = require('path');

// Set up some paths for testing
const tempDirName = 'tempdir-filehandler';
const tempDirPath = __dirname + '/' + tempDirName
const tempSubDirName = 'subdir';
const tempSubDirPath = `${tempDirPath}/${tempSubDirName}`;

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

// Create directory and files for testing
test.before(t => {
	fse.ensureDirSync(tempDirPath);
	fse.ensureFileSync(testFiles.alpha);
	fse.ensureFileSync(testFiles.bravo);
	fse.ensureFileSync(testFiles.charlie);
	fse.ensureDirSync(tempSubDirPath);
	fse.ensureFileSync(testFiles.subdir.delta);
	fse.ensureFileSync(testFiles.subdir.echo);
});

test('Restricting files by directory', t => {
	/**
	 * @type {InputOptions}
	 */
	const dummyOptions = {
		onlyIn: [tempSubDirPath],
		files: [],
		gitCommitHook: 'none',
		outputToFile: false
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

test('Restricting files by filter list', t => {
	/**
	 * @type {InputOptions}
	 */
	const dummyOptions = {
		onlyIn: [],
		files: [testFiles.alpha, testFiles.bravo, testFiles.subdir.delta, testFilesRelative.subdir.echo],
		blockFiles: ['bravo.txt'],
		gitCommitHook: 'none',
		outputToFile: false
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

// Teardown dir and files
test.after.always(async t => {
	// Just delete the top leve dir
	await fse.emptyDir(tempDirPath);
	await fse.rmdir(tempDirPath);
});
