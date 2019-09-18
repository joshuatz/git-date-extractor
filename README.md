# git-date-extractor [![Build Status](https://travis-ci.com/joshuatz/git-date-extractor.svg?branch=master)](https://travis-ci.com/joshuatz/git-date-extractor) [![codecov](https://codecov.io/gh/joshuatz/git-date-extractor/badge.svg?branch=master)](https://codecov.io/gh/joshuatz/git-date-extractor?branch=master)

> Easily extract file dates based on git history, and optionally cache in a easy to parse JSON file.

I made this tool because, in trying to set up an automated static site deployment, I realized two important facts:
 1. Git does not preserve OS timestamps (`git clone` will set file creation date to now)
 2. However, you can use the git log to track a file's history and generate timestamps based on when it was:
 	 - First added
	 - Last modified

Essentially, this is a way to run a command and get back a list of `created` and `modified` timestamps based on `git` history, regardless of when the files were actually created on your computer.


## Install

```
$ npm install git-date-extractor
```


## Usage

Assume directory structure of:
 - `alpha.txt`
 - `bravo.txt`
 - `/subdir`
	 - `charlie.txt`

This script will produce an output of:
```json
{
  "alpha.txt": {
    "created": 1568785761,
    "modified": 1568790468
  },
  "bravo.txt": {
    "created": 1568785761,
    "modified": 1568790468
  },
  "subdir/charlie.txt": {
    "created": 1568785762,
    "modified": 1568790368
  }
}
```


### Via JS
```js
const gitDateExtractor = require('git-date-extractor');

const stamps = gitDateExtractor.getStamps(optionsObject);

/**
 * Example:
const stamps = gitDateExtractor.getStamps({
	outputToFile: true,
	outputFileName: 'timestamps.json',
	projectRootPath: __dirname
});
*/
```

### Via CLI
```
$ npm install --global git-date-extractor
```

```
$ git-date-extractor --help
$ git-dates --help

	Usage
		$ git-date-extractor [input]
		$ git-dates [input]

	Options (all are optional):
		--outputToFile {boolean} [Default: false]
		--outputFileName {string} [Default: timestamps.json]
		--outputFileGitAdd {boolean} [Default: true]
		--files {string[] | string}
		--onlyIn {string[] | string}
		--blockFiles {string[] | string}
		--gitCommitHook {"post" | "pre" | "none"}
		--projectRootPath {string}

	Examples
		$ git-date-extractor
		{
			'alpha.txt': { created: 1568789925, modified: 1568790468 },
			'bravo.txt': { created: 1568789925, modified: 1568790468 },
			'subdir/charlie.txt': { created: 1568789925, modified: 1568790368 }
		}
		$ git-date-extractor --files=[alpha.txt] --outputFileGitAdd=true --gitCommitHook=post
		timestamps updated
```

> For the CLI, you can pass files either directly via the `--files` flag, such as `--files=[alpha.txt,bravo.txt]`, or as final arguments to the command, such as `git-date-extractor --outputToFile=true alpha.txt bravo.txt`

## Options

Both the CLI and the main method accept the same options:

Option Key | CLI Alias | Description | Type | Default
---|---|---|---|---
outputToFile | NA | Should the results be saved to file? | `boolean` | `false`
outputFileName | out-file-name | Name of the file to save to (if applicable) | `string` | `timestamps.json`
outputFileGitAdd | NA | If saving to file, should the file be `git add`'ed after update?<br>Note: This will only stage the file, unless you set gitCommitHook=post, then it will commit it. | `boolean` | `true`
files | file | Specific files to get timestamps for | `string[] | string` | NA - if empty, script will scan entire dir
onlyIn | dirs | Filter files by specific directory | `string[] | string` | NA
blockFiles | blocklist | Block certain files from being tracked | `string[] | sring` | NA
gitCommitHook | git-stage | Use this if you are running this script on a git hook.<br>For example, use `post` and the script will append a new commit with the changed timestamp file. | `"pre" | "post" | "none"` | NA
projectRootPath | rootDir | Top level directory containing your files.<br>Script should be able to detect automatically, but can also pass to be safe. | `string` | Auto-detected based on `proccess.cwd()`<br>or `__dirname`
