// @ts-check
const test = require('ava').default;
const helpers = require('../src/helpers');
/**
* Helpers testing
*/
test('posixNormalize', t => {
	const inputPath = 'c:\\dir\\myfile.js';
	const normalized = helpers.posixNormalize(inputPath);
	t.is(normalized, 'c:/dir/myfile.js');
});
test('replaceZeros', t => {
	const input = {
		alpha: 0,
		bravo: 'str',
		nested: {
			notouch: 0,
			str: 'str'
		}
	};
	const replaced = helpers.replaceZeros(input, 'replaced');
	t.deepEqual(replaced, {
		alpha: 'replaced',
		bravo: 'str',
		nested: {
			notouch: 0,
			str: 'str'
		}
	});
});

test('git folder check', t => {
	// The entire test will fail if the overall project is not git-inited
	// First test the working directory
	t.true(helpers.getIsInGitRepo());
	// Then go to hdd root and test there (should probably not be a git repo haha)
	t.falsy(helpers.getIsInGitRepo('/'));
});

test('replaceInObj', t => {
	const inputObj = {
		alpha: 2,
		bravo: 'BRAVO',
		arr: ['ARRAY_TEST'],
		nested: {
			charlie: 4,
			nested: {
				echo: 'ECHO',
				delta: 6
			}
		}
	};
	const replacer = function(input) {
		if (typeof (input) === 'string') {
			return input.toLowerCase();
		}

		return input * 2;
	};
	const expected = {
		alpha: 4,
		bravo: 'bravo',
		arr: ['array_test'],
		nested: {
			charlie: 8,
			nested: {
				echo: 'echo',
				delta: 12
			}
		}
	};
	t.deepEqual(helpers.replaceInObj(inputObj, replacer), expected);
});

test('isInNodeModules', t => {
	t.false(helpers.isInNodeModules());
	t.true(helpers.isInNodeModules('/node_modules/test/test.txt'));
});

test('Option validator', t => {
	/**
	 * @type {InputOptions}
	 */
	const dummyOptions = {
		files: '[alpha.txt, bravo.txt]',
		blockFiles: 'charlie.js',
		// @ts-ignore
		gitCommitHook: 'invalid'
	};
	const actual = helpers.validateOptions(dummyOptions);
	t.deepEqual(actual, {
		outputToFile: false,
		outputFileName: undefined,
		outputFileGitAdd: undefined,
		files: ['alpha.txt', 'bravo.txt'],
		onlyIn: undefined,
		blockFiles: ['charlie.js'],
		allowFiles: [],
		gitCommitHook: 'none',
		projectRootPath: helpers.projectRootPath,
		projectRootPathTrailingSlash: helpers.projectRootPathTrailingSlash,
		debug: false
	});
});

test('Null destination', t => {
	t.true(['NUL', '/dev/null'].includes(helpers.getNullDestination()));
});

test('semver info extractor', t => {
	const dummySemVer = 'v24.5.23-alpha+msvc';
	const expected = {
		major: 24,
		minor: 5,
		patch: 23,
		suffix: 'alpha+msvc',
		releaseLabel: 'alpha',
		metadata: 'msvc'
	};
	t.deepEqual(helpers.getSemverInfo(dummySemVer), expected);
});
