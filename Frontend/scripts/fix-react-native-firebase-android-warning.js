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
  const targetPath = path.join(
    __dirname,
    '..',
    'node_modules',
    '@react-native-firebase',
    'app',
    'android',
    'build.gradle'
  );

  patchFile(targetPath, [
    {
      label: 'Fix RNFirebase Android warning suppression env check',
      before: "if (isNewArchitectureDisabled() && System.getenv('RNFB_SUPPRESS_NEW_ARCHITECTURE_WARNING') != 1) {\n",
      after: "if (isNewArchitectureDisabled() && System.getenv('RNFB_SUPPRESS_NEW_ARCHITECTURE_WARNING') != '1') {\n",
    },
  ]);
} catch (error) {
  console.warn(
    '[postinstall] fix-react-native-firebase-android-warning failed:',
    error && error.message ? error.message : String(error)
  );
  process.exitCode = 1;
}