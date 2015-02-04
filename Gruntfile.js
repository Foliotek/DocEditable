module.exports = function (grunt) {

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		connect: {
			dev: {
				options: {
					port: 8000,
					base: './',
					keepalive: true
				}
			}
		},
	});

	grunt.loadNpmTasks('grunt-contrib-connect');
	grunt.registerTask('default', ['connect']);
};