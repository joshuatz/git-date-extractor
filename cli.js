#!/usr/bin/env node
'use strict';
const meow = require('meow');
const gitDateExtractor = require('.');
const { validateOptions } = require('./helpers');

const cli = meow(`
	Usage
	  $ git-date-extractor [input]

	Options
	  --foo  Lorem ipsum [Default: false]

	Examples
	  $ git-date-extractor
	  unicorns & rainbows
	  $ git-date-extractor ponies
	  ponies & rainbows
`, {
	flags: {
		outputToFile: {
			type: 'boolean',
			default: false
		},
		outputFileName: {
			type: 'string',
			default: undefined,
			alias: 'out-file-name'
		},
		outputFileGitAdd: {
			type: 'boolean',
			default: undefined,
		},
		files: {
			type: 'string',
			default: undefined,
			alias: 'file'
		},
		onlyIn: {
			type: 'string',
			default: undefined,
			alias: 'dirs'
		},
		blockFiles: {
			type: 'string',
			default: undefined,
			alias: 'blocklist'
		},
		gitCommitHook: {
			type: 'string',
			default: 'none',
			alias: 'git-stage'
		},
		projectRootPath: {
			type: 'string',
			default: undefined,
			alias: 'rootDir'
		}
	}
});

// Files can be passed either through flag OR just as args to cli
let options = cli.flags;
let finalizedOptions = validateOptions(options);
let regularArgs = cli.input;
finalizedOptions.files = finalizedOptions.files.concat(regularArgs);

// Call main with options
let result = gitDateExtractor.getStamps(finalizedOptions);
if (!finalizedOptions.outputToFile){
	console.log(result);
}
else {
	console.log('timestamps updated');
}
