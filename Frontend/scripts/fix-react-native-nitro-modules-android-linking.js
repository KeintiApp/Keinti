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
    'react-native-nitro-modules',
    'android',
    'CMakeLists.txt'
  );

  let content = fs.readFileSync(targetPath, 'utf8');
  const alreadyPatched = content.includes('c++_shared                               # <-- Android STL runtime');

  if (!alreadyPatched) {
    content = replaceExactlyOnce(
      content,
      `target_link_libraries(
        NitroModules
        \${LOG_LIB}                                # <-- Logcat logger
        android                                   # <-- Android JNI core
        fbjni::fbjni                              # <-- Facebook C++ JNI helpers
        ReactAndroid::jsi                         # <-- RN: JSI
)
`,
      `target_link_libraries(
        NitroModules
        \${LOG_LIB}                                # <-- Logcat logger
        android                                   # <-- Android JNI core
        fbjni::fbjni                              # <-- Facebook C++ JNI helpers
        ReactAndroid::jsi                         # <-- RN: JSI
        c++_shared                               # <-- Android STL runtime
)
`,
      'Nitro modules link c++ shared'
    );

    fs.writeFileSync(targetPath, content, 'utf8');
    console.log('[postinstall] patched react-native-nitro-modules android linking');
  } else {
    console.log('[postinstall] react-native-nitro-modules android linking already patched');
  }
} catch (error) {
  console.warn(
    '[postinstall] fix-react-native-nitro-modules-android-linking failed:',
    error && error.message ? error.message : String(error)
  );
  process.exitCode = 1;
}
