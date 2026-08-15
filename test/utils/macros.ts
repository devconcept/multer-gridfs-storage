import fs from 'fs';
import { expect } from 'vitest';
import { files as testFiles } from './testutils';

// Uploaded files are verified against their source by byte length.
export function filesMatchSource(files: any[], count = 2) {
	expect(files).toBeTruthy();
	expect(Array.isArray(files)).toBe(true);
	expect(files.length).toBe(count);
	for (const [idx, f] of files.entries()) {
		const { size } = fs.statSync(testFiles[idx]);
		expect(f.size).toBe(size);
	}
}
