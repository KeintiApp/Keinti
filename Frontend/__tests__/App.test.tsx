/**
 * @format
 */

import 'react-native';
import React from 'react';

// Note: import explicitly to use the types shipped with jest.
import {it} from '@jest/globals';

// Note: test renderer must be required after react-native.
import renderer, {act, type ReactTestRenderer} from 'react-test-renderer';

// This is a smoke test: we just verify the app entry renders.
// Mock heavy screens to avoid native-module rendering issues in Jest.
jest.mock('../src/screens/LoginScreen', () => {
  const ReactMock = require('react');
  const Mock = () => ReactMock.createElement('LoginScreen');
  return { __esModule: true, default: Mock };
});

jest.mock('../src/screens/RegisterScreen', () => {
  const ReactMock = require('react');
  const Mock = () => ReactMock.createElement('RegisterScreen');
  return { __esModule: true, default: Mock };
});

jest.mock('../src/screens/FrontScreen', () => {
  const ReactMock = require('react');
  const Mock = () => ReactMock.createElement('FrontScreen');
  return { __esModule: true, default: Mock };
});

jest.mock('../src/screens/Configuration', () => {
  const ReactMock = require('react');
  const Mock = () => ReactMock.createElement('Configuration');
  return { __esModule: true, default: Mock };
});

// Import after mocks.
const App = require('../App').default;

it('renders correctly', async () => {
  let tree: ReactTestRenderer | null = null;

  await act(async () => {
    tree = renderer.create(<App />);
    // Flush at least one tick for passive effects.
    await Promise.resolve();
  });

  expect(tree).not.toBeNull();
  tree!.unmount();
});
