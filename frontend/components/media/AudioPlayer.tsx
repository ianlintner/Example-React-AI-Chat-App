import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { ForestColors } from '../../constants/Colors';

interface AudioPlayerProps {
  url: string;
  title: string;
  artist?: string;
  durationSec?: number;
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  url,
  title,
  artist,
  durationSec,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [sound, setSound] = useState<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (sound) sound.unloadAsync?.();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sound]);

  const toggle = async () => {
    try {
      if (!sound) {
        setIsLoading(true);
        const { Audio } = await import('expo-av');
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true },
        );
        setSound(newSound);
        setIsPlaying(true);
        setIsLoading(false);
        intervalRef.current = setInterval(async () => {
          const status = await newSound.getStatusAsync();
          if (status.isLoaded) setPosition(status.positionMillis / 1000);
        }, 500);
        newSound.setOnPlaybackStatusUpdate(status => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
            setPosition(0);
            if (intervalRef.current) clearInterval(intervalRef.current);
          }
        });
      } else {
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      }
    } catch (err) {
      console.error('[AudioPlayer] error', err);
      setIsLoading(false);
    }
  };

  const duration = durationSec ?? 30;

  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          🎵 {title}
        </Text>
        {artist && (
          <Text style={styles.artist} numberOfLines={1}>
            {artist}
          </Text>
        )}
      </View>
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={toggle}
          style={styles.playBtn}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size='small' color={ForestColors.brandPrimary} />
          ) : (
            <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
          )}
        </TouchableOpacity>
        <View style={styles.progress}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min((position / duration) * 100, 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.time}>
          {formatTime(position)}/{formatTime(duration)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: ForestColors.backgroundSecondary,
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: ForestColors.brandPrimary,
  },
  info: { marginBottom: 8 },
  title: { color: ForestColors.textNormal, fontSize: 13, fontWeight: '600' },
  artist: { color: ForestColors.textMuted, fontSize: 11, marginTop: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ForestColors.brandPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: { color: '#fff', fontSize: 14, marginLeft: 2 },
  progress: {
    flex: 1,
    height: 4,
    backgroundColor: ForestColors.borderLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ForestColors.brandPrimary,
    borderRadius: 2,
  },
  time: {
    color: ForestColors.textMuted,
    fontSize: 11,
    minWidth: 72,
    textAlign: 'right',
  },
});
