'use strict';
const readline = require('readline');
const fse = require('fs-extra');
// @ts-ignore
const packageInfo = require('../package.json');
const {posixNormalize, getIsInGitRepo, validateOptions, lazyAreObjsSame, callerDir} = require('./helpers');
const {updateTimestampsCacheFile, getTimestampsFromFilesBulk} = require('./stamp-handler');
const FilelistHandler = require('./filelist-handler');

/**
* Main - called by CLI and the main export
* @param {import('./types').InputOptions} options - input options
* @param {function} [opt_cb] - Optional callback
* @returns {Promise<import('./types').StampCache>} - Stamp or info object
*/
async function main(options, opt_cb) {
	const perfTimings = {
		start: (new Date()).getTime(),
		stop: 0,
		elapsed: 0
	};
	const optionsObj = validateOptions(options);
	/* istanbul ignore if */
	if (optionsObj.debug) {
		console.log(`
			=== Git Date Extractor, DEBUG=ON ===
			                ${packageInfo.version}
			====================================
		`);
		console.log({
			finalizedOptions: optionsObj,
			callerDir
		});
	}
	/* istanbul ignore if */
	if (!getIsInGitRepo(optionsObj.projectRootPath)) {
		throw (new Error(`Fatal Error: You are not in a git initialized project space! Please run git init in ${optionsObj.projectRootPath}.`));
	}
	/**
	* @type {import('./types').StampCache}
	*/
	let timestampsCache = {};
	const readCacheFile = typeof (optionsObj.outputFileName) === 'string' && optionsObj.outputFileName.length > 0;
	let readCacheFileSuccess = false;
	let readCacheFileContents = {};
	const writeCacheFile = readCacheFile && optionsObj.outputToFile;
	// Load in cache if applicable
	if (readCacheFile) {
		if (fse.existsSync(optionsObj.outputFileName) === false) {
			if (optionsObj.debug) {
				console.log(`Warning: Cache file ${optionsObj.outputFileName} does not already exist.`);
			}
			if (optionsObj.outputToFile) {
				fse.writeFileSync(optionsObj.outputFileName, '{}');
			}
		} else {
			try {
				timestampsCache = JSON.parse(fse.readFileSync(optionsObj.outputFileName).toString());
				readCacheFileSuccess = true;
				// Lazy clone obj
				readCacheFileContents = JSON.parse(JSON.stringify(timestampsCache));
			// eslint-disable-next-line no-unused-vars
			} catch (error) {
				console.log(`Warning: Could not read in cache file @ ${optionsObj.outputFileName}`);
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
		console.log(`${filePaths.length} files queued up. Starting scrape...\n`);
	}

	/**
	 * @type {Array<{fullPath: string, localPath: string}>}
	 */
	const filesToGet = [];

	filePaths.forEach((filePathMeta, index) => {
		let currFullPath = filePathMeta.fullPath;
		let currLocalPath = filePathMeta.relativeToProjRoot;
		/* istanbul ignore if */
		if (optionsObj.debug) {
			// Nice progress indicator in console
			const consoleMsg = `Starting scrape of date info for file #${index + 1} / ${filePaths.length} ---> ${currLocalPath}`;
			if (process.stdout && readline) {
				readline.clearLine(process.stdout, 0);
				readline.cursorTo(process.stdout, 0, null);
				process.stdout.write(consoleMsg);
				// If this is the last loop, close out the line with a newline
				if (index === filePaths.length - 1) {
					process.stdout.write('\n');
				}
			} else {
				console.log(consoleMsg);
			}
		}
		// Normalize path, force to posix style forward slash
		currFullPath = posixNormalize(currFullPath);
		currLocalPath = posixNormalize(currLocalPath);

		filesToGet.push({
			fullPath: currFullPath,
			localPath: currLocalPath
		});
	});

	// Get stamps in bulk
	const results = await getTimestampsFromFilesBulk(filesToGet.map(f => {
		return {
			fullFilePath: f.fullPath,
			cacheKey: f.localPath,
			resultKey: f.localPath
		};
	}), optionsObj, timestampsCache, false);
	// Update results object
	timestampsCache = {
		...timestampsCache,
		...results
	};

	// Check if we need to write out results to disk
	if (writeCacheFile) {
		// Check for diff
		if (!readCacheFileSuccess || !lazyAreObjsSame(readCacheFileContents, timestampsCache)) {
			updateTimestampsCacheFile(optionsObj.outputFileName, timestampsCache, optionsObj);
		} else {
			console.log('Saving of timestamps file skipped - nothing changed');
		}
	}

	// Check for callback
	if (typeof (opt_cb) === 'function') {
		opt_cb(timestampsCache);
	}

	perfTimings.stop = (new Date()).getTime();
	perfTimings.elapsed = perfTimings.stop - perfTimings.start;
	console.log(`Total execution time = ${(perfTimings.elapsed / 1000).toFixed(2)} seconds.`);
	return timestampsCache;
}

/**
* Run the extractor with options
* @param {import('./types').InputOptions} options - input options
* @param {function} [opt_cb] - Optional callback
* @returns {Promise<import('./types').StampCache>} - stamp object or info obj
*/
async function getStamps(options, opt_cb) {
	return main(options, opt_cb);
}

module.exports = {
	getStamps
};
