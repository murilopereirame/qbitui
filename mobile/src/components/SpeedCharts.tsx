import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { SPEED_HISTORY_SIZE, SPEED_SAMPLE_MS, type SpeedSample } from '@/hooks/use-speed-history';
import { formatSpeed } from '@/lib/utils';

interface Props {
  history: SpeedSample[];
  /** Live values, shown as the current reading above each graph. */
  dlSpeed: number;
  upSpeed: number;
}

/** Bars shorter than this are still drawn, so a quiet series stays visible. */
const MIN_BAR_HEIGHT = 2;
const CHART_HEIGHT = 56;

function windowLabel(): string {
  const seconds = (SPEED_HISTORY_SIZE * SPEED_SAMPLE_MS) / 1000;
  return seconds >= 60 ? `last ${Math.round(seconds / 60)} min` : `last ${seconds}s`;
}

/**
 * Download and upload speed over time.
 *
 * Each graph is scaled to its own peak — upload is usually a fraction of
 * download, and a shared axis would flatten it into an unreadable line — so
 * the peak is labelled underneath to keep the magnitude clear.
 */
export function SpeedCharts({ history, dlSpeed, upSpeed }: Props) {
  const styles = useThemedStyles(createStyles);
  const colors = useTheme();

  const peakDl = history.reduce((max, sample) => Math.max(max, sample.dl), 0);
  const peakUp = history.reduce((max, sample) => Math.max(max, sample.up), 0);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Speed</Text>
        <Text style={styles.cardWindow}>{windowLabel()}</Text>
      </View>

      <Series
        label="Download"
        color={colors.accent}
        values={history.map((sample) => sample.dl)}
        current={dlSpeed}
        peak={peakDl}
      />
      <Series
        label="Upload"
        color={colors.stateGreen}
        values={history.map((sample) => sample.up)}
        current={upSpeed}
        peak={peakUp}
      />
    </View>
  );
}

function Series({
  label,
  color,
  values,
  current,
  peak,
}: {
  label: string;
  color: string;
  values: number[];
  current: number;
  peak: number;
}) {
  const styles = useThemedStyles(createStyles);
  // Left-pad so the graph fills from the right as samples come in.
  const padding = Math.max(0, SPEED_HISTORY_SIZE - values.length);
  const scale = Math.max(peak, 1);

  return (
    <View style={styles.series}>
      <View style={styles.seriesHeader}>
        <Text style={styles.seriesLabel}>{label}</Text>
        <Text style={[styles.seriesCurrent, { color }]}>{formatSpeed(current)}</Text>
      </View>

      <View style={styles.chart} accessibilityLabel={`${label} speed graph`}>
        {Array.from({ length: padding }, (_, i) => (
          <View key={`pad-${i}`} style={styles.bar} />
        ))}
        {values.map((value, i) => (
          <View key={i} style={styles.bar}>
            <View
              style={[
                styles.barFill,
                {
                  backgroundColor: color,
                  height: Math.max(MIN_BAR_HEIGHT, (value / scale) * CHART_HEIGHT),
                },
              ]}
            />
          </View>
        ))}
      </View>

      <Text style={styles.seriesPeak}>peak {formatSpeed(peak)}</Text>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      gap: 12,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardTitle: {
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    cardWindow: { color: c.textSubtle, fontSize: 11 },
    series: { gap: 4 },
    seriesHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    seriesLabel: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
    seriesCurrent: { fontSize: 13, fontWeight: '700' },
    chart: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: CHART_HEIGHT,
      gap: 1,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      paddingBottom: 1,
    },
    bar: { flex: 1, justifyContent: 'flex-end' },
    barFill: { width: '100%', borderRadius: 1 },
    seriesPeak: { color: c.textSubtle, fontSize: 11, textAlign: 'right' },
  });
