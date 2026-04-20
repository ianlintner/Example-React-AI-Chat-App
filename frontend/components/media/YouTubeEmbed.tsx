import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { ForestColors } from '../../constants/Colors';

interface YouTubeEmbedProps {
  videoId: string;
  title: string;
  channel?: string;
  thumbnail: string;
  duration?: string;
}

export const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({
  videoId,
  title,
  channel,
  thumbnail,
  duration,
}) => {
  const handlePress = async () => {
    await WebBrowser.openBrowserAsync(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      },
    );
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe
          width='100%'
          height='220'
          src={`https://www.youtube.com/embed/${videoId}`}
          title={title}
          frameBorder='0'
          allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
          allowFullScreen
          style={{ borderRadius: 8 }}
        />
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {channel && <Text style={styles.channel}>{channel}</Text>}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.thumbnailContainer}>
        <Image
          source={{ uri: thumbnail }}
          style={styles.thumbnail}
          resizeMode='cover'
        />
        <View style={styles.overlay}>
          <View style={styles.playButton}>
            <Text style={styles.playIcon}>▶</Text>
          </View>
          {duration && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{duration}</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        🎬 {title}
      </Text>
      {channel && <Text style={styles.channel}>{channel}</Text>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: ForestColors.backgroundSecondary,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: ForestColors.borderLight,
  },
  thumbnailContainer: { position: 'relative', width: '100%', height: 180 },
  thumbnail: { width: '100%', height: '100%' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: { color: '#fff', fontSize: 22, marginLeft: 4 },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  title: {
    color: ForestColors.textNormal,
    fontSize: 13,
    fontWeight: '600',
    padding: 8,
    paddingBottom: 2,
  },
  channel: {
    color: ForestColors.textMuted,
    fontSize: 11,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
});
