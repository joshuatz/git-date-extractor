// @ts-check

const fse = require('fs-extra');
const path = require('path');
const walkdir = require('walkdir');
const { posixNormalize, projectRootPath, projectRootPathTrailingSlash, getIsRelativePath } = require('./helpers');

let FilelistHandler = (function(){
	/**
	*
	* @param {Options} optionsObj
	*/
	function FilelistHandlerInner(optionsObj){
		this.inputOptions = optionsObj;
		/**
		* @type Array<{relativeToProjRoot:string, fullPath: string}>
		*/
		this.filePaths = [];
		// Parse filter options
		this.contentDirs = Array.isArray(this.inputOptions.onlyIn) ? this.inputOptions.onlyIn : [projectRootPath];
		this.fullPathContentDirs = this.contentDirs.map(function(pathStr){
			return path.normalize(getIsRelativePath(pathStr) ? (projectRootPathTrailingSlash + pathStr) : pathStr);
		});
		this.restrictByDir = Array.isArray(this.inputOptions.onlyIn) && this.inputOptions.onlyIn.length > 0;
		this.usesCache = typeof(optionsObj.outputFileName)==='string';
		this.usesBlockFiles = Array.isArray(optionsObj.blockFiles) && optionsObj.blockFiles.length > 0;
		// Process input files
		for (let x=0; x<optionsObj.files.length; x++){
			let filePath = optionsObj.files[x];
			filePath = path.normalize(getIsRelativePath(filePath) ? (projectRootPathTrailingSlash + filePath) : filePath);
			this.pushFilePath(filePath, true);
		}
		// If no files were passed in by arg, and this is not running on a git hook...
		if (this.filePaths.length === 0 && (!optionsObj.gitCommitHook || optionsObj.gitCommitHook.toString() === 'none')){
			// Get *all* files contained within content dirs
			for (let x = 0; x < this.fullPathContentDirs.length; x++) {
				let fullContentDirPath = this.fullPathContentDirs[x];
				let paths = walkdir.sync(fullContentDirPath);
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
				relativeToProjRoot: path.normalize(filePath).replace(path.normalize(projectRootPathTrailingSlash), ''),
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
		if (this.usesCache && filePath.indexOf(posixNormalize(this.inputOptions.outputFileName)) !== -1) {
			return false;
		}
		if (this.restrictByDir) {
			let found = false;
			// Block tracking any files outside the indicated content dirs
			for (let x = 0; x < this.fullPathContentDirs.length; x++) {
				let fullContentDirPath = this.fullPathContentDirs[x];
				if (filePath.indexOf(posixNormalize(fullContentDirPath)) !== -1) {
					found = true;
				}
			}
			if (!found) {
				// not in content dirs - block adding
				return false;
			}
		}
		// Block tracking any on blacklist
		if (this.usesBlockFiles && this.inputOptions.blockFiles.indexOf(filePath)!==-1){
			return false;
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

module.exports = FilelistHandler;
