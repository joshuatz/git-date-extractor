// @ts-check
'use strict';

const path = require('path');
const childProc = require('child_process');

/**
* Normalizes and forces a filepath to the forward slash variant
* Example: \dir\file.txt will become /dir/file.txt
* @param {string} filePath the path to normalize
* @returns {string} The posix foward slashed version of the input
*/
const posixNormalize = function(filePath) {
	return path.normalize(filePath).replace(/[\/\\]{1,2}/gm, '/');
}

/**
 * Extract an array from a stringified array
 * @param {string} str - input string
 */
function extractArrFromStr(str){
	let arr = [];
	if (typeof(str)==='string'){
		// Test for input string resembling array
		// "[alpha.txt, bravo.js]"
		if (/^\[(.+)\]/.exec(str)){
			// Extract arr
			arr = /^\[(.+)\]/.exec(str)[1].split(',').map(e=>e.trim())
		}
		else {
			// single file - e.g. "alpha.txt"
			arr.push(str);
		}
	}
	return arr;
}


function _validateOptions(input){
	let moddedOptions = JSON.parse(JSON.stringify(input));
	/**
	 * Fill in some defaults and check for invalid combos
	 */
	if (typeof(moddedOptions.projectRootPath)!=='string' || moddedOptions.projectRootPath.length === 0){
		moddedOptions.projectRootPath = projectRootPath;
	}
	// Make sure project root does not end with trailing slash
	if (/[\/\\]{0,2}$/.test(moddedOptions.projectRootPath)){
		// remove trailing slashes
		moddedOptions.projectRootPath = moddedOptions.projectRootPath.replace(/[\/\\]{0,2}$/,'');
	}
	moddedOptions.projectRootPathTrailingSlash = moddedOptions.projectRootPath + '/';
	if (typeof(moddedOptions.outputToFile)!=='boolean'){
		moddedOptions.outputToFile = false;
	}
	if (moddedOptions.outputToFile){
		if (typeof(moddedOptions.outputFileName)!=='string' || moddedOptions.outputFileName.length === 0){
			moddedOptions.outputFileName = 'timestamps.json';
		}
		// Force outputFile (e.g. the cache file) to a full path if it is not
		if (!path.isAbsolute(moddedOptions.outputFileName)){
			moddedOptions.outputFileName = posixNormalize(`${moddedOptions.projectRootPath}/${moddedOptions.outputFileName}`);
		}
	}
	// Reset invalid git commit hook selection
	if (typeof(moddedOptions.gitCommitHook)==='string' && ['pre','post','none'].indexOf(moddedOptions.gitCommitHook)===-1){
		moddedOptions.gitCommitHook = 'none';
	}
	// Force single file passed to array
	if (typeof(moddedOptions.files)==='string'){
		moddedOptions.files = extractArrFromStr(moddedOptions.files);
	}
	if (typeof(moddedOptions.onlyIn)==='string'){
		moddedOptions.onlyIn = extractArrFromStr(moddedOptions.onlyIn);
	}
	if (typeof(moddedOptions.blockFiles)==='string'){
		moddedOptions.blockFiles = extractArrFromStr(moddedOptions.blockFiles);
	}
	if (typeof(moddedOptions.allowFiles)==='string'){
		moddedOptions.allowFiles = extractArrFromStr(moddedOptions.allowFiles);
	}
	// Force to array
	if (!Array.isArray(moddedOptions.files)){
		// Reminder: An empty files array means that all files within the project space will be scanned!
		moddedOptions.files = [];
	}
	// Debug - only allow for dev, and allow override
	/* istanbul ignore if */
	if (typeof(moddedOptions.debug)==='boolean'){
		if (moddedOptions.debug === true && /.+\/laragon\/.+\/git-date-extractor.*/.test(posixNormalize(__dirname))){
			moddedOptions.debug = true;
		}
		else {
			moddedOptions.debug = false;
		}
	}
	else {
		moddedOptions.debug = false;
	}
	return moddedOptions;
}

/**
 *
 * @param {InputOptions} input
 * @returns {FinalizedOptions}
 */
function validateOptions(input){
	let moddedOptions = _validateOptions(input);
	/**
	 * @type {FinalizedOptions}
	 */
	let finalOptions = {
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
 */
function replaceInObj(inputObj, replacerFunc){
	let outputObj = {};
	for (let x=0; x<Object.keys(inputObj).length; x++){
		let key = Object.keys(inputObj)[x];
		let val = inputObj[Object.keys(inputObj)[x]];
		if (Array.isArray(val)){
			for (let y=0; y<val.length; y++){
				val[y] = replacerFunc(val[y]);
			}
		}
		else if (val && typeof(val)==='object'){
			val = replaceInObj(val,replacerFunc);
		}
		else {
			val = replacerFunc(val);
		}
		outputObj[key] = val;
	}
	return outputObj;
}

/**
 * Get the "null" destination
 */
function getNullDestination(){
	if (process.platform === 'win32'){
		return 'NUL';
	}
	else {
		return '/dev/null';
	}
}
const nullDestination = getNullDestination();

/**
 * Are we in a subdirectory of the node_modules folder?
 * @param {string} [OPT_path] - Optional path to use as check dir
 */
const isInNodeModules = function(OPT_path){
	if (typeof(OPT_path)==='string'){
		return /node_modules\//.test(OPT_path);
	}
	else {
		const parentFolderPath = path.normalize(__dirname + '/../');
		/* istanbul ignore if */
		if (path.basename(parentFolderPath)==='node_modules'){
			return true;
		}
	}
	return false;
}

/**
 * Check if a value is a valid stamp value
 * @param {any} stampInt
 */
function getIsValidStampVal(stampInt){
	if (typeof(stampInt)!=='number' || stampInt <= 0){
		return false;
	}
	return true;
}

// @todo this is probably going to need to be revised
let projectRootPath = isInNodeModules() ? posixNormalize(path.normalize(`${__dirname}/../..`)) : posixNormalize(`${__dirname}`);
const callerDir = posixNormalize(process.cwd());
/* istanbul ignore if */
if (projectRootPath.indexOf(callerDir)===-1){
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
	replaceZeros: function(inputObj, replacement) {
		let keys = Object.keys(inputObj);
		for (let x = 0; x < keys.length; x++) {
			if (inputObj[keys[x]] === 0) {
				inputObj[keys[x]] = replacement;
			}
		}
		return inputObj;
	},
	/**
	* Test whether or not we are in a git initialized repo space / folder
	* @returns {boolean} Whether or not in git repo
	*/
	getIsInGitRepo: function(OPT_folder){
		let executeInPath = __dirname;
		if (typeof(OPT_folder)==='string'){
			executeInPath = path.normalize(OPT_folder);
		}
		try {
			childProc.execSync(`git status`, {
				cwd: executeInPath
			});
			return true;
		}
		catch (e){
			return false;
		}
	},
	replaceInObj,
	projectRootPath,
	projectRootPathTrailingSlash,
	getIsRelativePath: function(filePath){
		return !path.isAbsolute(filePath);
	},
	isInNodeModules,
	validateOptions,
	extractArrFromStr,
	getNullDestination,
	nullDestination,
	getIsValidStampVal
}
