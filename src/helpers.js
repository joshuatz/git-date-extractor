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
 * @returns {string[]} - Array output
 */
function extractArrFromStr(str) {
	/** @type {string[]} */
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
 * @returns {import('./types').FinalizedOptions} - The finalized, formatted options
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
	moddedOptions.projectRootPath = posixNormalize(moddedOptions.projectRootPath);
	moddedOptions.projectRootPathTrailingSlash = posixNormalize(moddedOptions.projectRootPath + '/');
	if (typeof (moddedOptions.outputToFile) !== 'boolean') {
		moddedOptions.outputToFile = false;
	}
	if (moddedOptions.outputToFile) {
		// Default outputFileName
		if (typeof (moddedOptions.outputFileName) !== 'string' || moddedOptions.outputFileName.length === 0) {
			moddedOptions.outputFileName = 'timestamps.json';
		}
	}
	if (typeof moddedOptions.outputFileName === 'string') {
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
	if (typeof (moddedOptions.gitCommitHook) === 'string' && ['pre', 'post', 'none'].includes(moddedOptions.gitCommitHook) === false) {
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
	// Debug - auto set to true if local dev
	/* istanbul ignore if */
	if (typeof (moddedOptions.debug) !== 'boolean') {
		if (/.+\/laragon\/.+\/git-date-extractor-debug\/.*/.test(posixNormalize(__dirname))) {
			moddedOptions.debug = true;
		} else {
			moddedOptions.debug = false;
		}
	}
	return moddedOptions;
}

/**
 * Validates input options and forces them to conform
 * @param {import('./types').InputOptions} input - Options
 * @returns {import('./types').FinalizedOptions} - The vaidated and formatted options
 */
function validateOptions(input) {
	const moddedOptions = _validateOptions(input);
	/**
	 * @type {import('./types').FinalizedOptions}
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
 * @param {{[k: string]: any}} inputObj - the object to replace values in
 * @param {(input: any) => any} replacerFunc - cb func to take value, modify, and return it
 * @returns {{[k: string]: any}} - Object with replacements
 */
function replaceInObj(inputObj, replacerFunc) {
	/** @type {{[k: string]: any}} */
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
 * @param {import('fs').Stats} stats - FS Stats object
 * @returns {{lowestMs: number, highestMs: number}} - Highest and lowest points
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
 * @param {import('fs-extra').Stats} [OPT_fsStats] - Stats object, if you already have it ready
 * @returns {Promise<BirthStamps>} - Birth stamps
 */
async function getFsBirth(filePath, preferNative, OPT_fsStats) {
	/** @type {BirthStamps} */
	const birthStamps = {
		birthtime: null,
		birthtimeMs: null,
		source: 'fs',
		errorMsg: ''
	};
	/**
	 * @type {import('fs-extra').Stats}
	 */
	let fsStats;

	// Check for passed in value
	if (typeof (fsStats) === 'object' && 'birthtimeMs' in fsStats) {
		fsStats = OPT_fsStats;
	} else {
		fsStats = await statPromise(filePath);
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
			const fullStatStr = await execPromise(`stat ${filePath}`);
			const deviceStr = /Device:\s{0,1}([a-zA-Z0-9\/]+)/.exec(fullStatStr)[1];
			// Make call to debugfs
			const debugFsInfo = await execPromise(`debugfs -R 'stat <${inode}> --format=%W' ${deviceStr}`);
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
 * @typedef {Object<string,any>} SemVerInfo
 * @property {number} major
 * @property {number} minor
 * @property {number} patch
 * @property {string} suffix
 * @property {string} releaseLabel
 * @property {string} metadata
 */

/**
 * Get numerical semver info from string
 * Is kind of loose about input format
 * @param {string} versionStr - Version string. For example, from `process.versions.node`
 * @returns {SemVerInfo} - SemVer numerical info as obj
 */
function getSemverInfo(versionStr) {
	const info = {
		major: 0,
		minor: 0,
		patch: 0,
		suffix: '',
		releaseLabel: '',
		metadata: ''
	};
	// Just in case vstring start with 'v'
	versionStr = versionStr.replace(/^v/, '');
	const chunks = versionStr.split('-');
	if (/(\d+)\.(\d+)\.(\d+)/.test(chunks[0])) {
		const vChunks = chunks[0].split('.');
		info.major = parseInt(vChunks[0], 10);
		info.minor = parseInt(vChunks[1], 10);
		info.patch = parseInt(vChunks[2], 10);
	}
	if (chunks.length > 1) {
		// Suffix should look like 'beta.1+buildDebug'
		info.suffix = chunks[1];
		const suffixChunks = info.suffix.split('+');
		info.releaseLabel = typeof (suffixChunks[0]) === 'string' ? suffixChunks[0] : '';
		info.metadata = typeof (suffixChunks[1]) === 'string' ? suffixChunks[1] : '';
	}
	return info;
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
/* istanbul ignore next */
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

/**
 * Promise wrapper around child_process exec
 * @param {string} cmdStr - Command to execute
 * @param {import('child_process').ExecOptions} [options] - Exec options
 * @returns {Promise<string>} - Stdout string
 */
function execPromise(cmdStr, options) {
	return new Promise((resolve, reject) => {
		childProc.exec(cmdStr, options, (error, stdout) => {
			if (error) {
				reject(error);
				return;
			}
			resolve(stdout);
		});
	});
}

/**
 * Promise wrapper around child_process.spawn
 * @param {string} cmdStr
 * @param {string[]} [args]
 * @param {import('child_process').SpawnOptions} [options]
 * @returns {Promise<string>} stdout
 */
function spawnPromise(cmdStr, args, options) {
	return new Promise((resolve, reject) => {
		let out = '';
		const spawned = childProc.spawn(cmdStr, args, options);
		spawned.stdout.on('data', data => {
			out += data.toString();
		});
		spawned.stderr.on('data', data => {
			out += data.toString();
		});
		spawned.on('error', reject);
		spawned.on('close', (exitCode) => {
			if (exitCode === 0) {
				resolve(out);
			} else {
				reject(out);
			}
		});
	});
}

/**
 * Get return value of a promise, with a default value, in case it falls
 * @param {Promise<any>} promise
 * @param {any} [defaultVal]
 */
async function failSafePromise(promise, defaultVal = null) {
	let res = defaultVal;
	try {
		res = await promise;
	// eslint-disable-next-line no-unused-vars
	} catch (error) {
		// Ignore
	}
	return res;
}

/**
 * Promise wrapper around fs-extra stat
 * @param {string} filePath - Filepath to stat
 * @returns {Promise<import('fs-extra').Stats>}
 */
function statPromise(filePath) {
	return new Promise((resolve, reject) => {
		fse.stat(filePath, (err, stats) => {
			if (err) {
				reject(err);
				return;
			}
			resolve(stats);
		});
	});
}

/**
 * Replaces any root level values on an object that are 0, with a different value
 * @param {{[k: string]: any}} inputObj  - The object to replace zeros on
 * @param {any} replacement - what to replace the zeros with
 * @returns {object} The object with zeros replaced
 */
function replaceZeros(inputObj, replacement) {
	const keys = Object.keys(inputObj);
	for (let x = 0; x < keys.length; x++) {
		if (inputObj[keys[x]] === 0) {
			inputObj[keys[x]] = replacement;
		}
	}
	return inputObj;
}

/**
 * Test whether or not we are in a git initialized repo space / folder
 * @param {string} [OPT_folder] - Optional: Folder to use as dir to check in
 * @returns {boolean} Whether or not in git repo
 */
function getIsInGitRepo(OPT_folder) {
	let executeInPath = __dirname;
	if (typeof (OPT_folder) === 'string') {
		executeInPath = path.normalize(OPT_folder);
	}
	try {
		childProc.execSync(`git status`, {
			cwd: executeInPath
		});
		return true;
	// eslint-disable-next-line no-unused-vars
	} catch (error) {
		return false;
	}
}

/**
 * Return whether or not a filepath is a relative path
 * @param {string} filePath - Filepath to check
 * @returns {boolean} - If it is, or is not, a relative path.
 */
function getIsRelativePath(filePath) {
	return !path.isAbsolute(filePath);
}

// @todo this is probably going to need to be revised
let projectRootPath = isInNodeModules() ? posixNormalize(path.normalize(`${__dirname}/../..`)) : posixNormalize(`${__dirname}`);
const callerDir = posixNormalize(process.cwd());
if (projectRootPath.includes(posixNormalize(__dirname)) || projectRootPath.includes(callerDir) || global.calledViaCLI) {
	projectRootPath = callerDir;
}
const projectRootPathTrailingSlash = projectRootPath + '/';

module.exports = {
	posixNormalize,
	replaceZeros,
	getIsInGitRepo,
	replaceInObj,
	projectRootPath,
	callerDir,
	projectRootPathTrailingSlash,
	getIsRelativePath,
	isInNodeModules,
	validateOptions,
	extractArrFromStr,
	getNullDestination,
	nullDestination,
	getIsValidStampVal,
	lazyAreObjsSame,
	getFsBirth,
	getKernelInfo,
	getSemverInfo,
	execPromise,
	spawnPromise,
	statPromise,
	failSafePromise
};
