/// <reference path="../types.d.ts"/>
// @ts-check
'use strict';

const path = require('path');
const childProc = require('child_process');
const os = require('os');
const fse = require('fs-extra');

/**
* Normalizes and forces a filepath to the forward slash variant
* Example: \dir\file.txt will become /dir/file.txt
* @param {string} filePath the path to normalize
* @returns {string} The posix foward slashed version of the input
*/
const posixNormalize = function(filePath) {
	return path.normalize(filePath).replace(/[\/\\]{1,2}/gm, '/');
};

/**
 * Extract an array from a stringified array
 * @param {string} str - input string
 * @returns {array} - Array output
 */
function extractArrFromStr(str) {
	let arr = [];
	if (typeof (str) === 'string') {
		// Test for input string resembling array
		// "[alpha.txt, bravo.js]"
		if (/^\[(.+)\]/.exec(str)) {
			// Extract arr
			arr = /^\[(.+)\]/.exec(str)[1].split(',').map(e => e.trim());
		} else {
			// Single file - e.g. "alpha.txt"
			arr.push(str);
		}
	}
	return arr;
}

/**
 * Internal options validator / modder
 * @param {object} input - Options object
 * @returns {FinalizedOptions} - The finalized, formatted options
 */
function _validateOptions(input) {
	const moddedOptions = JSON.parse(JSON.stringify(input));
	/**
	 * Fill in some defaults and check for invalid combos
	 */
	if (typeof (moddedOptions.projectRootPath) !== 'string' || moddedOptions.projectRootPath.length === 0) {
		moddedOptions.projectRootPath = projectRootPath;
	}
	// Make sure project root does not end with trailing slash
	if (/[\/\\]{0,2}$/.test(moddedOptions.projectRootPath)) {
		// Remove trailing slashes
		moddedOptions.projectRootPath = moddedOptions.projectRootPath.replace(/[\/\\]{0,2}$/, '');
	}
	moddedOptions.projectRootPathTrailingSlash = moddedOptions.projectRootPath + '/';
	if (typeof (moddedOptions.outputToFile) !== 'boolean') {
		moddedOptions.outputToFile = false;
	}
	if (moddedOptions.outputToFile) {
		if (typeof (moddedOptions.outputFileName) !== 'string' || moddedOptions.outputFileName.length === 0) {
			moddedOptions.outputFileName = 'timestamps.json';
		}
		// Force outputFile (e.g. the cache file) to a full path if it is not
		if (!path.isAbsolute(moddedOptions.outputFileName)) {
			moddedOptions.outputFileName = posixNormalize(`${moddedOptions.projectRootPath}/${moddedOptions.outputFileName}`);
		}
	}
	// Default git commit hook selection
	if (typeof (moddedOptions.gitCommitHook) !== 'string') {
		moddedOptions.gitCommitHook = 'none';
	}
	// Reset invalid git commit hook selection
	if (typeof (moddedOptions.gitCommitHook) === 'string' && ['pre', 'post', 'none'].indexOf(moddedOptions.gitCommitHook) === -1) {
		moddedOptions.gitCommitHook = 'none';
	}
	// Force single file passed to array
	if (typeof (moddedOptions.files) === 'string') {
		moddedOptions.files = extractArrFromStr(moddedOptions.files);
	}
	if (typeof (moddedOptions.onlyIn) === 'string') {
		moddedOptions.onlyIn = extractArrFromStr(moddedOptions.onlyIn);
	}
	if (typeof (moddedOptions.blockFiles) === 'string') {
		moddedOptions.blockFiles = extractArrFromStr(moddedOptions.blockFiles);
	}
	if (typeof (moddedOptions.allowFiles) === 'string') {
		moddedOptions.allowFiles = extractArrFromStr(moddedOptions.allowFiles);
	}
	// Force to array
	if (!Array.isArray(moddedOptions.files)) {
		// Reminder: An empty files array means that all files within the project space will be scanned!
		moddedOptions.files = [];
	}
	if (!Array.isArray(moddedOptions.allowFiles)) {
		moddedOptions.allowFiles = [];
	}
	// Debug - only allow for dev, and allow override
	/* istanbul ignore if */
	if (typeof (moddedOptions.debug) === 'boolean') {
		if (moddedOptions.debug === true && /.+\/laragon\/.+\/git-date-extractor.*/.test(posixNormalize(__dirname))) {
			moddedOptions.debug = true;
		} else {
			moddedOptions.debug = false;
		}
	} else {
		moddedOptions.debug = false;
	}
	return moddedOptions;
}

/**
 * Validates input options and forces them to conform
 * @param {InputOptions} input - Options
 * @returns {FinalizedOptions} - The vaidated and formatted options
 */
