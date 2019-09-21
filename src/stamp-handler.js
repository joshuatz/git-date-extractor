// @ts-check

const childProc = require('child_process');
const fse = require('fs-extra');
const {replaceZeros, getIsInGitRepo, getIsValidStampVal, getFsBirth} = require('./helpers');

/**
* Updates the timestamp cache file and checks it into source control, depending on settings
* @param {string} cacheFilePath - the path of the files to save the cache out to
* @param {Object} jsonObj - The updated timestamps JSON to save to file
* @param {FinalizedOptions} optionsObj - Options
*/
function updateTimestampsCacheFile(cacheFilePath, jsonObj, optionsObj) {
	const {gitCommitHook} = optionsObj;
	const gitDir = optionsObj.projectRootPath;
	let shouldGitAdd = false;
	if (typeof (optionsObj.outputFileGitAdd) === 'boolean') {
		shouldGitAdd = optionsObj.outputFileGitAdd;
	} else if (gitCommitHook.toString() !== 'none') {
		shouldGitAdd = true;
	}
	/**
	* Save back updated timestamps to file
	*/
	fse.writeFileSync(cacheFilePath, JSON.stringify(jsonObj, null, 2));
	/**
	* Since the timestamps file should be checked into source control, and we just modified it, re-add to commit and amend
	*/
	if (shouldGitAdd && getIsInGitRepo(gitDir)) {
		// Stage the changed file
		childProc.execSync(`git add ${cacheFilePath}`, {
			cwd: gitDir
		});
		if (gitCommitHook.toString() === 'post') {
			// Since the commit has already happened, we need to re-stage the changed timestamps file, and then commit it as a new commit
			// WARNING: We cannot use git commit --amend because that will trigger an endless loop if this file is triggered on a git post-commit loop!
			// Although the below will trigger the post-commit hook again, the loop should be blocked by the filepath checker at the top of the script that excludes the timestamp JSON file from being tracked
			childProc.execSync(`git commit -m "AUTO: Updated ${optionsObj.outputFileName}"`, {
				cwd: gitDir
			});
		}
	}
}

/**
* Get timestamps for a given file
* @param {string} fullFilePath - The *full* file path to get stamps for
* @param {StampCache} [cache] - Object with key/pair values corresponding to valid stamps
* @param {string} [cacheKey] - What is the stamp currently stored under for this file?
* @param {FinalizedOptions} optionsObj - Options
* @param {boolean} forceCreatedRefresh - If true, any existing created stamps in cache will be ignored, and re-calculated
* @returns {StampObject} - Timestamp object for file
*/
// eslint-disable-next-line max-params
function getTimestampsFromFile(fullFilePath, cache, cacheKey, optionsObj, forceCreatedRefresh) {
	const {gitCommitHook} = optionsObj;
	const ignoreCreatedCache = typeof (forceCreatedRefresh) === 'boolean' ? forceCreatedRefresh : false;
	const timestampsCache = typeof (cache) === 'object' ? cache : {};
	/**
	 * @type {object}
	 */
	const execOptions = {
		stdio: 'pipe',
		cwd: optionsObj.projectRootPath
	};
	// Lookup values in cache
	/**
	* @type {StampObject}
	*/
	let dateVals = timestampsCache[cacheKey];
	dateVals = typeof (dateVals) === 'object' ? dateVals : {
		created: 0,
		modified: 0
	};
	try {
		/* istanbul ignore else */
		if (!dateVals.created || ignoreCreatedCache) {
			// Get the created stamp by looking through log and following history
			/**
			* @type {any}
			*/
			let createdStamp = childProc.execSync(`git log --pretty=format:%at -- "${fullFilePath}" | tail -n 1`, execOptions).toString();
			createdStamp = Number(createdStamp);
			if (!getIsValidStampVal(createdStamp) && gitCommitHook.toString() !== 'post') {
				// During pre-commit, a file could be being added for the first time, so it wouldn't show up in the git log. We'll fall back to OS stats here
				// createdStamp = Math.floor(fse.statSync(fullFilePath).birthtimeMs / 1000);
				createdStamp = getFsBirth(fullFilePath).birthtime;
			}
			if (Number.isNaN(createdStamp) === false) {
				dateVals.created = createdStamp;
			}
		}
		// Always update modified stamp regardless
		let modifiedStamp = null;
		if (gitCommitHook === 'none' || gitCommitHook === 'post') {
			// If this is running after the commit that modified the file, we can use git log to pull the modified time out
			modifiedStamp = childProc.execSync(`git log --pretty=format:%at --follow -- "${fullFilePath}" | sort | tail -n 1`, execOptions).toString();
		}
		modifiedStamp = Number(modifiedStamp);
		if (gitCommitHook === 'pre' || !getIsValidStampVal(modifiedStamp)) {
			// If this is running before the changed files have actually be commited, they either won't show up in the git log, or the modified time in the log will be from one commit ago, not the current
			// Pull modified time from file itself
			modifiedStamp = Math.floor(fse.statSync(fullFilePath).mtimeMs / 1000);
		}
		if (Number.isNaN(modifiedStamp) === false) {
			dateVals.modified = modifiedStamp;
		}
		// Check for zero values - this might be the case if there is no git history - new file
		// If there is a zero, replace with current Unix stamp, but make sure to convert from JS MS to regular S
		dateVals = replaceZeros(dateVals, Math.floor((new Date()).getTime() / 1000));
	} catch (error) {
		/* istanbul ignore next */
		console.log(`getting git dates failed for ${fullFilePath}`);
		/* istanbul ignore next */
		console.error(error);
	}
	return dateVals;
}

module.exports = {
	updateTimestampsCacheFile,
	getTimestampsFromFile
};
