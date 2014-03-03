/*jslint node: true */

module.exports = function(grunt) {

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-jsdoc-plugin');

  // Project configuration.
  grunt.initConfig({
    
    jshint: {
      src: ['*.js', 'lib/*.js'],
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

    /*,

    jsdoc : {
      dist : {
        src: ['lib/*.js'], 
          options: {
            destination: 'out'
          }
      }
    } */

  });

  // Default task(s).
  grunt.registerTask('default', ['jshint', 'mochaTest']);

};