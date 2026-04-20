import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { ForestColors } from '../../constants/Colors';

interface VideoPlayerProps {
  url: string;
  title: string;
  poster?: string;
}

const NativeVideoPlayer: React.FC<VideoPlayerProps> = ({ url, title }) => {
  // expo-video may not be present in all environments; degrade gracefully
  let VideoView: React.ComponentType<{
    player: unknown;
    style: object;
    allowsFullscreen?: boolean;
    allowsPictureInPicture?: boolean;
  }> | null = null;
  let useVideoPlayer:
    | ((u: string, init: (p: { loop: boolean }) => void) => unknown)
    | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-video');
    VideoView = mod.VideoView;
    useVideoPlayer = mod.useVideoPlayer;
  } catch {
    // module not available
  }

  // Hooks must be called unconditionally — if useVideoPlayer is missing, render fallback
  // We always call the hook (or a no-op fallback) to satisfy rules-of-hooks
  const player = (
    useVideoPlayer ??
    ((_u: string, _init: (p: { loop: boolean }) => void) => null)
  )(url, (p: { loop: boolean }) => {
    p.loop = false;
  });

  if (!VideoView) {
    return (
      <View style={styles.container}>
        <Text style={styles.fallback}>Video: {title}</Text>
        <Text style={styles.url} numberOfLines={1}>
          {url}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        allowsFullscreen
        allowsPictureInPicture
      />
      <Text style={styles.title} numberOfLines={2}>
        📹 {title}
      </Text>
    </View>
  );
};

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  url,
  title,
  poster,
}) => {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <video
          src={url}
          poster={poster}
          controls
          style={{ width: '100%', borderRadius: 8, maxHeight: 240 }}
        />
        <Text style={styles.title} numberOfLines={2}>
          📹 {title}
        </Text>
      </View>
    );
  }
  return <NativeVideoPlayer url={url} title={title} poster={poster} />;
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: ForestColors.backgroundSecondary,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 6,
    borderWidth: 1,
    borderColor: ForestColors.borderLight,
  },
  video: { width: '100%', height: 220 },
  title: {
    color: ForestColors.textNormal,
    fontSize: 13,
    fontWeight: '600',
    padding: 8,
  },
  fallback: { color: ForestColors.textNormal, padding: 12 },
  url: {
    color: ForestColors.textMuted,
    fontSize: 11,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
});
