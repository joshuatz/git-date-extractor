// @ts-check

const childProc = require('child_process');
const fse = require('fs-extra');
const { replaceZeros, projectRootPath, nullDestination } = require('./helpers');

/**
* Updates the timestamp cache file and checks it into source control, depending on settings
* @param {string} cacheFilePath - the path of the files to save the cache out to
* @param {Object} jsonObj - The updated timestamps JSON to save to file
* @param {FinalizedOptions} optionsObj - Options
*/
function updateTimestampsCacheFile(cacheFilePath, jsonObj, optionsObj){
	const shouldGitAdd = typeof(optionsObj.outputFileGitAdd)==='boolean' ? optionsObj.outputFileGitAdd : true;
	const gitDir = typeof(optionsObj.projectRootPath)==='string' ? optionsObj.projectRootPath : projectRootPath;
	const gitCommitHook = optionsObj.gitCommitHook;
	/**
	* Save back updated timestamps to file
	*/
	fse.writeFileSync(cacheFilePath, JSON.stringify(jsonObj, null, 2));
	/**
	* Since the timestamps file should be checked into source control, and we just modified it, re-add to commit and amend
	*/
	if (shouldGitAdd){
		if (gitCommitHook.toString() === 'pre' || gitCommitHook.toString() === 'post') {
			// Stage the changed file
			childProc.execSync(`git add ${cacheFilePath}`,{
				cwd: gitDir
			});
		}
		if (gitCommitHook.toString() === 'post') {
			// Since the commit has already happened, we need to re-stage the changed timestamps file, and then commit it as a new commit
			// WARNING: We cannot use git commit --amend because that will trigger an endless loop if this file is triggered on a git post-commit loop!
			// Although the below will trigger the post-commit hook again, the loop should be blocked by the filepath checker at the top of the script that excludes the timestamp JSON file from being tracked
			childProc.execSync(`git commit -m "AUTO: Updated ${cacheFilePath}"`,{
				cwd: gitDir
			});
		}
	}
}

/**
* Get timestamps for a given file
* @param {string} fullFilePath - The *full* file path to get stamps for
* @param {string} [cacheKey] - What is the stamp currently stored under for this file?
* @param {StampCache} [cache] - Object with key/pair values corresponding to valid stamps
* @param {boolean} forceCreatedRefresh - If true, any existing created stamps in cache will be ignored, and re-calculated
* @param {GitCommitHook} [gitCommitHook]
* @returns {StampObject}
*/
function getTimestampsFromFile(fullFilePath, cache, cacheKey, gitCommitHook, forceCreatedRefresh){
	let ignoreCreatedCache = typeof(forceCreatedRefresh)==='boolean' ? forceCreatedRefresh : false;
	let timestampsCache = typeof(cache)==='object' ? cache : {};
	/**
	 * @type {ChildProcExecOptions}
	 */
	const execOptions = {
		stdio: 'pipe'
	}
	// Lookup values in cache
	/**
	* @type {StampObject}
	*/
	let dateVals = timestampsCache[cacheKey];
	dateVals = typeof (dateVals) === 'object' ? dateVals : {};
	try {
		if (!dateVals.created || ignoreCreatedCache){
			// Get the created stamp by looking through log and following history
			/**
			* @type {any}
			*/
			let createdStamp = childProc.execSync(`git log --pretty=format:%at -- "${fullFilePath}" | tail -n 1`,execOptions).toString();
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
			modifiedStamp = childProc.execSync(`git log --pretty=format:%at --follow -- "${fullFilePath}" | sort | tail -n 1`,execOptions).toString();
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
	updateTimestampsCacheFile,
	getTimestampsFromFile
}
