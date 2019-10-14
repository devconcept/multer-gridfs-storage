module.exports.default = {
	sources: [
		'lib/*.js'
	],
	files: [
		'test/**/*.spec.js'
	],
	helpers: [
		'test/utils/*'
	],
	cache: true,
	concurrency: 20,
	verbose: true,
	tap: false,
	failFast: true
};
