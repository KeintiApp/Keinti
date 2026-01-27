module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // The current codebase has a large amount of legacy hooks code that does not
    // satisfy exhaustive-deps. Keep visibility, but don't block lint runs.
    'react-hooks/exhaustive-deps': 'warn',

    // Keep visibility for unused vars, but don't block. Underscore-prefixed
    // args/vars are treated as intentionally unused.
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
  },
  overrides: [
    {
      files: ['jest.setup.js', '**/__tests__/**', '**/*.test.*', '**/*.spec.*'],
      env: {
        jest: true,
      },
    },
  ],
  ignorePatterns: [
    'react-native.config.js',
    'metro.config.js',
    'babel.config.js',
    'jest.config.js',
    'verify-photo-setup.js',
    '*.config.js',
    'node_modules/',
    'android/',
    'ios/',
  ],
};
