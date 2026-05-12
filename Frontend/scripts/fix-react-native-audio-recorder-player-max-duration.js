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
    'src',
    'main',
    'java',
    'com',
    'dooboolab.audiorecorderplayer',
    'RNAudioRecorderPlayerModule.kt'
  );

  let content = fs.readFileSync(targetPath, 'utf8');
  const alreadyPatched = content.includes('audioSet.hasKey("MaxDurationMillis")');

  if (!alreadyPatched) {
    content = replaceExactlyOnce(
      content,
      `            }
            newMediaRecorder.setOutputFile(audioFileURL)
`,
      `            }

            if (audioSet != null && audioSet.hasKey("MaxDurationMillis")) {
                val maxDurationMillis = audioSet.getInt("MaxDurationMillis")
                if (maxDurationMillis > 0) {
                    newMediaRecorder.setMaxDuration(maxDurationMillis)
                    newMediaRecorder.setOnInfoListener { recorder, what, _ ->
                        if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED) {
                            recorderRunnable?.let { recordHandler?.removeCallbacks(it) }
                            try {
                                recorder.stop()
                            } catch (stopException: RuntimeException) {
                                stopException.message?.let { Log.d(tag, it) }
                            }
                            try {
                                recorder.release()
                            } catch (releaseException: Exception) {
                                releaseException.message?.let { Log.d(tag, it) }
                            }
                            mediaRecorder = null
                        }
                    }
                }
            }
            newMediaRecorder.setOutputFile(audioFileURL)
`,
      'Audio recorder player max duration patch'
    );

    fs.writeFileSync(targetPath, content, 'utf8');
    console.log('[postinstall] patched react-native-audio-recorder-player max duration');
  } else {
    console.log('[postinstall] react-native-audio-recorder-player max duration already patched');
  }
} catch (error) {
  console.warn(
    '[postinstall] fix-react-native-audio-recorder-player-max-duration failed:',
    error && error.message ? error.message : String(error)
  );
  process.exitCode = 1;
}
