/**
 * @format
 */

import 'react-native';
import React from 'react';

// Note: import explicitly to use the types shipped with jest.
import {it} from '@jest/globals';

// Note: test renderer must be required after react-native.
import renderer, {act} from 'react-test-renderer';

// This is a smoke test: we just verify the app entry renders.
// Mock heavy screens to avoid native-module rendering issues in Jest.
jest.mock('../src/screens/LoginScreen', () => {
  const React = require('react');
  const Mock = () => React.createElement('LoginScreen');
  return { __esModule: true, default: Mock };
});

jest.mock('../src/screens/RegisterScreen', () => {
  const React = require('react');
  const Mock = () => React.createElement('RegisterScreen');
  return { __esModule: true, default: Mock };
});

jest.mock('../src/screens/FrontScreen', () => {
  const React = require('react');
  const Mock = () => React.createElement('FrontScreen');
  return { __esModule: true, default: Mock };
});

jest.mock('../src/screens/Configuration', () => {
  const React = require('react');
  const Mock = () => React.createElement('Configuration');
  return { __esModule: true, default: Mock };
});

// Import after mocks.
const App = require('../App').default;

it('renders correctly', async () => {
  let tree: renderer.ReactTestRenderer | null = null;

  await act(async () => {
    tree = renderer.create(<App />);
    // Flush at least one tick for passive effects.
    await Promise.resolve();
  });

  tree?.unmount();
});
