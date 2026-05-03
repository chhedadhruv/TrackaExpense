#!/usr/bin/env node
/**
 * Stamps native build files with the version from package.json and a fresh build number.
 *
 * Build number format: YYMMDDhh  (e.g. 26050114 for 2026-05-01 at 14:xx)
 *
 * Files updated:
 *   android/app/build.gradle                versionCode, versionName
 *   ios/TrackaExpense.xcodeproj/project.pbxproj  CURRENT_PROJECT_VERSION, MARKETING_VERSION
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ─── helpers ────────────────────────────────────────────────────────────────

function buildNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  return `${yy}${mm}${dd}${hh}`;
}

function readFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function writeFile(rel, content) {
  fs.writeFileSync(path.join(ROOT, rel), content, 'utf8');
}

// ─── main ────────────────────────────────────────────────────────────────────

const pkg = JSON.parse(readFile('package.json'));
const version = pkg.version;
const build = buildNumber();

console.log(`\nVersion:  ${version}`);
console.log(`Build:    ${build}\n`);

// 1. android/app/build.gradle
const gradlePath = 'android/app/build.gradle';
let gradle = readFile(gradlePath);
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${build}`);
gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);
writeFile(gradlePath, gradle);
console.log('✓  android/app/build.gradle');

// 2. ios/TrackaExpense.xcodeproj/project.pbxproj
const pbxPath = 'ios/TrackaExpense.xcodeproj/project.pbxproj';
let pbx = readFile(pbxPath);
pbx = pbx.replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${build};`);
pbx = pbx.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`);
writeFile(pbxPath, pbx);
console.log('✓  ios/TrackaExpense.xcodeproj/project.pbxproj');

console.log(`\nDone. Version: ${version}, build: ${build}\n`);
