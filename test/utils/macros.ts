import fs from 'fs';
import { ExecutionContext } from 'ava';
import { files as testFiles } from './testutils';

// GridFS no longer stores an md5 hash (removed in mongodb driver 4.0.0), so
// uploaded files are verified against their source by byte length instead.
export function filesMatchSource(t: ExecutionContext, files: any[], count = 2) {
	t.truthy(files);
	t.true(Array.isArray(files));
	t.is(files.length, count);
	for (const [idx, f] of files.entries()) {
		const { size } = fs.statSync(testFiles[idx]);
		t.is(f.size, size);
	}
}
