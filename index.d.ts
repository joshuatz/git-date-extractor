type GitCommitHook = "pre" | "post" | "none" | null | undefined;

interface StampObject {
    // the stamp of when the file was created
    "created"?: number | boolean,
    // the stamp of when the file was modified
    "modified"?: number | boolean
}

interface StampCache {
    [index:string]: StampObject
}
interface Options {
    // Whether or not the timestamps should be saved to file
    outputToFile: boolean,
    // the filename to save the timestamps to
    outputFileName?: string,
    // Filenames to process
    files: string[],
    // Only update for files in these directories
    onlyIn?: string[],
    // Block certain files from being tracked
    blockFiles?: string[],
    // What triggered the execution
    gitCommitHook: GitCommitHook
}