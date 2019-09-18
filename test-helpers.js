// @ts-check
const childProc = require('child_process');

/**
 * Test if the last commit in the log is from self (auto add of cache file)
 * @param {string} gitDir - Path where the commit was made
 * @param {string} cacheFileName - Filename (not path) of the cache file that was added
 */
function wasLastCommitAutoAddCache(gitDir,cacheFileName){
	const gitCommitMsg = childProc.execSync(`git show -s --format=%s`,{
		cwd: gitDir
	}).toString();
	const changedFiles = childProc.execSync(`git show HEAD --name-only --format=%b`,{
		cwd: gitDir
	}).toString().trim();
	const commitMsgMatch = /AUTO: Updated/.test(gitCommitMsg);
	const changedFilesMatch = changedFiles === cacheFileName;
	return commitMsgMatch && changedFilesMatch;
}

module.exports = {
	wasLastCommitAutoAddCache
}