function validateOptions(input) {
	const moddedOptions = _validateOptions(input);
	/**
	 * @type {FinalizedOptions}
	 */
	const finalOptions = {
		outputToFile: moddedOptions.outputToFile,
		outputFileName: moddedOptions.outputFileName,
		outputFileGitAdd: moddedOptions.outputFileGitAdd,
		files: moddedOptions.files,
		onlyIn: moddedOptions.onlyIn,
		blockFiles: moddedOptions.blockFiles,
		allowFiles: moddedOptions.allowFiles,
		gitCommitHook: moddedOptions.gitCommitHook,
		projectRootPath: moddedOptions.projectRootPath,
		projectRootPathTrailingSlash: moddedOptions.projectRootPathTrailingSlash,
		debug: moddedOptions.debug
	};
	return finalOptions;
}

/**
 * Run a replacer function over an object to modify it
 * @param {object} inputObj - the object to replace values in
 * @param {function} replacerFunc - cb func to take value, modify, and return it
 * @returns {object} - Object with replacements
 */
function replaceInObj(inputObj, replacerFunc) {
	const outputObj = {};
	for (let x = 0; x < Object.keys(inputObj).length; x++) {
		const key = Object.keys(inputObj)[x];
		let val = inputObj[Object.keys(inputObj)[x]];
		if (Array.isArray(val)) {
			for (let y = 0; y < val.length; y++) {
				val[y] = replacerFunc(val[y]);
			}
		} else if (val && typeof (val) === 'object') {
			val = replaceInObj(val, replacerFunc);
		} else {
			val = replacerFunc(val);
		}
		outputObj[key] = val;
	}
	return outputObj;
}

/**
 * Get the "null" destination
 * @returns {string} - The "null" destination
 */
function getNullDestination() {
	if (process.platform === 'win32') {
		return 'NUL';
	}

	return '/dev/null';
}
const nullDestination = getNullDestination();

/**
 * Are we in a subdirectory of the node_modules folder?
 * @param {string} [OPT_path] - Optional path to use as check dir
 * @returns {boolean} - If we are in node_modules
 */
const isInNodeModules = function(OPT_path) {
	if (typeof (OPT_path) === 'string') {
		return /node_modules\//.test(OPT_path);
	}

	const parentFolderPath = path.normalize(__dirname + '/../');
	/* istanbul ignore if */
	if (path.basename(parentFolderPath) === 'node_modules') {
		return true;
	}

	return false;
};

/**
 * Check if a value is a valid stamp value
 * @param {any} stampInt - The stamp value to check
 * @returns {boolean} - Is valid stamp val
 */
function getIsValidStampVal(stampInt) {
	if (typeof (stampInt) !== 'number' || stampInt <= 0) {
		return false;
	}
	return true;
}

/**
 * Checks if two are objects are same (inefficient and bad - uses stringify)
 * @param {object} objA - First obj
 * @param {object} objB - Second obj
 * @returns {boolean} - Are two objs same?
 */
function lazyAreObjsSame(objA, objB) {
	if (JSON.stringify(objA) === JSON.stringify(objB)) {
		return true;
	}

	return false;
}

/**
 * Get the lowest num out of array of nums
 * @param {number[]} numArr - array of numbers
 * @returns {number} - lowest number in arr
 */
function getLowest(numArr) {
	return numArr.sort((a, n) => {
		return a - n;
	})[0];
}

/**
 * Get the highest num out of array of nums
 * @param {number[]} numArr - array of numbers
 * @returns {number} - highest number in arr
 */
function getHighest(numArr) {
	return numArr.sort((a, n) => {
		return n - a;
	})[0];
}

/**
 * Get the highest and lowest stamps from FS Stats
 * @param {object} stats - FS Stats object
 * @returns {object} - Highest and lowest points
 */
function getEndOfRangeFromStat(stats) {
	const lowestMs = getLowest([
		stats.birthtimeMs,
		stats.atimeMs,
		stats.ctimeMs,
		stats.mtimeMs
	]);
	const highestMs = getHighest([
		stats.birthtimeMs,
		stats.atimeMs,
		stats.ctimeMs,
		stats.mtimeMs
	]);
	return {
		lowestMs,
		highestMs
	};
}

/**
 * @typedef {Object<string, any>} BirthStamps
 * @property {number} birthtimeMs - Birth time in MS since Epoch
 * @property {number} birthtime - Birth time in sec since Epoch
 * @property {string} source - Where did the info come from
 */

/**
 * Get the birth times of a file
 * @param {string} filePath - The filepath of the file to get birth of
 * @param {boolean} [preferNative] - Prefer using Node FS - don't try for debugfs
 * @param {object} [OPT_fsStats] - Stats object, if you already have it ready
 * @returns {BirthStamps} - Birth stamps
 */
