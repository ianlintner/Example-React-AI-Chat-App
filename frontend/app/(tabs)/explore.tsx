import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function TabTwoScreen() {
  return (
    <View style={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText type="title">Explore</ThemedText>
        <ThemedText type="default" style={styles.description}>
          This tab previously contained a validation dashboard which has been migrated to Prometheus + Grafana for professional monitoring.
        </ThemedText>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  description: {
    textAlign: 'center',
    marginTop: 10,
  },
});
