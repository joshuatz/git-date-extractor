#!/usr/bin/env node
'use strict';
global.calledViaCLI = true;
const meow = require('meow');
const {validateOptions} = require('./helpers');
const gitDateExtractor = require('.');

const cli = meow(`
	Usage
	  $ git-date-extractor [input]
	  $ git-dates [input]

	Options (all are optional):
	  --outputToFile {boolean} [Default: false]
	  --outputFileName {string} [Default: timestamps.json]
	  --outputFileGitAdd {boolean} [Default: false*] *default=true if gitCommitHook is set
	  --files {string[] | string}
	  --onlyIn {string[] | string}
	  --blockFiles {string[] | string}
	  --allowFiles {string[] | string}
	  --gitCommitHook {"post" | "pre" | "none"} [Default: "none"]
	  --projectRootPath {string}
	  --debug {boolean} [Default: false]

	Examples
	  $ git-date-extractor
	  {
		'alpha.txt': { created: 1568789925, modified: 1568790468 },
		'bravo.txt': { created: 1568789925, modified: 1568790468 },
		'subdir/charlie.txt': { created: 1568789925, modified: 1568790368 }
	  }
	  $ git-date-extractor --files=[alpha.txt] --outputFileGitAdd=true --gitCommitHook=post
	  timestamps updated
`, {
	flags: {
		outputToFile: {
			type: 'boolean',
			default: false,
			alias: 'out'
		},
		outputFileName: {
			type: 'string',
			alias: 'outFile'
		},
		outputFileGitAdd: {
			type: 'boolean',
			alias: 'gitAdd'
		},
		files: {
			type: 'string',
			alias: 'file'
		},
		onlyIn: {
			type: 'string',
			alias: 'dirs'
		},
		blockFiles: {
			type: 'string',
			alias: 'blocklist'
		},
		allowFiles: {
			type: 'string',
			alias: 'whitelist'
		},
		gitCommitHook: {
			type: 'string',
			default: 'none',
			alias: 'git-stage'
		},
		projectRootPath: {
			type: 'string',
			alias: 'rootDir'
		},
		debug: {
			type: 'boolean'
		}
	}
});

// Files can be passed either through flag OR just as args to cli
const options = cli.flags;
const finalizedOptions = validateOptions(options);
const regularArgs = cli.input;
finalizedOptions.files = finalizedOptions.files.concat(regularArgs);

// Call main with options
gitDateExtractor.getStamps(finalizedOptions).then(result => {
	if (finalizedOptions.outputToFile === false) {
		console.log(result);
	} else {
		const msg = 'timestamps file updated';
		console.log(msg);
	}
}).catch(error => {
	console.error(error);
});
