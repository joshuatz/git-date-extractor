// @ts-check
import test from 'ava';
const FilelistHandler = require('../filelist-handler');
const fse = require('fs-extra');

const tempDirName = 'tempdir';
const tempDirPath = __dirname + '/' + tempDirName
const tempSubDirName = 'subdir';

// Create directory and files for testing
test.before(t => {
	fse.ensureDirSync(tempDirPath);
	fse.ensureFileSync(`${tempDirPath}/alpha.txt`);
	fse.ensureFileSync(`${tempDirPath}/bravo.txt`);
	fse.ensureFileSync(`${tempDirPath}/charlie.txt`);
	fse.ensureDirSync(`${tempDirPath}/${tempSubDirName}`);
	fse.ensureFileSync(`${tempDirPath}/${tempSubDirName}/delta.txt`);
	fse.ensureFileSync(`${tempDirPath}/${tempSubDirName}/echo.txt`);
});

test('Restricting files by directory', async t => {
	const instance = new FilelistHandler({
		onlyIn: [`${tempDirPath}/${tempSubDirName}`],
		files: [],
		gitCommitHook: 'none',
		outputToFile: false
	});
	console.log(instance.filePaths);
});

// Teardown dir and files
test.after.always(t => {
	// Just delete the top leve dir
	//fse.rmdirSync(tempDirName);
});
