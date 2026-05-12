import { NativeModules, Platform } from 'react-native';
import LegacyAudioRecorderPlayer, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  AVEncodingOption,
  AVEncoderAudioQualityIOSType,
  OutputFormatAndroidType,
  type AudioSet as LegacyAudioSet,
  type PlayBackType,
  type RecordBackType,
} from 'react-native-audio-recorder-player';

type PlaybackEndListener = () => void;
type AudioSet = LegacyAudioSet & {
  MaxDurationMillis?: number;
};

const nativeAudioRecorderPlayer = NativeModules.RNAudioRecorderPlayer as undefined | {
  stopRecorder?: () => Promise<string>;
};

class AudioRecorderPlayerCompat {
  private readonly player = new LegacyAudioRecorderPlayer();
  private playbackListener: null | ((event: PlayBackType) => void) = null;
  private playbackEndListener: PlaybackEndListener | null = null;

  private syncPlaybackListener() {
    this.player.removePlayBackListener();

    if (!this.playbackListener && !this.playbackEndListener) {
      return;
    }

    this.player.addPlayBackListener((event: PlayBackType) => {
      this.playbackListener?.(event);
      if (event?.isFinished) {
        this.playbackEndListener?.();
      }
    });
  }

  mmss(secs: number) {
    return this.player.mmss(secs);
  }

  mmssss(millisecs: number) {
    return this.player.mmssss(millisecs);
  }

  addRecordBackListener(callback: (recordingMeta: RecordBackType) => void) {
    this.player.addRecordBackListener(callback);
  }

  removeRecordBackListener() {
    this.player.removeRecordBackListener();
  }

  addPlayBackListener(callback: (playbackMeta: PlayBackType) => void) {
    this.playbackListener = callback;
    this.syncPlaybackListener();
  }

  removePlayBackListener() {
    this.playbackListener = null;
    this.syncPlaybackListener();
  }

  addPlaybackEndListener(callback: PlaybackEndListener) {
    this.playbackEndListener = callback;
    this.syncPlaybackListener();
  }

  removePlaybackEndListener() {
    this.playbackEndListener = null;
    this.syncPlaybackListener();
  }

  startRecorder(uri?: string, audioSets?: AudioSet, meteringEnabled?: boolean) {
    return this.player.startRecorder(uri, audioSets, meteringEnabled);
  }

  pauseRecorder() {
    return this.player.pauseRecorder();
  }

  resumeRecorder() {
    return this.player.resumeRecorder();
  }

  async stopRecorder() {
    if (Platform.OS === 'android' && Number(Platform.Version) >= 24) {
      try {
        await this.player.pauseRecorder();
      } catch {
        // Fall through to the existing stop flow if the recorder was already paused/stopped.
      }
    }

    if (Platform.OS === 'android' && nativeAudioRecorderPlayer?.stopRecorder) {
      try {
        const nativeResult = await nativeAudioRecorderPlayer.stopRecorder();

        // Keep the legacy wrapper state in sync, but don't block on it.
        this.player.stopRecorder().catch(() => undefined);

        return nativeResult;
      } catch {
        // Fall through to the legacy wrapper path below.
      }
    }

    try {
      const result = await this.player.stopRecorder();
      if (result === 'Already stopped' && nativeAudioRecorderPlayer?.stopRecorder) {
        return await nativeAudioRecorderPlayer.stopRecorder();
      }
      return result;
    } catch (error) {
      if (nativeAudioRecorderPlayer?.stopRecorder) {
        try {
          return await nativeAudioRecorderPlayer.stopRecorder();
        } catch {
          // Fall through to the original JS-package error.
        }
      }
      throw error;
    }
  }

  startPlayer(uri?: string, httpHeaders?: Record<string, string>) {
    return this.player.startPlayer(uri, httpHeaders);
  }

  stopPlayer() {
    return this.player.stopPlayer();
  }

  pausePlayer() {
    return this.player.pausePlayer();
  }

  resumePlayer() {
    return this.player.resumePlayer();
  }

  seekToPlayer(time: number) {
    return this.player.seekToPlayer(time);
  }

  setVolume(volume: number) {
    return this.player.setVolume(volume);
  }

  setPlaybackSpeed(playbackSpeed: number) {
    return this.player.setPlaybackSpeed(playbackSpeed);
  }

  setSubscriptionDuration(sec: number) {
    return this.player.setSubscriptionDuration(sec);
  }
}

const audioRecorderPlayer = new AudioRecorderPlayerCompat();

export default audioRecorderPlayer;
export {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  AVEncodingOption,
  AVEncoderAudioQualityIOSType,
  OutputFormatAndroidType,
};
export type { AudioSet, PlayBackType, RecordBackType };
