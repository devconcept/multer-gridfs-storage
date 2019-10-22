import pify from 'pify';
import md5FileCb from 'md5-file';
import {files as testFiles} from './testutils';

const md5File = pify(md5FileCb);

export async function fileMatchMd5Hash(t, files, count = 2) {
	t.truthy(files);
	t.true(Array.isArray(files));
	t.is(files.length, count);
	const md5 = await Promise.all(
		files.map(async (f, idx) => {
			const computed = await md5File(testFiles[idx]);
			return {md5: f.md5, computed};
		})
	);
	t.true(md5.every(f => f.md5 === f.computed));
}
