/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function ensureFileCopy(src, dest) {
  if (fs.existsSync(dest)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

try {
  const localesDir = path.join(
    __dirname,
    '..',
    'node_modules',
    '@react-native',
    'debugger-frontend',
    'dist',
    'third-party',
    'front_end',
    'core',
    'i18n',
    'locales'
  );

  const enUs = path.join(localesDir, 'en-US.json');
  const es = path.join(localesDir, 'es.json');

  if (fs.existsSync(enUs)) {
    ensureFileCopy(enUs, es);
    console.log('[postinstall] debugger-frontend locales: ensured es.json');
  } else {
    console.warn('[postinstall] debugger-frontend locales: en-US.json not found, skipped');
  }
} catch (e) {
  console.warn('[postinstall] fix-debugger-locales failed:', e && e.message ? e.message : String(e));
}
