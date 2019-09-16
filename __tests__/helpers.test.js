// @ts-check
import test from 'ava';
import * as helpers from '../helpers';
import fse from 'fs-extra';
/**
* Helpers testing
*/
test('posixNormalize', t => {
	let inputPath = 'c:\\dir\\myfile.js';
	let normalized = helpers.posixNormalize(inputPath);
	t.is(normalized,'c:/dir/myfile.js');
});
test('replaceZeros', t=>{
	let input = {
		alpha: 0,
		bravo: 'str',
		nested: {
			notouch: 0,
			str: 'str'
		}
	};
	let replaced = helpers.replaceZeros(input,'replaced');
	t.deepEqual(replaced,{
		alpha: 'replaced',
		bravo: 'str',
		nested: {
			notouch: 0,
			str: 'str'
		}
	});
});
test('git folder check', async t=>{
	// The entire test will fail if the overall project is not git-inited
	// First test the working directory
	t.assert(helpers.getIsInGitRepo());
	// Then go to hdd root and test there (should probably not be a git repo haha)
	t.falsy(helpers.getIsInGitRepo('/'));
});
