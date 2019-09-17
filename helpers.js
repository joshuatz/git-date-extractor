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

const isInNodeModules = function(){
	const parentFolderPath = path.normalize(__dirname + '/../');
	if (path.basename(parentFolderPath)==='node_modules'){
		return true;
	}
	return false;
}

// @todo this is probably going to need to be revised
// const projectRootPath = posixNormalize(path.normalize(posixNormalize(__dirname + '../../../')));
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
		console.log(executeInPath);
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
	projectRootPath,
	projectRootPathTrailingSlash,
	getIsRelativePath: function(filePath){
		return !path.isAbsolute(filePath);
	},
	isInNodeModules
}
