// @ts-check

const fse = require('fs-extra');
const path = require('path');
const walkdir = require('walkdir');
const { posixNormalize, getIsRelativePath } = require('./helpers');
const { debugLog } = require('./tst-helpers');

let FilelistHandler = (function(){
	const internalDirBlockList = [
		'node_modules',
		'.git'
	];
	const internalDirBlockPatterns = [
		// Block all .___ directories
		/^\..*$/,
		// Block all __tests__ and similar
		/^__[^_]+__$/
	];
	const internalFileBlockPatterns = [
		// .__ files
		/^\..+$/,
	]
	/**
	*
	* @param {FinalizedOptions} optionsObj
	*/
	function FilelistHandlerInner(optionsObj){
		// debugLog(optionsObj);
		this.inputOptions = optionsObj;
		/**
		* @type Array<{relativeToProjRoot:string, fullPath: string}>
		*/
		this.filePaths = [];
		// Parse filter options
		this.contentDirs = Array.isArray(this.inputOptions.onlyIn) && this.inputOptions.onlyIn.length > 0  ? this.inputOptions.onlyIn : [optionsObj.projectRootPath];
		this.fullPathContentDirs = this.contentDirs.map(function(pathStr){
			return path.normalize(getIsRelativePath(pathStr) ? (optionsObj.projectRootPath + '/' + pathStr) : pathStr);
		});
		this.alwaysAllowFileNames = Array.isArray(this.inputOptions.allowFiles) && this.inputOptions.allowFiles.length > 0 ? this.inputOptions.allowFiles : [];
		this.alwaysAllowFilePaths = this.alwaysAllowFileNames.map(function(pathStr){
			return path.normalize(getIsRelativePath(pathStr) ? (optionsObj.projectRootPath + '/' + pathStr) : pathStr);
		});
		this.restrictByDir = Array.isArray(this.inputOptions.onlyIn) && this.inputOptions.onlyIn.length > 0;
		this.usesCache = typeof(optionsObj.outputFileName)==='string';
		this.usesBlockFiles = Array.isArray(optionsObj.blockFiles) && optionsObj.blockFiles.length > 0;
		// Process input files
		for (let x=0; x<optionsObj.files.length; x++){
			let filePath = optionsObj.files[x];
			filePath = path.normalize(getIsRelativePath(filePath) ? (optionsObj.projectRootPathTrailingSlash + filePath) : filePath);
			this.pushFilePath(filePath, true);
		}
		// If no files were explicitly passed in through options...
		if (this.filePaths.length === 0){
			// Get *all* files contained within content dirs
			// debugLog(this.fullPathContentDirs);
			for (let x = 0; x < this.fullPathContentDirs.length; x++) {
				let fullContentDirPath = this.fullPathContentDirs[x];
				let paths = walkdir.sync(fullContentDirPath,function(pathStr,stat){
					const pathDirName = path.basename(pathStr);
					// debugLog(pathDirName);
					// Check internal block list of directories
					if (internalDirBlockList.indexOf(pathDirName)!==-1){
						this.ignore(pathStr);
					}
					for (let db=0; db < internalDirBlockPatterns.length; db++){
						let blocked = false;
						if (internalDirBlockPatterns[db].test(pathDirName)){
							blocked = true;
							// debugLog('Blocked based on DirBlockPatt - ' + pathDirName);
						}
						if (blocked){
							this.ignore(pathStr);
							break;
						}
					}
				});
				for (let p = 0; p < paths.length; p++) {
					let blocked = false;
					const fileOrDirName = path.basename(paths[p]);
					for (let b=0; b<internalFileBlockPatterns.length; b++){
						if (internalFileBlockPatterns[b].test(fileOrDirName)){
							blocked = true;
							// debugLog('blocked based on fileBlockPatt - ' + fileOrDirName);
							break;
						}
					}
					if (!blocked){
						this.pushFilePath(paths[p], false);
					}
				}
			}
		}
		/* istanbul ignore if */
		if (optionsObj.debug){
			console.log(this.filePaths);
		}
	}
	/**
	* Add a file to the queue of file paths to retrieve dates for
	* @param {string} filePath  - The path of the file
	* @param {boolean} [checkExists]  - If the func should check that the file actually exists before adding
	*/
	FilelistHandlerInner.prototype.pushFilePath = function(filePath,checkExists){
		if (this.getShouldTrackFile(filePath,checkExists)){
			// debugLog(this.inputOptions.projectRootPathTrailingSlash);
			this.filePaths.push({
				relativeToProjRoot: path.normalize(filePath).replace(path.normalize(this.inputOptions.projectRootPathTrailingSlash), ''),
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
		let shouldBlock = false;
		filePath = posixNormalize(filePath);
		const fileName = path.basename(filePath);
		checkExists = typeof (checkExists) === "boolean" ? checkExists : false;
		// Block tracking the actual timestamps file
		if (this.usesCache && filePath.indexOf(posixNormalize(this.inputOptions.outputFileName)) !== -1) {
			// Only let this be overrwritten by allowFiles whitelist if gitcommithook is equal to 'none' or unset
			if (this.inputOptions.gitCommitHook==='pre' || this.inputOptions.gitCommitHook==='post'){
				return false;
			}
			shouldBlock = true;
		}
		// Triggered by options.onlyIn
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
				shouldBlock = true;
			}
		}
		// Block tracking any on blacklist
		if (this.usesBlockFiles && this.inputOptions.blockFiles.indexOf(fileName)!==-1){
			shouldBlock = true;
		}
		if (this.usesBlockFiles && this.inputOptions.blockFiles.indexOf(filePath)!==-1){
			shouldBlock = true;
		}
		/* istanbul ignore if */
		if (fse.lstatSync(filePath).isDirectory() === true) {
			return false;
		}
		if (checkExists) {
			if (fse.existsSync(filePath) === false) {
				return false;
			}
		}
		if (shouldBlock){
			// Let  override with allowFiles
			if (this.alwaysAllowFileNames.indexOf(fileName)!==-1){
				return true;
			}
			else if (this.alwaysAllowFilePaths.indexOf(filePath)!==-1){
				return true;
			}
			else {
				return false;
			}
		}
		return true;
	}
	return FilelistHandlerInner;
})();

module.exports = FilelistHandler;
