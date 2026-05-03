#!/usr/bin/env node
/**
 * Bumps the app version and build number.
 *
 * Version increment rule:
 *   patch < 9  →  patch + 1          (1.2.8 → 1.2.9)
 *   patch = 9  →  minor + 1, patch 0 (1.2.9 → 1.3.0)
 *
 * Build number format: YYMMDDhh  (e.g. 26050114 for 2026-05-01 at 14:xx)
 *
 * Files updated:
 *   package.json                             version
 *   android/app/build.gradle                versionCode, versionName
 *   ios/TrackaExpense.xcodeproj/project.pbxproj  CURRENT_PROJECT_VERSION, MARKETING_VERSION
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ─── helpers ────────────────────────────────────────────────────────────────

function bumpVersion(current) {
  const [major, minor, patch] = current.split('.').map(Number);
  if (patch < 9) return `${major}.${minor}.${patch + 1}`;
  return `${major}.${minor + 1}.0`;
}

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

const pkgPath = 'package.json';
const pkg = JSON.parse(readFile(pkgPath));
const oldVersion = pkg.version;
const newVersion = bumpVersion(oldVersion);
const build = buildNumber();

console.log(`\nVersion:  ${oldVersion}  →  ${newVersion}`);
console.log(`Build:    ${build}\n`);

// 1. package.json
pkg.version = newVersion;
writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('✓  package.json');

// 2. android/app/build.gradle
const gradlePath = 'android/app/build.gradle';
let gradle = readFile(gradlePath);
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${build}`);
gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${newVersion}"`);
writeFile(gradlePath, gradle);
console.log('✓  android/app/build.gradle');

// 3. ios/TrackaExpense.xcodeproj/project.pbxproj
const pbxPath = 'ios/TrackaExpense.xcodeproj/project.pbxproj';
let pbx = readFile(pbxPath);
pbx = pbx.replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${build};`);
pbx = pbx.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${newVersion};`);
writeFile(pbxPath, pbx);
console.log('✓  ios/TrackaExpense.xcodeproj/project.pbxproj');

console.log(`\nDone. New version: ${newVersion}, build: ${build}\n`);
