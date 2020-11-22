const test = require('ava').default;
const fse = require('fs-extra');
const FilelistHandler = require('../src/filelist-handler');
const {validateOptions} = require('../src/helpers');
const {makeTempDir, buildTestDir} = require('../tst-helpers');

/**
 * @typedef {ReturnType<typeof import('../tst-helpers')['getTestFilePaths']>} TestFilePaths
 */

/** @type {string} */
let tempDirPath;
/** @type {string} */
let tempSubDirPath;
/** @type {TestFilePaths} */
let testFiles;
/** @type {TestFilePaths} */
let testFilesRelative;

// Create directory and files for testing
test.before(async () => {
	tempDirPath = await makeTempDir();
	tempSubDirPath = `${tempDirPath}/subdir`;
	const builderRes = await buildTestDir(tempDirPath, true);
	testFilesRelative = builderRes.testFilesRelative;
	testFiles = builderRes.testFiles;
});

// Teardown dir and files
test.after.always(async () => {
	await fse.remove(tempDirPath);
});

test('Restricting files by directory (onlyIn)', t => {
	/**
	 * @type {import('../src/types').InputOptions}
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
			fullPath: testFiles.subdir.delta,
			relativeToProjRoot: testFilesRelative.subdir.delta
		},
		{
			fullPath: testFiles.subdir.echo,
			relativeToProjRoot: testFilesRelative.subdir.echo
		}
	];
	t.deepEqual(instance.filePaths, expected);
});

test('Restrict by directory + allowFiles override', t => {
	// Without the use of allowFiles, normally alpha.txt would be blocked by the onlyIn option, since it is not in the subdir
	/**
	 * @type {import('../src/types').InputOptions}
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
			fullPath: testFiles.alpha,
			relativeToProjRoot: testFilesRelative.alpha
		},
		{
			fullPath: testFiles.subdir.delta,
			relativeToProjRoot: testFilesRelative.subdir.delta
		},
		{
			fullPath: testFiles.subdir.echo,
			relativeToProjRoot: testFilesRelative.subdir.echo
		}
	];
	t.deepEqual(instance.filePaths, expected);
});

test('Restricting files by explicit file list', t => {
	/**
	 * @type {import('../src/types').InputOptions}
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
			fullPath: testFiles.alpha,
			relativeToProjRoot: testFilesRelative.alpha
		},
		{
			fullPath: testFiles.subdir.delta,
			relativeToProjRoot: testFilesRelative.subdir.delta
		},
		{
			fullPath: testFiles.subdir.echo,
			relativeToProjRoot: testFilesRelative.subdir.echo
		}
	];
	t.deepEqual(instance.filePaths, expected);
});

test('Testing automatic dir parsing and filtering, + block list', t => {
	/**
	 * @type {import('../src/types').InputOptions}
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
			fullPath: testFiles.bravo,
			relativeToProjRoot: testFilesRelative.bravo
		},
		{
			fullPath: testFiles.space,
			relativeToProjRoot: testFilesRelative.space
		},
		{
			fullPath: testFiles.specialChars,
			relativeToProjRoot: testFilesRelative.specialChars
		},
		{
			fullPath: testFiles.subdir.delta,
			relativeToProjRoot: testFilesRelative.subdir.delta
		},
		{
			fullPath: testFiles.subdir.echo,
			relativeToProjRoot: testFilesRelative.subdir.echo
		}
	];
	t.deepEqual(instance.filePaths, expected);
});
