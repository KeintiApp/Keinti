const fs = require('fs');
const path = require('path');

function replaceExactlyOnce(content, searchValue, replaceValue, label) {
  const occurrences = content.split(searchValue).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${label}: expected exactly 1 occurrence, found ${occurrences}`);
  }
  return content.replace(searchValue, replaceValue);
}

try {
  const targetPath = path.join(
    __dirname,
    '..',
    'node_modules',
    'react-native-audio-recorder-player',
    'android',
    'build.gradle'
  );

  let content = fs.readFileSync(targetPath, 'utf8');
  const alreadyPatched = content.includes('ndkVersion getExtOrDefault("ndkVersion")');

  if (!alreadyPatched) {
    content = replaceExactlyOnce(
      content,
      `android {
  namespace "com.margelo.nitro.audiorecorderplayer"

  compileSdkVersion getExtOrIntegerDefault("compileSdkVersion")
`,
      `android {
  namespace "com.margelo.nitro.audiorecorderplayer"

  ndkVersion getExtOrDefault("ndkVersion")
  compileSdkVersion getExtOrIntegerDefault("compileSdkVersion")
`,
      'Audio recorder player NDK version patch'
    );

    fs.writeFileSync(targetPath, content, 'utf8');
    console.log('[postinstall] patched react-native-audio-recorder-player ndkVersion');
  } else {
    console.log('[postinstall] react-native-audio-recorder-player ndkVersion already patched');
  }
} catch (error) {
  console.warn(
    '[postinstall] fix-react-native-audio-recorder-player-ndk failed:',
    error && error.message ? error.message : String(error)
  );
  process.exitCode = 1;
}
