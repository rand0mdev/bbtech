'use strict';

import { dest, src, start, task, watch } from 'gulp';

// let gulp = require('gulp'),
let
    sass = require('gulp-sass'),
    browserSync = require('browser-sync');

task('sass', function(){
    return src('./assets/scss/*.scss')
        .pipe(sass().on('error', sass.logError))
        .pipe(dest('./dist'))
});

task('sass:watch', function(){
    watch('./assets/scss/*.scss', ['sass'])
});

task('browser-sync', function(){
    let files = [
        './*.html',
        './build/*.css',
        './build/*.js',
        './assets/images/*.{png,jpg,gif}'
    ];

    browserSync.init(files, {
        server: {
            baseDir: './'
        }
    })

});


task('default', ['browser-sync'], function(){
    start('sass:watch')
});