const AudioEncoderAndroidType = {
  AAC: 'aac',
};

const AudioSourceAndroidType = {
  MIC: 'mic',
};

const AVEncodingOption = {
  aac: 'aac',
};

const AVEncoderAudioQualityIOSType = {
  medium: 'medium',
};

const OutputFormatAndroidType = {
  MPEG_4: 'mpeg4',
};

class AudioRecorderPlayerMock {
  constructor() {
    this.recordBackListener = null;
    this.playBackListener = null;
  }

  mmss = jest.fn(() => '00:00');

  mmssss = jest.fn(() => '00:00.000');

  addRecordBackListener = jest.fn((callback) => {
    this.recordBackListener = callback;
  });

  removeRecordBackListener = jest.fn(() => {
    this.recordBackListener = null;
  });

  addPlayBackListener = jest.fn((callback) => {
    this.playBackListener = callback;
  });

  removePlayBackListener = jest.fn(() => {
    this.playBackListener = null;
  });

  startRecorder = jest.fn((_uri, _audioSets, _meteringEnabled) => Promise.resolve('mock-recording.m4a'));

  pauseRecorder = jest.fn(() => Promise.resolve());

  resumeRecorder = jest.fn(() => Promise.resolve());

  stopRecorder = jest.fn(() => Promise.resolve('mock-recording.m4a'));

  startPlayer = jest.fn((uri) => Promise.resolve(uri || 'mock-playback.m4a'));

  stopPlayer = jest.fn(() => Promise.resolve());

  pausePlayer = jest.fn(() => Promise.resolve());

  resumePlayer = jest.fn(() => Promise.resolve());

  seekToPlayer = jest.fn(() => Promise.resolve());

  setVolume = jest.fn(() => Promise.resolve());

  setPlaybackSpeed = jest.fn(() => Promise.resolve());

  setSubscriptionDuration = jest.fn(() => undefined);
}

module.exports = AudioRecorderPlayerMock;
module.exports.default = AudioRecorderPlayerMock;
module.exports.AudioEncoderAndroidType = AudioEncoderAndroidType;
module.exports.AudioSourceAndroidType = AudioSourceAndroidType;
module.exports.AVEncodingOption = AVEncodingOption;
module.exports.AVEncoderAudioQualityIOSType = AVEncoderAudioQualityIOSType;
module.exports.OutputFormatAndroidType = OutputFormatAndroidType;
