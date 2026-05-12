const fs = require('fs');
const path = require('path');

const targetPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-audio-recorder-player',
  'android',
  'CMakeLists.txt'
);

const content = `project(NitroAudioRecorderPlayer)
cmake_minimum_required(VERSION 3.9.0)

set(PACKAGE_NAME NitroAudioRecorderPlayer)
set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)

add_library(
  \${PACKAGE_NAME} SHARED
  src/main/cpp/cpp-adapter.cpp
  ../nitrogen/generated/android/NitroAudioRecorderPlayerOnLoad.cpp
  ../nitrogen/generated/shared/c++/HybridAudioRecorderPlayerSpec.cpp
  ../nitrogen/generated/android/c++/JHybridAudioRecorderPlayerSpec.cpp
)

include_directories(
  "src/main/cpp"
  "../cpp"
  "../nitrogen/generated/shared/c++"
  "../nitrogen/generated/android/c++"
  "../nitrogen/generated/android"
  "../../react-native-nitro-modules/android/build/headers/nitromodules"
)

add_definitions(-DBUILDING_NITROAUDIORECORDERPLAYER_WITH_GENERATED_CMAKE_PROJECT)

target_compile_definitions(
  \${PACKAGE_NAME} PRIVATE
  -DFOLLY_NO_CONFIG=1
  -DFOLLY_HAVE_CLOCK_GETTIME=1
  -DFOLLY_USE_LIBCPP=1
  -DFOLLY_CFG_NO_COROUTINES=1
  -DFOLLY_MOBILE=1
  -DFOLLY_HAVE_RECVMMSG=1
  -DFOLLY_HAVE_PTHREAD=1
  -DFOLLY_HAVE_XSI_STRERROR_R=1
)

find_library(LOG_LIB log)
find_package(fbjni REQUIRED)
find_package(ReactAndroid REQUIRED)

file(GLOB NITRO_MODULES_LIBS
  "\${CMAKE_SOURCE_DIR}/../../react-native-nitro-modules/android/build/intermediates/cxx/Debug/*/obj/\${ANDROID_ABI}/libNitroModules.so"
  "\${CMAKE_SOURCE_DIR}/../../react-native-nitro-modules/android/build/intermediates/cmake/debug/obj/\${ANDROID_ABI}/libNitroModules.so"
)

target_link_libraries(
  \${PACKAGE_NAME}
  \${LOG_LIB}
  android
  fbjni::fbjni
  ReactAndroid::jsi
  c++_shared
  \${NITRO_MODULES_LIBS}
)

if(ReactAndroid_VERSION_MINOR GREATER_EQUAL 76)
  target_link_libraries(
    \${PACKAGE_NAME}
    ReactAndroid::reactnative
  )
else()
  target_link_libraries(
    \${PACKAGE_NAME}
    ReactAndroid::react_nativemodule_core
  )
endif()
`;

try {
  const current = fs.readFileSync(targetPath, 'utf8');

  if (current === content) {
    console.log('[postinstall] react-native-audio-recorder-player cmake already patched');
  } else {
    fs.writeFileSync(targetPath, content, 'utf8');
    console.log('[postinstall] patched react-native-audio-recorder-player cmake');
  }
} catch (error) {
  console.warn(
    '[postinstall] fix-react-native-audio-recorder-player-cmake failed:',
    error && error.message ? error.message : String(error)
  );
  process.exitCode = 1;
}
