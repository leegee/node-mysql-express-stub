/*jslint node: true */

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    
    jshint: {
      src: ['Gruntfile.js', 'app_mysql_db.js', 'test.js', 'lib/*.js'],
      options: {
        curly: false,
        expr: true,
        globals: {
          require: true,
          define: true,
          describe: true,
          expect: true,
          it: true
        }
      }
    }    
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');

  // Default task(s).
  grunt.registerTask('default', ['jshint']);

};