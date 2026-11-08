module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Keeps the severity and behavior used before the ESLint config upgrade
    // (warning, and unused catch variables are allowed).
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {args: 'none', caughtErrors: 'none'},
    ],
  },
};
