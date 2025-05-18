module.exports = {
  // parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  plugins: ['@typescript-eslint'],
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  rules: {},
  ignorePatterns: ['dist', 'node_modules', '*.js'],
};
