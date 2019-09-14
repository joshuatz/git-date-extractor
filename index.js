'use strict';

// @ts-check
// Core Node
const path = require('path');
const readline = require('readline');
const childProc = require('child_process');
// Extras
const fse = require('fs-extra');
const walkdir = require('walkdir');
// globals
const contentDirs = ['images', 'md'];
const projectRootPath = posixNormalize(path.normalize(posixNormalize(__dirname + '../../../')));
const timestampsCacheFilepath = path.normalize(projectRootPath + 'timestamps-cache.json');
// The main timestamp cache file
let timestampsCache = require(timestampsCacheFilepath);
// Flag - change to false if you want to track files outside of those directories in contentDirs
const dontTrackOutsideContentDirs = true;

// This should be filled later
/**
 * @type Array<{localPath:string, fullPath: string}>
 */
let filePaths = [];

// Argument mapping to variables
// 'pre' | 'post' | 'none'
/**
 * @type {"pre" | "post" | "none" }
 */
let gitCommitHook = 'none';
let argMappings = {
	'--commitAction': function (val) {
		if (['pre', 'post', 'none'].indexOf(val) !== -1) {
			gitCommitHook = val;
		}
	}
}
/**
 * Map strings to arguments and their procesor funcs
 * @param {string} val - the string to map to an argument
 * @returns {boolean} - whether or not the string was successfully mapped to an argument
 */
function argMapper(val) {
	let argRegRes = /(--[^=]+)=([^\s]+)/.exec(val);
	if (argRegRes) {
		let arg = argRegRes[1];
		let argVal = argRegRes[2];
		if (typeof (argMappings[arg]) === 'function') {
			// Pass arg val to callback function
			argMappings[arg](argVal);
			return true;
		}
	}
	return false;

}

/**
 * Get all the filepaths
 */
let argsArr = process.argv.slice(2);
if (argsArr.length > 0) {
	for (let x = 0; x < argsArr.length; x++) {
		/**
		 * Assume that filepaths will be passed in args relative to project root.
		 * So someone might pass "package.json", but that should map to {projectRootFullPath}/package.json
		 * In the case of bash or git hook, first arg might be array containing filenames.
		 */
		let arg = argsArr[x];
		let filePath = arg;
		if (Array.isArray(filePath)) {
			for (let r = 0; r < filePath.length; r++) {
				arg = filePath[r];
				let argFilePath = path.normalize(projectRootPath + arg);
				argMapper(arg) ? null : pushFilePath(argFilePath, true);
			}
		}
		else {
			filePath = path.normalize(projectRootPath + filePath);
			argMapper(arg) ? null : pushFilePath(filePath, true);
		}
	}
}

// If no files were passed in by arg, and this is not running on a git hook...
if (filePaths.length === 0 && gitCommitHook.toString() === 'none') {
	// Get *all* files contained within content dirs
	for (let x = 0; x < contentDirs.length; x++) {
		let fullContentDirPath = path.normalize(projectRootPath + contentDirs[x]);
		let paths = walkdir.sync(contentDirs[x]);
		for (let p = 0; p < paths.length; p++) {
			pushFilePath(paths[p], false);
		}
	}
}

/**
 * Add a file to the queue of file paths to retrieve dates for
 * @param {string} filePath  - The path of the file
 * @param {boolean} checkExists  - If the func should check that the file actually exists before adding
 */
function pushFilePath(filePath, checkExists) {
	filePath = posixNormalize(filePath);
	checkExists = typeof (checkExists) === "boolean" ? checkExists : false;
	// Block tracking the actual timestamps file
	if (filePath.indexOf(posixNormalize(timestampsCacheFilepath)) !== -1) {
		return false;
	}
	if (dontTrackOutsideContentDirs) {
		let found = false;
		// Block tracking any files outside the indicated content dirs
		for (let x = 0; x < contentDirs.length; x++) {
			let fullContentDirPath = path.normalize(projectRootPath + contentDirs[x]);
			if (filePath.indexOf(posixNormalize(fullContentDirPath)) !== -1) {
				found = true;
			}
		}
		if (!found && !/\/README.md$/.test(filePath)) {
			// not in content dirs - block adding
			return false;
		}
	}
	if (fse.lstatSync(filePath).isDirectory() === true) {
		return false;
	}
	if (checkExists) {
		if (fse.existsSync(filePath) === false) {
			return false;
		}
	}
	filePaths.push({
		localPath: filePath.replace(projectRootPath, ''),
		fullPath: filePath
	});
	return true;
}

/**
 * Now iterate through filepaths to get stamps
 */
