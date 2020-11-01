export type GitCommitHook = "pre" | "post" | "none";

export interface StampObject {
	// the stamp of when the file was created
	"created"?: number | boolean,
	// the stamp of when the file was modified
	"modified"?: number | boolean
}

export interface StampCache {
	[index:string]: StampObject
}

export interface InputOptions {
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
	gitCommitHook?: string,
	// Project root
	projectRootPath?: string,
	// Debug
	debug?: boolean
}

export interface FinalizedOptions {
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

export interface DirListing {
	[index: string]: string | DirListing;
}
