/*
 * Ensures react-native-maps builds on React Native 0.76.x when using the old architecture.
 *
 * react-native-maps ships codegen-generated Java interfaces that reference
 * `com.facebook.react.uimanager.ViewManagerWithGeneratedInterface`, which was removed in RN 0.76.
 *
 * This script writes a small compatibility shim into react-native-maps' Android sources.
 */

const fs = require('fs');
const path = require('path');

const targetPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-maps',
  'android',
  'src',
  'main',
  'java',
  'com',
  'facebook',
  'react',
  'uimanager',
  'ViewManagerWithGeneratedInterface.java'
);

const content = `package com.facebook.react.uimanager;

/**
 * Compatibility shim for React Native 0.76+.
 *
 * react-native-maps codegen outputs currently reference
 * com.facebook.react.uimanager.ViewManagerWithGeneratedInterface, which no longer
 * exists in React Native 0.76.
 *
 * In older React Native versions this acted as a marker interface for generated
 * ViewManager interfaces. For our usage here, a no-op marker is sufficient.
 */
public interface ViewManagerWithGeneratedInterface {}
`;

try {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`[postinstall] Wrote RN maps shim: ${targetPath}`);
} catch (err) {
  // eslint-disable-next-line no-console
  console.warn('[postinstall] Failed to write RN maps shim:', err && err.message ? err.message : err);
}
