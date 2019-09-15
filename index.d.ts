type GitCommitHook = "pre" | "post" | "none" | null | undefined;

interface StampObject {
    // the stamp of when the file was created
    "created": number | boolean,
    // the stamp of when the file was modified
    "modified": number | boolean
}