import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AudioRecorderPlayer from '../services/audioRecorderPlayer';

type VoiceNotePlayerVariant = 'composer' | 'reader';

type VoiceNotePlayerProps = {
  uri: string;
  durationSeconds?: number;
  title?: string;
  subtitle?: string;
  subtitleInputValue?: string;
  onChangeSubtitleInput?: (nextValue: string) => void;
  subtitleInputPlaceholder?: string;
  subtitleInputMaxLength?: number;
  onRemove?: () => void;
  variant?: VoiceNotePlayerVariant;
};

let activePlaybackOwnerId: string | null = null;
let activePlaybackReset: null | (() => void) = null;

const formatDurationLabel = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const stopSharedVoiceNotePlayback = async () => {
  try {
    await AudioRecorderPlayer.stopPlayer();
  } catch {
    // ignore
  }

  try {
    AudioRecorderPlayer.removePlayBackListener();
  } catch {
    // ignore
  }

  try {
    AudioRecorderPlayer.removePlaybackEndListener();
  } catch {
    // ignore
  }

  const reset = activePlaybackReset;
  activePlaybackOwnerId = null;
  activePlaybackReset = null;
  reset?.();
};

function VoiceNotePlayer({
  uri,
  durationSeconds = 0,
  title,
  subtitle,
  subtitleInputValue,
  onChangeSubtitleInput,
  subtitleInputPlaceholder,
  subtitleInputMaxLength,
  onRemove,
  variant = 'composer',
}: VoiceNotePlayerProps) {
  const ownerIdRef = useRef(`voice-note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const isMountedRef = useRef(true);
  const [isBusy, setIsBusy] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [resolvedDurationMs, setResolvedDurationMs] = useState(Math.max(0, Math.floor(durationSeconds)) * 1000);

  const resetPlaybackState = () => {
    if (!isMountedRef.current) {
      return;
    }

    setIsPlaying(false);
    setIsBusy(false);
    setPositionMs(0);
    setResolvedDurationMs(Math.max(0, Math.floor(durationSeconds)) * 1000);
  };

  useEffect(() => {
    setResolvedDurationMs(previous => Math.max(previous, Math.max(0, Math.floor(durationSeconds)) * 1000));
  }, [durationSeconds]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (activePlaybackOwnerId !== ownerIdRef.current) {
        return;
      }

      const reset = activePlaybackReset;
      activePlaybackOwnerId = null;
      activePlaybackReset = null;

      AudioRecorderPlayer.stopPlayer().catch(() => undefined);
      AudioRecorderPlayer.removePlayBackListener();
      AudioRecorderPlayer.removePlaybackEndListener();
      reset?.();
    };
  }, []);

  const handleTogglePlayback = async () => {
    const normalizedUri = String(uri || '').trim();
    if (!normalizedUri || isBusy) {
      return;
    }

    setIsBusy(true);
    try {
      if (activePlaybackOwnerId === ownerIdRef.current && isPlaying) {
        await stopSharedVoiceNotePlayback();
        return;
      }

      if (activePlaybackOwnerId && activePlaybackOwnerId !== ownerIdRef.current) {
        await stopSharedVoiceNotePlayback();
      }

      AudioRecorderPlayer.setSubscriptionDuration(0.2);
      AudioRecorderPlayer.removePlayBackListener();
      AudioRecorderPlayer.removePlaybackEndListener();

      activePlaybackOwnerId = ownerIdRef.current;
      activePlaybackReset = resetPlaybackState;

      await AudioRecorderPlayer.startPlayer(normalizedUri);
      AudioRecorderPlayer.addPlayBackListener((event) => {
        if (!isMountedRef.current || activePlaybackOwnerId !== ownerIdRef.current) {
          return;
        }

        const nextPositionMs = Math.max(0, Math.floor(Number(event.currentPosition) || 0));
        const nextDurationMs = Math.max(
          Math.max(0, Math.floor(durationSeconds)) * 1000,
          Math.max(0, Math.floor(Number(event.duration) || 0)),
        );

        setPositionMs(nextPositionMs);
        if (nextDurationMs > 0) {
          setResolvedDurationMs(nextDurationMs);
        }
      });
      AudioRecorderPlayer.addPlaybackEndListener(() => {
        if (activePlaybackOwnerId === ownerIdRef.current) {
          stopSharedVoiceNotePlayback().catch(() => undefined);
        }
      });
      setIsPlaying(true);
    } catch (error) {
      console.error('Error al reproducir la nota de voz:', error);
      resetPlaybackState();
    } finally {
      if (isMountedRef.current) {
        setIsBusy(false);
      }
    }
  };

  const durationMs = Math.max(resolvedDurationMs, Math.max(0, Math.floor(durationSeconds)) * 1000);
  const progressRatio = durationMs > 0 ? Math.max(0, Math.min(1, positionMs / durationMs)) : 0;
  const elapsedLabel = formatDurationLabel(positionMs / 1000);
  const durationLabel = formatDurationLabel(durationMs / 1000);
  const isSubtitleEditable = typeof onChangeSubtitleInput === 'function';

  return (
    <View style={[styles.container, variant === 'reader' ? styles.containerReader : styles.containerComposer]}>
      <View style={styles.topRow}>
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.85}
          onPress={handleTogglePlayback}
          style={styles.playButton}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <MaterialIcons
              name={isPlaying ? 'stop' : 'play-arrow'}
              size={20}
              color="#FFFFFF"
            />
          )}
        </TouchableOpacity>

        <View style={styles.copyColumn}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {isSubtitleEditable ? (
            <TextInput
              value={String(subtitleInputValue || '')}
              onChangeText={onChangeSubtitleInput}
              placeholder={subtitleInputPlaceholder}
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={[styles.subtitle, styles.subtitleInput]}
              maxLength={subtitleInputMaxLength}
              autoCapitalize="sentences"
              autoCorrect
            />
          ) : subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <Text style={styles.timeLabel}>{`${elapsedLabel} / ${durationLabel}`}</Text>
        </View>

        {onRemove ? (
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={onRemove}
            style={styles.removeButton}
          >
            <MaterialIcons name="close" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  containerComposer: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  containerReader: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 183, 77, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 77, 0.42)',
  },
  copyColumn: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  subtitleInput: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    margin: 0,
    minHeight: 18,
  },
  timeLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FFB74D',
  },
});

export default VoiceNotePlayer;
