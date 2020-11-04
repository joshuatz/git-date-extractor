// @ts-check
const {makeTempDir, iDebugLog} = require('../tst-helpers');
const fse = require('fs-extra');
const {posixNormalize} = require('../src/helpers');
const childProc = require('child_process');
const main = require('../src');

const ROOT_FILE_COUNT = 120;
// How many top-level subdirs to create
const SUBDIR_ROOT_COUNT = 4;
// Contents of top-level subdirs
const SUBDIR_LEVELS = 3;
const SUBDIR_FILE_COUNT = 20;
const FILE_CONTENTS = `TEST FILE -- ⏱ --`;

/** @type {string} */
let tempDirPath;

const perfInfo = {
	testMeta: {
		timeToCreateFilesMs: 0,
		totalFileCount: 0
	},
	results: {
		totalExecutionTimeMs: 0,
		totalExecutionTimeSec: 0,
		filesPerSec: 0
	}
};

const timer = {
	fileCreation: {
		start: 0,
		stop: 0
	},
	program: {
		start: 0,
		stop: 0
	}
};

const getRandExtension = () => {
	const extensions = ['txt', 'md', 'html'];
	return extensions[Math.floor(Math.random() * extensions.length)];
};

const folderNames = ['alpha', 'bravo', 'charlie', 'delta'];
const getRandFolderName = () => {
	return folderNames[Math.floor(Math.random() * folderNames.length)];
};

/**
 *
 * @param {string} folderPath
 * @param {number} num
 */
const getTestFilePath = (folderPath, num) => {
	const slash = folderPath.endsWith('/') ? '' : '/';
	return `${folderPath}${slash}t-${num}.${getRandExtension()}`;
};

const stressTest = async () => {
	const filePaths = [];
	timer.fileCreation.start = new Date().getTime();
	tempDirPath = posixNormalize(await makeTempDir());
	// Create root files
	for (let x = 0; x < ROOT_FILE_COUNT; x++) {
		filePaths.push(getTestFilePath(tempDirPath, x));
	}
	// Create subdir files
	for (let x = 0; x < SUBDIR_ROOT_COUNT && x < folderNames.length; x++) {
		const baseFolderName = folderNames[x];
		for (let s = 1; s < SUBDIR_LEVELS; s++) {
			const subDirPath = `${tempDirPath}/${baseFolderName}/${new Array(s).fill(0).map(getRandFolderName).join('/')}`;
			for (let f = 0; f < SUBDIR_FILE_COUNT; f++) {
				filePaths.push(getTestFilePath(subDirPath, f));
			}
		}
	}

	// Wait for all files to be created
	await Promise.all(filePaths.map(async (p) => {
		await fse.ensureFile(p);
		await fse.writeFile(p, FILE_CONTENTS);
	}));
	timer.fileCreation.stop = new Date().getTime();
	const totalFileCount = filePaths.length;
	perfInfo.testMeta = {
		timeToCreateFilesMs: timer.fileCreation.stop - timer.fileCreation.start,
		totalFileCount
	};

	// Git init
	childProc.execSync('git init', {
		cwd: tempDirPath
	});
	childProc.execSync('git add . && git commit -m "Adding files"', {
		cwd: tempDirPath
	});

	// Run program
	timer.program.start = new Date().getTime();
	/** @type {import('../src/types').InputOptions} */
	const programOptions = {
		projectRootPath: tempDirPath,
		outputToFile: true
	};
	const result = await main.getStamps(programOptions);
	timer.program.stop = new Date().getTime();

	// Gather and return results
	console.assert(Object.keys(result).length === totalFileCount, 'Something went wrong with file generation, or program; # of files with date info does not match # supposed to be generated');
	const totalExecutionTimeMs = timer.program.stop - timer.program.start;
	const totalExecutionTimeSec = totalExecutionTimeMs / 1000;
	perfInfo.results = {
		totalExecutionTimeMs,
		totalExecutionTimeSec,
		filesPerSec: totalFileCount / totalExecutionTimeSec
	};
	return perfInfo;
};

const teardown = async () => {
	await fse.remove(tempDirPath);
};

const run = async() => {
	const results = await stressTest();
	iDebugLog(results);
	await teardown();
};

run().then(() => {
	console.log(`Done!`);
});
