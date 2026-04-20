import React from 'react';
import {
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { ForestColors } from '../../constants/Colors';

interface ImageGalleryProps {
  images: Array<{ url: string; alt: string }>;
}

const TILE_WIDTH = Math.min(Dimensions.get('window').width * 0.55, 240);

export const ImageGallery: React.FC<ImageGalleryProps> = ({ images }) => {
  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      <TouchableOpacity
        style={styles.single}
        onPress={() => WebBrowser.openBrowserAsync(images[0].url)}
        activeOpacity={0.85}
      >
        <Image
          source={{ uri: images[0].url }}
          style={styles.singleImage}
          contentFit='cover'
        />
        {images[0].alt && (
          <Text style={styles.caption} numberOfLines={1}>
            {images[0].alt}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <FlatList
      horizontal
      data={images}
      keyExtractor={(_, i) => String(i)}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.tile, { width: TILE_WIDTH }]}
          onPress={() => WebBrowser.openBrowserAsync(item.url)}
          activeOpacity={0.85}
        >
          <Image
            source={{ uri: item.url }}
            style={styles.tileImage}
            contentFit='cover'
          />
          {item.alt && (
            <Text style={styles.tileCaption} numberOfLines={1}>
              {item.alt}
            </Text>
          )}
        </TouchableOpacity>
      )}
    />
  );
};

const styles = StyleSheet.create({
  list: { paddingVertical: 6, gap: 8 },
  single: {
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 6,
    borderWidth: 1,
    borderColor: ForestColors.borderLight,
  },
  singleImage: { width: '100%', height: 200 },
  caption: {
    color: ForestColors.textMuted,
    fontSize: 11,
    padding: 6,
    textAlign: 'center',
  },
  tile: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: ForestColors.borderLight,
    backgroundColor: ForestColors.backgroundTertiary,
  },
  tileImage: { width: '100%', height: 150 },
  tileCaption: {
    color: ForestColors.textMuted,
    fontSize: 10,
    padding: 4,
    textAlign: 'center',
  },
});
