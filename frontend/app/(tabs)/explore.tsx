import React from 'react';
import { View, StyleSheet } from 'react-native';
import ValidationDashboard from '../../components/ValidationDashboard';

export default function TabTwoScreen() {
  return (
    <View style={styles.container}>
      <ValidationDashboard />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});
