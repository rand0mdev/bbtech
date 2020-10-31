'use strict';

import gulp, {
    src,
    dest,
    watch,
    parallel,
    series
} from 'gulp';
import { resolve } from 'path';
const del = require('delete');
const conventionalRecommendedBump = require('conventional-recommended-bump');
const conventionalGithubReleaser = require('conventional-github-releaser');
const execa = require('execa');
const fs = require('fs');
const {
    promisify
} = require('util');
const dotenv = require('dotenv');
const sass = require('gulp-sass');
const babel = require('gulp-babel');
const rename = require('gulp-rename');
const uglify = require('gulp-uglify');
const {
    exec
} = require('child_process');

// load environment variables
const result = dotenv.config();

if (result.error) {
    throw result.error;
}

// Conventional Changelog preset
const preset = 'angular';
// print output of commands into the terminal
const stdio = 'inherit';

function clean(cb) {
    del(['build/'])
    cb();
}

function cleanJavascript(cb) {
    del(['build/*.js'])
    cb();
}

function cleanStylesheet(cb) {
    del(['build/*.css']);
    cb();
}

function javascript(cb) {
    return src('./assets/js/*.js')
        .pipe(babel())
        .pipe(uglify())
        .pipe(rename({
            extname: '.min.js'
        }))
        .pipe(dest('build/'));
}

function stylesheet(cb) {
    return src('./assets/scss/**/*.scss')
        .pipe(sass({
            outputStyle: 'compressed'
        }))
        .pipe(rename({
            extname: '.min.css'
        }))
        .pipe(dest('build/'));
}

function copyFonts(cb) {
    exec("yarn copyfiles -f node_modules/@fortawesome/fontawesome-free/webfonts/* build/fonts");
    cb();
}

function streamTasks(cb) {
    watch('./assets/scss/**/*.scss', series(cleanStylesheet, stylesheet));
    watch('./assets/js/*.js', series(cleanJavascript, javascript));
    cb();
}

function build(cb) {
    series(clean, parallel(copyFonts, stylesheet, javascript));
    cb();
}

function getCurrentBranchName() {
    return new Promise((resolve, reject) => {
        exec(
            "git branch | grep '*' | tr -d ' *'",
            function(error, stdout, stderr) {
                if(error) {
                    reject();
                    return;
                }

                if(stderr) {
                    reject(stderr);
                    return; 
                }

                resolve(stdout);
            }
        )
    });
}

async function bumpVersion() {
    // get recommended version bump based on commits
    const {
        releaseType
    } = await promisify(conventionalRecommendedBump)({
        preset
    });
    // bump version without committing and tagging
    await execa('yarn', ['version', '--' + releaseType, '--no-git-tag-version --non-interactive --verbose'], {
        stdio,
    });
}

async function changelog() {
    await execa(
        'yarn',
        [
            'conventional-changelog',
            '--preset',
            preset,
            '--infile',
            'CHANGELOG.md',
            '--same-file',
        ], {
            stdio
        }
    );
}

async function commitTagPush() {
    // even though we could get away with "require" in this case, we're taking the safe route
    // because "require" caches the value, so if we happen to use "require" again somewhere else
    // we wouldn't get the current value, but the value of the last time we called "require"
    const {
        version
    } = JSON.parse(await promisify(fs.readFile)('package.json'));
    const commitMsg = `chore: release ${version}`;
    await execa('git', ['add', '.'], {
        stdio
    });
    await execa('git', ['commit', '--message', commitMsg], {
        stdio
    });
    await execa('git', ['tag', '--force', `v${version}`], {
        stdio
    });
    const branch = await getCurrentBranchName();
    // await execa('git', ['push', '--set-upstream', 'origin '+ branch, '--follow-tags'], {
    //     stdio
    // });
    await exec('git push --set-upstream origin '+ branch + ' --follow-tags', {
        stdio
    });
}

function githubRelease(done) {
    conventionalGithubReleaser({
            type: 'oauth',
            token: process.env.GH_TOKEN
        }, {
            preset
        },
        done
    );
}

exports.release = series(
    bumpVersion,
    changelog,
    commitTagPush,
    githubRelease
);

exports.build = build;
exports.default = series(clean, parallel(build, copyFonts, streamTasks));
