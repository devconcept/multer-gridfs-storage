const config = {
	require: ['ts-node/register/transpile-only'],
	files: ['test/**/*.spec.ts'],
	cache: true,
	concurrency: 10,
	verbose: true,
	tap: false,
	failFast: true,
	typescript: {
		rewritePaths: {
			'src/': 'lib/'
		}
	}
};

export default config;
