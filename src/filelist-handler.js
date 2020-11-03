const path = require('path');
const fse = require('fs-extra');
const walkdir = require('walkdir');
const {posixNormalize, getIsRelativePath} = require('./helpers');

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
	/^\..+$/
];

class FilelistHandler {
	/** @param {import('./types').FinalizedOptions} optionsObj */
	constructor(optionsObj) {
		this.inputOptions = optionsObj;

		/**
		* @type Array<{relativeToProjRoot:string, fullPath: string}>
		*/
		this.filePaths = [];

		// Parse filter options
		/**
		 * Construct a list of directories that will be scanned for files
		 */
		this.contentDirs = [optionsObj.projectRootPath];
		if (Array.isArray(optionsObj.onlyIn) && optionsObj.onlyIn.length > 0) {
			this.contentDirs = optionsObj.onlyIn;
		}
		this.fullPathContentDirs = this.contentDirs.map(function(pathStr) {
			return posixNormalize(getIsRelativePath(pathStr) ? (optionsObj.projectRootPath + '/' + pathStr) : pathStr);
		});

		this.alwaysAllowFileNames = optionsObj.allowFiles;
		this.alwaysAllowFilePaths = this.alwaysAllowFileNames.map(function(pathStr) {
			return posixNormalize(getIsRelativePath(pathStr) ? (optionsObj.projectRootPath + '/' + pathStr) : pathStr);
		});
		this.restrictByDir = Array.isArray(optionsObj.onlyIn) && optionsObj.onlyIn.length > 0;
		this.usesCache = typeof (optionsObj.outputFileName) === 'string';
		this.usesBlockFiles = Array.isArray(optionsObj.blockFiles) && optionsObj.blockFiles.length > 0;
		// Process input files
		for (let x = 0; x < optionsObj.files.length; x++) {
			let filePath = optionsObj.files[x];
			// Make sure to get full file path
			filePath = posixNormalize(getIsRelativePath(filePath) ? (optionsObj.projectRootPathTrailingSlash + filePath) : filePath);
			this.pushFilePath(filePath, true);
		}
		/**
		 * If no files were passed through the explicit "files" option, this block will walk through directories to scan for files
		 */
		if (optionsObj.files.length === 0) {
			// Get *all* files contained within content dirs
			// Iterate over all dirs of interest
			for (let x = 0; x < this.fullPathContentDirs.length; x++) {
				const fullContentDirPath = this.fullPathContentDirs[x];
				// Walk the dir and built paths
				const paths = walkdir.sync(fullContentDirPath, function(pathStr) {
					const pathDirName = path.basename(pathStr);
					let blocked = false;
					// Check internal block list of directories
					if (internalDirBlockList.includes(pathDirName)) {
						blocked = true;
					}
					if (!blocked) {
						for (let db = 0; db < internalDirBlockPatterns.length; db++) {
							if (internalDirBlockPatterns[db].test(pathDirName)) {
								blocked = true;
								break;
								// DebugLog('Blocked based on DirBlockPatt - ' + pathDirName);
							}
						}
					}
					if (blocked) {
						this.ignore(pathStr);
					}
				});
				// Walk the individual files and check
				for (let p = 0; p < paths.length; p++) {
					let blocked = false;
					const fileOrDirName = path.basename(paths[p]);
					for (let b = 0; b < internalFileBlockPatterns.length; b++) {
						if (internalFileBlockPatterns[b].test(fileOrDirName)) {
							blocked = true;
							break;
						}
					}
					if (!blocked) {
						this.pushFilePath(paths[p], false);
					}
				}
			}
		}
	}

	/**
	 * Checks if a file is on the allowFiles list (aka approved)
	 * @param {string} filePath - the filepath to check
	 * @returns {boolean} - If the file is on the approved list
	 */
	getIsFileOnApproveList(filePath) {
		const fileName = path.basename(filePath);
		if (this.alwaysAllowFileNames.includes(fileName)) {
			return true;
		}
		if (this.alwaysAllowFilePaths.includes(filePath)) {
			return true;
		}
		return false;
	}

	/**
	* Add a file to the queue of file paths to retrieve dates for
	* @param {string} filePath  - The path of the file
	* @param {boolean} [checkExists]  - If the func should check that the file actually exists before adding
	* @returns {boolean} - If the file was added
	*/
	pushFilePath(filePath, checkExists) {
		filePath = posixNormalize(filePath);
		if (this.getShouldTrackFile(filePath, checkExists)) {
			this.filePaths.push({
				relativeToProjRoot: filePath.replace(posixNormalize(this.inputOptions.projectRootPathTrailingSlash), ''),
				fullPath: filePath
			});
			return true;
		}
		return false;
	}

	/**
	* @param {string} filePath - The path of the file
	* @param {boolean} [checkExists]  - If the func should check that the file actually exists before adding
	* @returns {boolean} - If the file should be tracked / dates fetched
	*/
	getShouldTrackFile(filePath, checkExists) {
		let shouldBlock = false;
		filePath = posixNormalize(filePath);
		const fileName = path.basename(filePath);
		checkExists = typeof (checkExists) === "boolean" ? checkExists : false;

		// Block tracking the actual timestamps file - IMPORTANT: blocks hook loop!
		if (this.usesCache && filePath.includes(posixNormalize(this.inputOptions.outputFileName))) {
			// Only let this be overrwritten by allowFiles approvelist if gitcommithook is equal to 'none' or unset
			if (this.inputOptions.gitCommitHook === 'pre' || this.inputOptions.gitCommitHook === 'post') {
				return false;
			}
			shouldBlock = true;
		}

		// Triggered by options.onlyIn
		if (this.restrictByDir) {
			let found = false;
			// Block tracking any files outside the indicated content dirs
			for (let x = 0; x < this.fullPathContentDirs.length; x++) {
				const fullContentDirPath = this.fullPathContentDirs[x];
				if (filePath.includes(posixNormalize(fullContentDirPath))) {
					found = true;
					break;
				}
			}
			if (!found) {
				// Not in content dirs - block adding
				shouldBlock = true;
			}
		}

		// Block tracking any on blocklist
		if (this.usesBlockFiles && this.inputOptions.blockFiles.includes(fileName)) {
			shouldBlock = true;
		}
		if (this.usesBlockFiles && this.inputOptions.blockFiles.includes(filePath)) {
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
		if (shouldBlock) {
			// Let override with allowFiles
			if (this.getIsFileOnApproveList(filePath)) {
				return true;
			}

			return false;
		}

		return true;
	}
}

module.exports = FilelistHandler;
