module.exports = {
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  // plugins: ['@typescript-eslint'],
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error'
  },
  ignorePatterns: ['dist', 'node_modules', '*.js'],
};
