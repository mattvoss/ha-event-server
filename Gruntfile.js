(function(undefined){
  "use strict";

module.exports = function(grunt) {
  // Load Grunt tasks declared in the package.json file
  require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);
  var jsSrc = [
        'lib/jquery/jquery.js',
        'lib/moment/moment.js',
        'lib/angular/angular.js',
        'lib/angular-animate/angular-animate.js',
        'lib/angular-aria/angular-aria.js',
        'lib/angular-material/angular-material.js',
        'lib/angular-moment/angular-moment.js',
        'lib/handlebars/handlebars.js',
        'lib/angular-socket-io/socket.js',
        'lib/lodash/lodash.compat.js',
        'lib/angular-lodash/angular-lodash.js'
      ],
      cssSrc = [
        'lib/angular-material/angular-material.css',
        'ui-server/assets/css/app.css'
      ];
  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    bower: {
      install: {
        options: {
          targetDir: './lib',
          layout: 'byType',
          install: true,
          verbose: false,
          cleanTargetDir: true,
          cleanBowerDir: false
        }
      }
    },
    jshint: {
      all: ['Gruntfile.js', 'ui-server/assets/js/**/*.js'],
      server: ['server.js', 'ui-server/routes/index.js']
    },
    uglify: {
      options: {
        beautify: false,
        mangle: true
      },
      vendors: {
        files: {
          'ui-server/public/js/vendors.min.js': jsSrc
        }
      },
      app: {
        files: {
          'ui-server/public/js/app.min.js': [
            'ui-server/assets/js/**/*.js'
          ]
        }
      }
    },
    cssmin: {
      combine: {
        files: {
          'ui-server/public/css/app.css': cssSrc
        }
      }
    },
    concat: {
      options: {
        stripBanners: true,
        banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
          '<%= grunt.template.today("yyyy-mm-dd") %> */',
      },
      css: {
        src: cssSrc,
        dest: 'ui-server/public/css/app.css',
      },
      app: {
        src: [
          'ui-server/assets/js/**/*.js'
        ],
        dest: 'ui-server/public/js/app.min.js',
      },
      jsDev: {
        src: jsSrc,
        dest: 'ui-server/public/js/vendors.min.js',
      },
    },
    copy: {
      main: {
        files: [
          {
            expand: true,
            flatten: true,
            src: [

            ],
            dest: 'ui-server/public/fonts/',
            filter: 'isFile'
          },
          {
            expand: true,
            flatten: true,
            src: [
              'ui-server/assets/images/*.*'
            ],
            dest: 'ui-server/public/images/',
            filter: 'isFile'
          }

        ]
      }
    },
    watch: {
      grunt: {
        files: ['Gruntfile.js'],
        tasks: ['build', 'express:dev', 'watch'],
        options: {
          spawn: true,
        },
      },
      scripts: {
        files: ['ui-server/assets/js/**/*.js'],
        tasks: ['jshint:all', 'concat:app'],
        options: {
          spawn: true,
        },
      },
      express: {
        files: ['ui-server/server.js', 'ui-server/routes/index.js', 'ui-server/io-routes/index.js'],
        tasks: ['jshint:server', 'express:dev'],
        options: {
          nospawn: true //Without this option specified express won't be reloaded
        }
      },
      css: {
        files: ['ui-server/assets/css/*.css'],
        tasks: ['concat:css'],
        options: {
          spawn: true,
        },
      }
    },
    express: {
      options: {
        debug: true
        // Override defaults here
      },
      dev: {
        options: {
          script: 'ui-server/server.js'
        }
      }
    },
    'node-inspector': {
      default: {}
    },
    open : {
      dev : {
        path: 'http://127.0.0.1:3001'
      }
    }
  });

  grunt.registerTask('build', [
    'bower:install',
    'jshint:server',
    'jshint:all',
    'uglify',
    'cssmin',
    'copy'
  ]);

  grunt.registerTask('build-dev', [
    'bower:install',
    'jshint:server',
    'jshint:all',
    'concat',
    'copy'
  ]);

  grunt.event.on('watch', function(action, filepath, target) {
    grunt.log.writeln(target + ': ' + filepath + ' has ' + action);
  });

  grunt.registerTask('server', [ 'build-dev', 'express:dev', 'open:dev', 'watch' ]);

  // Default task(s).
  grunt.registerTask('default', ['build']);

};
}());
