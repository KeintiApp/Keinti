module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Inline styles are an established pattern in this React Native codebase.
    // Keeping this rule active produces hundreds of low-signal warnings.
    'react-native/no-inline-styles': 'off',

    // The current codebase has a large amount of legacy hooks code that does not
    // satisfy exhaustive-deps. Keep visibility, but don't block lint runs.
    'react-hooks/exhaustive-deps': 'warn',

    // Fire-and-forget async calls are intentionally prefixed with `void`.
    'no-void': ['warn', { allowAsStatement: true }],

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
      files: ['scripts/**/*.js'],
      env: {
        node: true,
        commonjs: true,
      },
    },
    {
      files: [
        'src/screens/FrontScreen.tsx',
        'src/screens/Configuration.tsx',
        'src/screens/NotificationScreen.tsx',
        'src/screens/ReadingScreen.tsx',
        'src/components/VoiceNotePlayer.tsx',
      ],
      rules: {
        // These legacy surfaces have many intentional hook dependency omissions.
        // Tracking them as warnings in the Problems panel adds noise without
        // offering actionable signal until those screens are refactored.
        'react-hooks/exhaustive-deps': 'off',
      },
    },
    {
      files: [
        'src/screens/FrontScreen.tsx',
        'src/screens/ReadingScreen.tsx',
      ],
      rules: {
        // These screens are large legacy modules with intentional temporary
        // locals and nested render helpers. Keep lint useful elsewhere.
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-shadow': 'off',
        'react/no-unstable-nested-components': 'off',
        'no-bitwise': 'off',
      },
    },
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
