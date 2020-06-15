const config = {
	require: ['esm'],
	files: ['test/**/*.spec.js'],
	cache: true,
	concurrency: 10,
	verbose: true,
	tap: false,
	failFast: true
};

export default config;
