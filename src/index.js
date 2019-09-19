// @ts-check
'use strict';

const readline = require('readline');
const fse = require('fs-extra');
const {posixNormalize, getIsInGitRepo, validateOptions, lazyAreObjsSame} = require('./helpers');
const {updateTimestampsCacheFile, getTimestampsFromFile} = require('./stamp-handler');
const FilelistHandler = require('./filelist-handler');

/**
* Main - called by CLI and the main export
* @param {InputOptions} options - input options
* @returns {object} - Stamp or info object
*/
function main(options) {
	/* istanbul ignore if */
	if (!getIsInGitRepo()) {
		throw (new Error('Fatal Error: You are not in a git initialized project space! Please run git init.'));
	}
	const optionsObj = validateOptions(options);
	/* istanbul ignore if */
	if (optionsObj.debug) {
		console.log(optionsObj);
	}
	/**
	* @type StampCache
	*/
	let timestampsCache = {};
	const readCacheFile = typeof (optionsObj.outputFileName) === 'string' && optionsObj.outputFileName.length > 0;
	let readCacheFileSuccess = false;
	let readCacheFileContents = {};
	const writeCacheFile = readCacheFile && optionsObj.outputToFile;
	// Load in cache if applicable
	if (readCacheFile) {
		if (fse.existsSync(optionsObj.outputFileName) === false) {
			fse.writeFileSync(optionsObj.outputFileName, '{}');
		} else {
			try {
				timestampsCache = JSON.parse(fse.readFileSync(optionsObj.outputFileName).toString());
				readCacheFileSuccess = true;
				readCacheFileContents = JSON.parse(JSON.stringify(timestampsCache));
			} catch (error) {
				console.warn(`Could not read in cache file @ ${optionsObj.outputFileName}`);
			}
		}
	}
	// Get filepaths
	const {filePaths} = new FilelistHandler(optionsObj);
	/**
	* Now iterate through filepaths to get stamps
	*/
	if (filePaths.length > 0) {
		// Add line break
		console.log('');
	}
	for (let f = 0; f < filePaths.length; f++) {
		let currFullPath = filePaths[f].fullPath;
		let currLocalPath = filePaths[f].relativeToProjRoot;
		// Nice progress indicator in console
		const consoleMsg = `Scraping Date info for file #${f + 1} / ${filePaths.length} ---> ${currLocalPath}`;
		if (process.stdout && readline) {
			readline.clearLine(process.stdout, 0);
			readline.cursorTo(process.stdout, 0, null);
			process.stdout.write(consoleMsg);
			// If this is the last loop, close out the line with a newline
			if (f === filePaths.length - 1) {
				process.stdout.write('\n');
			}
		} else {
			console.log(consoleMsg);
		}
		// Normalize path, force to posix style forward slash
		currFullPath = posixNormalize(currFullPath);
		currLocalPath = posixNormalize(currLocalPath);
		// Update obj
		timestampsCache[currLocalPath] = getTimestampsFromFile(currFullPath, timestampsCache, currLocalPath, optionsObj, false);
	}
	if (writeCacheFile) {
		// Check for diff
		if (!readCacheFileSuccess || !lazyAreObjsSame(readCacheFileContents, timestampsCache)) {
			updateTimestampsCacheFile(optionsObj.outputFileName, timestampsCache, optionsObj);
		} else {
			console.log('Saving of timestamps file skipped - nothing changed');
		}
	}
	return timestampsCache;
}

module.exports = {
	/**
	* Wrapper around main
	* @param {InputOptions} options - input options
	* @returns {object} - stamp object or info obj
	*/
	getStamps(options) {
		return main(options);
	}
};