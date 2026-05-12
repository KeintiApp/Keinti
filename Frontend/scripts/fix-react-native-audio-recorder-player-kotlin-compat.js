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
    'nitrogen',
    'generated',
    'android',
    'kotlin',
    'com',
    'margelo',
    'nitro',
    'audiorecorderplayer',
    'HybridAudioRecorderPlayerSpec.kt'
  );

  let content = fs.readFileSync(targetPath, 'utf8');
  const alreadyPatched = content.includes('private val mHybridData: HybridData = initHybrid()');

  if (!alreadyPatched) {
    content = replaceExactlyOnce(
      content,
      `abstract class HybridAudioRecorderPlayerSpec: HybridObject() {
  @DoNotStrip
  private var mHybridData: HybridData = initHybrid()

  init {
    super.updateNative(mHybridData)
  }

  override fun updateNative(hybridData: HybridData) {
    mHybridData = hybridData
    super.updateNative(hybridData)
  }

  // Properties
`,
      `abstract class HybridAudioRecorderPlayerSpec: HybridObject() {
  @DoNotStrip
  private val mHybridData: HybridData = initHybrid()

  // Properties
`,
      'Audio recorder player Kotlin compatibility patch'
    );

    fs.writeFileSync(targetPath, content, 'utf8');
    console.log('[postinstall] patched react-native-audio-recorder-player kotlin compatibility');
  } else {
    console.log('[postinstall] react-native-audio-recorder-player kotlin compatibility already patched');
  }
} catch (error) {
  console.warn(
    '[postinstall] fix-react-native-audio-recorder-player-kotlin-compat failed:',
    error && error.message ? error.message : String(error)
  );
  process.exitCode = 1;
}
