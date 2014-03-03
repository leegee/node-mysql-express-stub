/*jslint node: true */

module.exports = function(grunt) {

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-mocha-test');

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
    },

    mochaTest: {
      test: {
        options: {
          reporter: 'spec'
        },
        src: ['test.js']
      }
    }

  });

  // Default task(s).
  grunt.registerTask('default', ['jshint', 'mochaTest']);

};