function getFsBirth(filePath, preferNative, OPT_fsStats) {
	const birthStamps = {
		birthtime: null,
		birthtimeMs: null,
		source: 'fs',
		errorMsg: ''
	};
	let fsStats;
	// Check for passed in value
	if (typeof (fsStats) === 'object' && 'birthtimeMs' in fsStats) {
		fsStats = OPT_fsStats;
	} else {
		fsStats = fse.statSync(filePath);
	}
	if (parseFloat(process.versions.node) > 9 || preferNative || process.platform === 'win32') {
		// Just use FS
		birthStamps.birthtimeMs = Math.round(getEndOfRangeFromStat(fsStats).lowestMs);
		birthStamps.birthtime = Math.round(birthStamps.birthtimeMs / 1000);
	} else {
		let success = true;
		// There is likely going to be an issue where mtime = birthtime, regardless of creation. Workaround hack:
		try {
			// Grab inode number, and device
			const inode = fsStats.ino;
			const deviceStr = /Device:\s{0,1}([a-zA-Z0-9\/]+)/.exec(childProc.execSync(`stat ${filePath}`).toString())[1];
			// Make call to debugfs
			const debugFsInfo = childProc.execSync(`debugfs -R 'stat <${inode}> --format=%W' ${deviceStr}`, {
				stdio: 'pipe'
			}).toString();
			// Parse for timestamp
			const birthTimeSec = parseInt(debugFsInfo, 10);
			if (!Number.isNaN(birthTimeSec) && birthTimeSec !== 0) {
				// Success!
				birthStamps.birthtime = birthTimeSec;
				birthStamps.birthtimeMs = birthTimeSec * 1000;
				birthStamps.source = 'debugfs';
				success = true;
			} else {
				// Bad - we still get back either 0 as birthTime, or bad string
				birthStamps.errorMsg = debugFsInfo;
				success = false;
			}
		} catch (error) {
			success = false;
			birthStamps.errorMsg = error.toString();
		}
		if (!success) {
			// Fallback to fs
			return getFsBirth(filePath, true, fsStats);
		}
	}
	return birthStamps;
}

/**
 * @typedef {Object<string,any>} KernelInfo
 * @property {number} base
 * @property {number} major
 * @property {number} minor
 * @property {number} patch
 */
/**
 * Get kernel version of OS (or v # in case of Win)
 * @returns {KernelInfo} - Kernel #
 */
function getKernelInfo() {
	const info = {
		base: 0,
		major: 0,
		minor: 0,
		patch: 0
	};
	const kString = os.release();
	const chunks = kString.split('-');
	if (/(\d+)\.(\d+)\.(\d+)/.test(chunks[0])) {
		const vChunks = chunks[0].split('.');
		info.base = parseInt(vChunks[0], 10);
		info.major = parseInt(vChunks[1], 10);
		info.minor = parseInt(vChunks[2], 10);
	}
	if (/\d+/.test(chunks[1])) {
		info.patch = parseInt(chunks[1], 10);
	}
	return info;
}

// @todo this is probably going to need to be revised
let projectRootPath = isInNodeModules() ? posixNormalize(path.normalize(`${__dirname}/../..`)) : posixNormalize(`${__dirname}`);
const callerDir = posixNormalize(process.cwd());
/* istanbul ignore if */
if (projectRootPath.indexOf(callerDir) === -1) {
	// This shouldn't be the case
	projectRootPath = callerDir;
}
const projectRootPathTrailingSlash = projectRootPath + '/';

module.exports = {
	posixNormalize,
	/**
	* Replaces any root level values on an object that are 0, with a different value
	* @param {object} inputObj  - The object to replace zeros on
	* @param {any} replacement - what to replace the zeros with
	* @returns {object} The object with zeros replaced
	*/
	replaceZeros(inputObj, replacement) {
		const keys = Object.keys(inputObj);
		for (let x = 0; x < keys.length; x++) {
			if (inputObj[keys[x]] === 0) {
				inputObj[keys[x]] = replacement;
			}
		}
		return inputObj;
	},
	/**
	* Test whether or not we are in a git initialized repo space / folder
	* @param {string} [OPT_folder] - Optional: Folder to use as dir to check in
	* @returns {boolean} Whether or not in git repo
	*/
	getIsInGitRepo(OPT_folder) {
		let executeInPath = __dirname;
		if (typeof (OPT_folder) === 'string') {
			executeInPath = path.normalize(OPT_folder);
		}
		try {
			childProc.execSync(`git status`, {
				cwd: executeInPath
			});
			return true;
		} catch (error) {
			return false;
		}
	},
	replaceInObj,
	projectRootPath,
	projectRootPathTrailingSlash,
	getIsRelativePath(filePath) {
		return !path.isAbsolute(filePath);
	},
	isInNodeModules,
	validateOptions,
	extractArrFromStr,
	getNullDestination,
	nullDestination,
	getIsValidStampVal,
	lazyAreObjsSame,
	getFsBirth,
	getKernelInfo
};
