module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^react-native-vector-icons/MaterialIcons$': '<rootDir>/__mocks__/MaterialIcons.js',
    '^react-native-vector-icons/FontAwesome$': '<rootDir>/__mocks__/FontAwesome.js',
    '^react-native-image-crop-picker$': '<rootDir>/__mocks__/react-native-image-crop-picker.js',
    '^react-native-google-mobile-ads$': '<rootDir>/__mocks__/react-native-google-mobile-ads.js',
    '^@react-native-masked-view/masked-view$': '<rootDir>/__mocks__/react-native-masked-view.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-community|react-native-vector-icons|react-native-inappbrowser-reborn)/)',
  ],
};
