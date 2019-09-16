#!/usr/bin/env node
'use strict';
const meow = require('meow');
const gitDateExtractor = require('.');

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
			default: true
		},
		comitAction: {
			type: 'string',
			default: 'none'
		}
	}
});

console.log(gitDateExtractor(cli.input[0] || 'unicorns'));
