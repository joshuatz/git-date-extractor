# git-date-extractor [![Build Status](https://travis-ci.com/joshuatz/git-date-extractor.svg?branch=master)](https://travis-ci.com/joshuatz/git-date-extractor) [![codecov](https://codecov.io/gh/joshuatz/git-date-extractor/badge.svg?branch=master)](https://codecov.io/gh/joshuatz/git-date-extractor?branch=master)

> Easily extract file dates based on git history, and optionally cache in a easy to parse JSON file.


## Install

```
$ npm install git-date-extractor
```


## Usage

```js
const gitDateExtractor = require('git-date-extractor');

gitDateExtractor('unicorns');
//=> 'unicorns & rainbows'
```


## API

### gitDateExtractor(input, options?)

#### input

Type: `string`

Lorem ipsum.

#### options

Type: `object`

##### foo

Type: `boolean`<br>
Default: `false`

Lorem ipsum.


## CLI

```
$ npm install --global git-date-extractor
```

```
$ git-date-extractor --help

  Usage
    git-date-extractor [input]

  Options
    --foo  Lorem ipsum [Default: false]

  Examples
    $ git-date-extractor
    unicorns & rainbows
    $ git-date-extractor ponies
    ponies & rainbows
```
