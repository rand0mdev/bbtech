'use strict';

import { src, dest, watch, parallel, series } from 'gulp';
const del = require('delete');
const conventionalRecommendedBump = require('conventional-recommended-bump');
const conventionalGithubReleaser = require('conventional-github-releaser');
const execa = require('execa');
const fs = require('fs');
const { promisify } = require('util');
const dotenv = require('dotenv');
const sass = require('gulp-sass');
const babel = require('gulp-babel');
const rename = require('gulp-rename');
const uglify = require('gulp-uglify');
const twig = require('gulp-twig');
const htmlmin = require('gulp-htmlmin');
const { exec } = require('child_process');
const browserSync = require('browser-sync');

// load environment variables
const result = dotenv.config();
if (result.error) {
    throw result.error;
}

const app = {
    name: 'BBTech',
    title: 'Digital Agency made easy',
    description: 'Website and mobile applications development',
    environment: process.env.APP_ENV
};

const preset = 'angular'; // Conventional Changelog preset
const stdio = 'inherit'; // print output of commands into the terminal

function clean(cb) {
    del(['build/'])
    cleanHtml(cb);
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

function cleanHtml(cb) {
    del(['./index.html']);
    cb();
}

function generateHTML(cb) {
    src('./src/index.twig')
        .pipe(twig({
            data: {
                App: app
            }
        }))
        .pipe(htmlmin({ collapseWhitespace: true }))
        .pipe(dest('./'));
    cb();
}

function javascript(cb) {
    return src('./src/js/*.js')
        .pipe(babel())
        .pipe(uglify())
        .pipe(rename({
            extname: '.min.js'
        }))
        .pipe(dest('build/'))
        .pipe(browserSync.stream());
}

function stylesheet(cb) {
    return src('./src/scss/**/*.scss')
        .pipe(sass({
            outputStyle: 'compressed'
        }))
        .pipe(rename({
            extname: '.min.css'
        }))
        .pipe(dest('build/'))
        .pipe(browserSync.stream());
}

function streamTasks(cb) {
    browserSync.init({
        server: {
            baseDir: './'
        }
    });

    let watchConfig = {
        ignoreInitial: false
    };

    watch('./src/index.twig', watchConfig, series(cleanHtml, generateHTML)).on('change', browserSync.reload);
    watch('./src/scss/**/*.scss', watchConfig, series(cleanStylesheet, stylesheet));
    watch('./src/js/*.js', watchConfig, series(cleanJavascript, javascript));
    cb();
}

function getCurrentBranchName() {
    return new Promise((resolve, reject) => {
        exec(
            "git branch | grep '*' | tr -d ' *'",
            function (error, stdout, stderr) {
                if (error) {
                    reject();
                    return;
                }

                if (stderr) {
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
    await exec('git push --set-upstream origin ' + branch + ' --follow-tags', {
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

exports.clean = clean;
exports.build = series(clean, parallel(stylesheet, javascript, generateHTML));
exports.default = series(clean, parallel(stylesheet, javascript, generateHTML), streamTasks);
