'use strict';
const readline = require('readline');
const fse = require('fs-extra');
// @ts-ignore
const packageInfo = require('../package.json');
const {posixNormalize, getIsInGitRepo, validateOptions, lazyAreObjsSame, callerDir} = require('./helpers');
const {updateTimestampsCacheFile, getTimestampsFromFile} = require('./stamp-handler');
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
		throw (new Error('Fatal Error: You are not in a git initialized project space! Please run git init.'));
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
			fse.writeFileSync(optionsObj.outputFileName, '{}');
		} else {
			try {
				timestampsCache = JSON.parse(fse.readFileSync(optionsObj.outputFileName).toString());
				readCacheFileSuccess = true;
				readCacheFileContents = JSON.parse(JSON.stringify(timestampsCache));
			// eslint-disable-next-line no-unused-vars
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
		console.log(`${filePaths.length} files queued up. Starting scrape...\n`);
	}
	/**
	 * @type {Array<Promise<any>>}
	 */
	const promiseQueue = [];

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

		const asyncResolver = async () => {
			const result = await getTimestampsFromFile(currFullPath, optionsObj, timestampsCache, currLocalPath, false);
			// Update results object
			timestampsCache[currLocalPath] = result;
			return result;
		};
		promiseQueue.push(asyncResolver());
	});

	// Wait for all the files to be processed
	await Promise.all(promiseQueue);

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
* Wrapper around main
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
