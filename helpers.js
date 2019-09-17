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

// @todo this is probably going to need to be revised
const projectRootPath = isInNodeModules() ? posixNormalize(path.normalize(`${__dirname}/../..`)) : posixNormalize(`${__dirname}`);
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
	isInNodeModules
}