if (filePaths.length > 0) {
	// Add line break
	console.log('');
}
for (let f = 0; f < filePaths.length; f++) {
	let currFullPath = filePaths[f].fullPath;
	let currLocalPath = filePaths[f].localPath;
	// Nice progress indicator in console
	if (process.stdout && readline) {
		readline.clearLine(process.stdout, 0);
		readline.cursorTo(process.stdout, 0, null);
		process.stdout.write(`Scraping Date info for file #${f + 1} / ${filePaths.length} ---> ${currLocalPath}`);
		// If this is the last loop, close out the line with a newline
		if (f === filePaths.length - 1) {
			process.stdout.write('\n');
		}
	}
	// Normalize path, force to posix style forward slash
	currFullPath = posixNormalize(currFullPath);
	// Lookup values in cache
	let dateVals = timestampsCache[currLocalPath];
	dateVals = dateVals && typeof (dateVals) === 'object' ? dateVals : {};
	try {
		if (!dateVals.created) {
			// Get the created stamp by looking through log and following history
			/**
			 * @type {any}
			 */
			let createdStamp = childProc.execSync(`git log --pretty=format:%at -- "${currFullPath}" | tail -n 1`).toString();
			createdStamp = Number(createdStamp);
			if (Number.isNaN(createdStamp) === true && gitCommitHook.toString() !== 'post') {
				// During pre-commit, a file could be being added for the first time, so it wouldn't show up in the git log. We'll fall back to OS stats here
				createdStamp = Math.floor(fse.lstatSync(currFullPath).birthtimeMs / 1000);
			}
			if (Number.isNaN(createdStamp) === false) {
				dateVals.created = createdStamp;
			}
		}
		else {
			// console.log(`skipping getting created stamp for ${currFilePath}`);
		}
		// Always update modified stamp regardless
		let modifiedStamp = null;
		if (gitCommitHook === 'none' || gitCommitHook === 'post') {
			// If this is running after the commit that modified the file, we can use git log to pull the modified time out
			modifiedStamp = childProc.execSync(`git log --pretty=format:%at --follow -- "${currFullPath}" | sort | tail -n 1`).toString();
		}
		else if (gitCommitHook === 'pre') {
			// If this is running before the changed files have actually be commited, they either won't show up in the git log, or the modified time in the log will be from one commit ago, not the current
			// Pull modified time from file itself
			modifiedStamp = Math.floor(fse.lstatSync(currFullPath).mtimeMs / 1000);
		}
		modifiedStamp = Number(modifiedStamp);
		if (Number.isNaN(modifiedStamp) === false) {
			dateVals.modified = modifiedStamp;
		}
		// Check for zero values - this might be the case if there is no git history - new file
		// If there is a zero, replace with current Unix stamp, but make sure to convert from JS MS to regular S
		dateVals = replaceZeros(dateVals, Math.floor((new Date()).getTime() / 1000));
		// Update obj
		timestampsCache[currLocalPath] = dateVals;
	}
	catch (e) {
		console.log(`getting git dates failed for ${currFullPath}`);
		console.error(e);
	}
}

/**
 * Save back updated timestamps to file
 */
fse.writeFileSync(timestampsCacheFilepath, JSON.stringify(timestampsCache, null, 2));
/**
 * Since the timestamps file should be checked into source control, and we just modified it, re-add to commit and amend
 */
if (gitCommitHook.toString() === 'pre' || gitCommitHook.toString() === 'post') {
	// Stage the changed file
	childProc.execSync(`git add ${timestampsCacheFilepath}`);
}
if (gitCommitHook.toString() === 'post') {
	// Since the commit has already happened, we need to re-stage the changed timestamps file, and then commit it as a new commit
	// WARNING: We cannot use git commit --amend because that will trigger an endless loop if this file is triggered on a git post-commit loop!
	// Although the below will trigger the post-commit hook again, the loop should be blocked by the filepath checker at the top of the script that excludes the timestamp JSON file from being tracked
	childProc.execSync(`git commit -m "AUTO: Updated ${timestampsCacheFilepath}"`);
}


/**
 * Helper functions
 */

/**
 * Replaces any root level values on an object that are 0, with a different value
 * @param {object} inputObj  - The object to replace zeros on
 * @param {any} replacement - what to replace the zeros with
 */
function replaceZeros(inputObj, replacement) {
	let keys = Object.keys(inputObj);
	for (let x = 0; x < keys.length; x++) {
		if (inputObj[keys[x]] === 0) {
			inputObj[keys[x]] = replacement;
		}
	}
	return inputObj;
}

/**
 * Normalizes and forces a filepath to the forward slash variant
 * Example: \dir\file.txt will become /dir/file.txt
 * @param {string} filePath the path to normalize
 */
function posixNormalize(filePath) {
	return path.normalize(filePath).replace(/[\/\\]{1,2}/gm, '/');
}

module.exports = (input, { postfix = 'rainbows' } = {}) => {
	if (typeof input !== 'string') {
		throw new TypeError(`Expected a string, got ${typeof input}`);
	}

	return `${input} & ${postfix}`;
};
