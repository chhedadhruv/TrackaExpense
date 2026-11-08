// Conventional Commits, plus a rule that rejects attribution lines of any kind.
// Strict: no mention of these terms anywhere in a commit message. Refer to the project
// guidance file as "the project guidance file".
const ATTRIBUTION =
  /(co-authored-by|generated (with|by)|claude|anthropic|\bAI\b)/i;

module.exports = {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'no-attribution': parsed => {
          const message = parsed.raw || '';
          const found = ATTRIBUTION.test(message);
          return [
            !found,
            'commit message must not contain attribution lines (Co-Authored-By, "generated with/by", tool or AI names)',
          ];
        },
      },
    },
  ],
  rules: {
    'no-attribution': [2, 'always'],
    'header-max-length': [2, 'always', 100],
  },
};
