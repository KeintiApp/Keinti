/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function replaceExactlyOnce(content, searchValue, replaceValue, label) {
  const occurrences = content.split(searchValue).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${label}: expected exactly 1 occurrence, found ${occurrences}`);
  }
  return content.replace(searchValue, replaceValue);
}

function patchFile(targetPath, patches) {
  let content = fs.readFileSync(targetPath, 'utf8');
  let changed = false;

  for (const patch of patches) {
    if (content.includes(patch.after)) {
      continue;
    }

    content = replaceExactlyOnce(content, patch.before, patch.after, patch.label);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(targetPath, content, 'utf8');
    console.log(`[postinstall] patched ${path.relative(process.cwd(), targetPath)}`);
  } else {
    console.log(`[postinstall] already patched ${path.relative(process.cwd(), targetPath)}`);
  }
}

try {
  const reanimatedAndroidRoot = path.join(
    __dirname,
    '..',
    'node_modules',
    'react-native-reanimated',
    'android',
    'src',
    'main',
    'cpp'
  );

  patchFile(path.join(reanimatedAndroidRoot, 'worklets', 'CMakeLists.txt'), [
    {
      label: 'Reanimated worklets link c++ shared',
      before: `target_link_libraries(worklets log ReactAndroid::jsi fbjni::fbjni)
`,
      after: `target_link_libraries(worklets log ReactAndroid::jsi fbjni::fbjni c++_shared)
`,
    },
  ]);

  patchFile(path.join(reanimatedAndroidRoot, 'reanimated', 'CMakeLists.txt'), [
    {
      label: 'Reanimated library link c++ shared',
      before: `target_link_libraries(reanimated worklets android)
`,
      after: `target_link_libraries(reanimated worklets android c++_shared)
`,
    },
  ]);
} catch (error) {
  console.warn(
    '[postinstall] fix-react-native-reanimated-android-linking failed:',
    error && error.message ? error.message : String(error)
  );
  process.exitCode = 1;
}