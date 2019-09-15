// @ts-check
'use strict';

import {posixNormalize, replaceZeros} from './helpers';

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


/**
 * Updates the timestamp cache file and checks it into source control, depending on settings
 * @param {Object} jsonObj - The updated timestamps JSON to save to file
 * @param {GitCommitHook} [gitCommitHook] - How this script is running
 */
function updateTimestampsCacheFile(jsonObj, gitCommitHook){
	/**
	 * Save back updated timestamps to file
	 */
	fse.writeFileSync(timestampsCacheFilepath, JSON.stringify(jsonObj, null, 2));
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
}

/**
 * Get timestamps for a given file
 * @param {string} fullFilePath - The *full* file path to get stamps for
 * @param {string | null} cacheKey - What is the stamp currently stored under for this file?
 * @param {boolean} forceCreatedRefresh - If true, any existing created stamps in cache will be ignored, and re-calculated
 * @param {GitCommitHook} [gitCommitHook]
 * @returns {StampObject}
 */
function getTimestampsFromFile(fullFilePath, cacheKey, gitCommitHook, forceCreatedRefresh){
	let ignoreCreatedCache = typeof(forceCreatedRefresh)==='boolean' ? forceCreatedRefresh : false;
	// Lookup values in cache
	let dateVals = timestampsCache[cacheKey];
	dateVals = dateVals && typeof (dateVals) === 'object' ? dateVals : {};
	try {
		if (!dateVals.created || ignoreCreatedCache){
			// Get the created stamp by looking through log and following history
			/**
			 * @type {any}
			 */
			let createdStamp = childProc.execSync(`git log --pretty=format:%at -- "${fullFilePath}" | tail -n 1`).toString();
			createdStamp = Number(createdStamp);
			if (Number.isNaN(createdStamp) === true && gitCommitHook.toString() !== 'post') {
				// During pre-commit, a file could be being added for the first time, so it wouldn't show up in the git log. We'll fall back to OS stats here
				createdStamp = Math.floor(fse.lstatSync(fullFilePath).birthtimeMs / 1000);
			}
			if (Number.isNaN(createdStamp) === false) {
				dateVals.created = createdStamp;
			}
		}
		// Always update modified stamp regardless
		let modifiedStamp = null;
		if (gitCommitHook === 'none' || gitCommitHook === 'post') {
			// If this is running after the commit that modified the file, we can use git log to pull the modified time out
			modifiedStamp = childProc.execSync(`git log --pretty=format:%at --follow -- "${fullFilePath}" | sort | tail -n 1`).toString();
		}
		else if (gitCommitHook === 'pre') {
			// If this is running before the changed files have actually be commited, they either won't show up in the git log, or the modified time in the log will be from one commit ago, not the current
			// Pull modified time from file itself
			modifiedStamp = Math.floor(fse.lstatSync(fullFilePath).mtimeMs / 1000);
		}
		modifiedStamp = Number(modifiedStamp);
		if (Number.isNaN(modifiedStamp) === false) {
			dateVals.modified = modifiedStamp;
		}
		// Check for zero values - this might be the case if there is no git history - new file
		// If there is a zero, replace with current Unix stamp, but make sure to convert from JS MS to regular S
		dateVals = replaceZeros(dateVals, Math.floor((new Date()).getTime() / 1000));
	}
	catch (e){
		console.log(`getting git dates failed for ${fullFilePath}`);
		console.error(e);
	}
	return dateVals;
}

module.exports = {
	/**
	 * 
	 * @param {Options} options 
	 */
	getStamps: function(options){
		//
	}
}

/**
 * Options
 */
/**
 * @typedef {Object<string, any>} Options
 * @property {boolean} outputToFile - Whether or not the timestamps should be saved to file
 * @property {string} [outputFileName] - the filename to save the timestamps to
 * @property {string[]} files - Filenames to process
 * @property {string[]} [onlyIn] - Only update for files in these directories
 * @property {GitCommitHook} [gitCommitHook] - What triggered the execution
 */

/**
 * @type Options
 */
let optionDefaults = {
	outputToFile: true,
	files: ['123'],
}


/**
 * 
 * @param {Options} optionsObj 
 */
function main(optionsObj){
	// Load in cache if applicable
	if (optionsObj.outputFileName && optionsObj.outputFileName.length > 0){
		//
	}
	// Get filepaths
	let filePaths = (new FilelistHandler(optionsObj)).filePaths;
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
		// Update obj
		timestampsCache[currLocalPath] = getTimestampsFromFile(currFullPath, currLocalPath, optionsObj.gitCommitHook, false);
	}
	updateTimestampsCacheFile(timestampsCache);
}








let FilelistHandler = (function(){
	/**
	 * 
	 * @param {Options} optionsObj 
	 */
	function FilelistHandlerInner(optionsObj){
		/**
		 * @type Array<{localPath:string, fullPath: string}>
		 */
		this.filePaths = [];
		// Process input files
		for (let x=0; x<optionsObj.files.length; x++){
			let filePath = optionsObj.files[x];
			filePath = path.normalize(projectRootPath + filePath);
			this.pushFilePath(filePath, true);
		}
		// If no files were passed in by arg, and this is not running on a git hook...
		if (this.filePaths.length === 0 && (!optionsObj.gitCommitHook || optionsObj.gitCommitHook.toString() === 'none')){
			// Get *all* files contained within content dirs
			for (let x = 0; x < contentDirs.length; x++) {
				let fullContentDirPath = path.normalize(projectRootPath + contentDirs[x]);
				let paths = walkdir.sync(contentDirs[x]);
				for (let p = 0; p < paths.length; p++) {
					this.pushFilePath(paths[p], false);
				}
			}
		}
	}
	/**
	 * Add a file to the queue of file paths to retrieve dates for
	 * @param {string} filePath  - The path of the file
	 * @param {boolean} [checkExists]  - If the func should check that the file actually exists before adding
	 */
	FilelistHandlerInner.prototype.pushFilePath = function(filePath,checkExists){
		if (this.getShouldTrackFile(filePath,checkExists)){
			this.filePaths.push({
				localPath: filePath.replace(projectRootPath, ''),
				fullPath: filePath
			});
			return true;
		}
		return false;
	}
	/**
	 * 
	 * @param {string} filePath - The path of the file
	 * @param {boolean} [checkExists]  - If the func should check that the file actually exists before adding
	 */
	FilelistHandlerInner.prototype.getShouldTrackFile = function(filePath, checkExists){
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
		return true;
	}
	return FilelistHandlerInner;
})();