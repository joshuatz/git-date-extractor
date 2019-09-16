// @ts-check
import test from 'ava';
import * as helpers from '../helpers';
/**
* Helpers testing
*/
test('posixNormalize', t => {
	let inputPath = 'c:\\dir\\myfile.js';
	let normalized = helpers.posixNormalize(inputPath);
	t.is(normalized,'foo');
});
