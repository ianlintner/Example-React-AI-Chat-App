import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ForestColors } from '../../constants/Colors';

interface DiceCardProps {
  notation: string;
  rolls: number[];
  total: number;
  purpose?: string;
}

export const DiceCard: React.FC<DiceCardProps> = ({
  notation,
  rolls,
  total,
  purpose,
}) => (
  <View style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.notation}>🎲 {notation}</Text>
      {purpose && <Text style={styles.purpose}>{purpose}</Text>}
    </View>
    <View style={styles.rollsRow}>
      {rolls.map((r, i) => (
        <View key={i} style={styles.die}>
          <Text style={styles.dieValue}>{r}</Text>
        </View>
      ))}
    </View>
    <View style={styles.totalRow}>
      <Text style={styles.totalLabel}>Total</Text>
      <Text style={styles.totalValue}>{total}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: ForestColors.backgroundSecondary,
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#7c3aed44',
  },
  header: { marginBottom: 10 },
  notation: { color: ForestColors.textNormal, fontSize: 14, fontWeight: '700' },
  purpose: { color: ForestColors.textMuted, fontSize: 11, marginTop: 2 },
  rollsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  die: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#7c3aed22',
    borderWidth: 1,
    borderColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dieValue: { color: '#a78bfa', fontSize: 16, fontWeight: '700' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: ForestColors.borderLight,
    paddingTop: 8,
  },
  totalLabel: { color: ForestColors.textMuted, fontSize: 13 },
  totalValue: { color: '#a78bfa', fontSize: 24, fontWeight: '900' },
});
