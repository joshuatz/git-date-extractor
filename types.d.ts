/// <reference types="node"/>

type GitCommitHook = "pre" | "post" | "none";

interface StampObject {
    // the stamp of when the file was created
    "created"?: number | boolean,
    // the stamp of when the file was modified
    "modified"?: number | boolean
}

interface StampCache {
    [index:string]: StampObject
}
interface InputOptions {
    // Whether or not the timestamps should be saved to file
    outputToFile?: boolean,
    // the filename to save the timestamps to
	outputFileName?: string,
	// If the output file should automatically be check-in with git add
	outputFileGitAdd?: boolean,
    // Filenames to process
    files?: string[] | string,
    // Only update for files in these directories
    onlyIn?: string[] | string,
    // Block certain files from being tracked
	blockFiles?: string[] | string,
	// Exception list of files that will override any blocks
	allowFiles?: string[] | string,
    // What triggered the execution
	gitCommitHook?: GitCommitHook,
	// Project root
	projectRootPath?: string
}

interface FinalizedOptions {
    outputToFile: boolean,
	outputFileName?: string,
	outputFileGitAdd?: boolean,
    files: string[],
    onlyIn?: string[],
	blockFiles?: string[],
	allowFiles: string[],
	gitCommitHook: GitCommitHook,
	projectRootPath: string,
	projectRootPathTrailingSlash: string,
	debug: boolean
}
