// Quality ratchet: counts may go down, never up.
//   yarn check:ratchet            compare the current counts with docs/quality-baseline.json
//   yarn check:ratchet --update   lower the baseline to the current counts (refuses to raise it)
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = name => path.join(root, 'node_modules', '.bin', name);
const baselinePath = path.join(root, 'docs', 'quality-baseline.json');

const PRETTIER_GLOBS = [
  '{screens,navigation,services,src,components,utils,__tests__,firebase,scripts}/**/*.{ts,tsx,js,mjs}',
  'App.tsx',
  'index.js',
];

// Runs a command that exits non-zero when it finds problems, and returns its stdout anyway.
function run(file, args) {
  try {
    return execFileSync(file, args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    return error.stdout ?? '';
  }
}

function measure() {
  const eslint = JSON.parse(run(bin('eslint'), ['.', '-f', 'json']));
  const errors = eslint.reduce((sum, f) => sum + f.errorCount, 0);
  const warnings = eslint.reduce((sum, f) => sum + f.warningCount, 0);
  const tsc = run(bin('tsc'), ['--noEmit'])
    .split('\n')
    .filter(line => line.includes('error TS')).length;
  const unformatted = run(bin('prettier'), [
    '--list-different',
    ...PRETTIER_GLOBS,
  ])
    .split('\n')
    .filter(Boolean).length;
  return {
    eslintErrors: errors,
    eslintWarnings: warnings,
    tscErrors: tsc,
    prettierUnformattedFiles: unformatted,
  };
}

const current = measure();
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')).counts;
const update = process.argv.includes('--update');

let failed = false;
let improved = false;
for (const key of Object.keys(baseline)) {
  const was = baseline[key];
  const now = current[key];
  if (now > was) {
    failed = true;
    console.error(
      `FAIL  ${key}: ${now} (baseline ${was}) - new violations were added`,
    );
  } else if (now < was) {
    improved = true;
    console.log(`OK    ${key}: ${now} (baseline ${was}) - improved`);
  } else {
    console.log(`OK    ${key}: ${now}`);
  }
}

if (failed) {
  process.exit(1);
}
if (update && improved) {
  const file = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  file.counts = current;
  file.updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(baselinePath, `${JSON.stringify(file, null, 2)}\n`);
  console.log('Baseline lowered in docs/quality-baseline.json. Commit it.');
} else if (improved) {
  console.log(
    'Counts improved. Run "yarn check:ratchet --update" and commit the lower baseline.',
  );
}
