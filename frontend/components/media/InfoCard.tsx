import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ForestColors } from '../../constants/Colors';

interface InfoCardProps {
  kind: string;
  title: string;
  fields: Array<{ label: string; value: string }>;
  accentColor?: string;
}

export const InfoCard: React.FC<InfoCardProps> = ({
  kind,
  title,
  fields,
  accentColor = ForestColors.brandPrimary,
}) => (
  <View style={[styles.container, { borderColor: `${accentColor}66` }]}>
    <View style={[styles.header, { backgroundColor: `${accentColor}22` }]}>
      <Text style={[styles.kind, { color: accentColor }]}>
        {kind.toUpperCase()}
      </Text>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
    </View>
    <View style={styles.fields}>
      {fields.map((f, i) => (
        <View
          key={i}
          style={[styles.row, i < fields.length - 1 && styles.rowBorder]}
        >
          <Text style={styles.label}>{f.label}</Text>
          <Text style={styles.value} numberOfLines={2}>
            {f.value}
          </Text>
        </View>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: ForestColors.backgroundSecondary,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 6,
    borderWidth: 1,
  },
  header: { padding: 12, paddingBottom: 8 },
  kind: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  title: { color: ForestColors.textNormal, fontSize: 15, fontWeight: '700' },
  fields: { padding: 12, gap: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: ForestColors.borderLight,
  },
  label: { color: ForestColors.textMuted, fontSize: 12, flex: 0.4 },
  value: {
    color: ForestColors.textNormal,
    fontSize: 12,
    flex: 0.6,
    textAlign: 'right',
  },
});
