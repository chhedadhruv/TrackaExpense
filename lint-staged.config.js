// Runs on staged files only. ESLint errors block the commit; Prettier rewrites the file;
// tests related to the changed files must pass. Existing warnings are held by the ratchet
// (yarn check:ratchet), which runs before push and in CI.
module.exports = {
  '*.{ts,tsx,js}': [
    'eslint --fix',
    'prettier --write',
    'jest --bail --findRelatedTests --passWithNoTests',
  ],
  '*.mjs': ['prettier --write'],
};
