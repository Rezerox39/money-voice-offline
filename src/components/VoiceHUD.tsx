// ─────────────────────────────────────────────────────────────────
// VoiceHUD.tsx — Monospace terminal overlay for voice capture
// Renders above bottom dock during/after voice capture.
// States: listening | parsed & counting down | error
// ─────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { VoiceState } from '../hooks/useVoiceExpense';
import type { ParseResult } from '../lib/voiceParser';

// ── Props ──────────────────────────────────────────────────────────

interface VoiceHUDProps {
  state: VoiceState;
  onCancel: () => void;
  onConfirm: () => void;
  onEdit: () => void;
}

// ── ASCII VU Meter ─────────────────────────────────────────────────

const VU_BARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

function VuMeter({ active }: { active: boolean }) {
  const bars = useMemo(() => {
    if (!active) return '▁▁▁▁▁▁▁▁';
    // Deterministic "pulsing" pattern for static display
    return '▂▃▅▆▇▆▅▃';
  }, [active]);

  return <Text style={styles.vuMeter}>{bars}</Text>;
}

// ── Progress Bar ───────────────────────────────────────────────────

function CountdownBar({ countdown }: { countdown: number }) {
  const progress = Math.max(0, Math.min(1, countdown / 2.0));
  const filled = Math.round(progress * 20);
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);

  return (
    <Text style={styles.countdownBar}>
      [{bar}] {countdown.toFixed(1)}s
    </Text>
  );
}

// ── Format Parsed Result ───────────────────────────────────────────

function formatParsed(result: ParseResult): string[] {
  if (result.type === 'expense') {
    const payer = result.payer === '__SELF__' ? 'YOU' : (result.payer ?? 'YOU').toUpperCase();
    let splitStr: string;
    if (result.isPool) splitStr = 'POOL';
    else if (result.splitMode === 'none') splitStr = 'PERSONAL';
    else if (result.splitMode === 'exact') {
      splitStr = Object.entries(result.exactSplits)
        .map(([n, a]) => `${n.toUpperCase()}=${a}`)
        .join(', ');
    } else if (result.splitMembers.length === 0) splitStr = 'ALL';
    else splitStr = result.splitMembers.map((m) => m === '__SELF__' ? 'YOU' : m.toUpperCase()).join(' + ');

    return [
      `>>> PARSED: ₹${result.amount.toLocaleString('en-IN')} | ${result.title.toUpperCase()}`,
      `>>> PAYER: ${payer} | SPLIT: ${splitStr}`,
    ];
  }
  if (result.type === 'pool') {
    return [`>>> POOL ${result.intent === 'POOL_DEPOSIT' ? 'DEPOSIT' : 'WITHDRAW'}: ₹${result.amount}`];
  }
  if (result.type === 'query') {
    return [`>>> QUERY: ${result.intent}`];
  }
  if (result.type === 'command') {
    return [`>>> COMMAND: ${result.intent}`];
  }
  return ['>>> ...'];
}

// ── Main Component ─────────────────────────────────────────────────

export function VoiceHUD({ state, onCancel, onConfirm, onEdit }: VoiceHUDProps) {
  // Don't render when idle and no content
  if (state.stage === 'idle' && !state.rawTranscript && !state.error) {
    return null;
  }

  // State A: Listening
  if (state.stage === 'listening' || state.isRecording) {
    return (
      <View style={[styles.container, styles.listeningBorder]}>
        <View style={styles.header}>
          <Text style={styles.listeningText}>{`>>> LISTENING...`}</Text>
          <Text style={styles.recBadge}>● REC</Text>
        </View>
        <VuMeter active={true} />
        <Text style={styles.hint}>Speak your expense naturally</Text>
      </View>
    );
  }

  // State B: Parsed & Counting Down
  if (state.stage === 'parsed' && state.parsedResult && state.countdown > 0) {
    const lines = formatParsed(state.parsedResult);
    return (
      <View style={[styles.container, styles.parsedBorder]}>
        {lines.map((line, i) => (
          <Text key={i} style={styles.parsedLine}>{line}</Text>
        ))}
        <View style={styles.countdownSection}>
          <CountdownBar countdown={state.countdown} />
          <Text style={styles.autoText}>AUTO-COMMITTING...</Text>
        </View>
        <View style={styles.actions}>
          <Pressable style={styles.editBtn} onPress={onEdit}>
            <Text style={styles.editBtnText}>[EDIT]</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>[CANCEL]</Text>
          </Pressable>
          <Pressable style={styles.confirmBtn} onPress={onConfirm}>
            <Text style={styles.confirmBtnText}>[OK]</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // State: Committing
  if (state.stage === 'committing') {
    return (
      <View style={[styles.container, styles.parsedBorder]}>
        <Text style={styles.parsedLine}>{`>>> COMMITTING TO LEDGER...`}</Text>
        <Text style={styles.hint}>◉ Writing to SQLite</Text>
      </View>
    );
  }

  // State C: Error
  if (state.stage === 'error' && state.error) {
    return (
      <View style={[styles.container, styles.errorBorder]}>
        <Text style={styles.errorIcon}>[!]</Text>
        <Text style={styles.errorText}>{state.error.toUpperCase()}</Text>
        <Text style={styles.hint}>RETRY OR USE MANUAL ENTRY</Text>
      </View>
    );
  }

  // State: Parsed but countdown finished (showing result briefly)
  if (state.stage === 'parsed' && state.parsedResult && state.countdown <= 0) {
    const lines = formatParsed(state.parsedResult);
    return (
      <View style={[styles.container, styles.parsedBorder]}>
        {lines.map((line, i) => (
          <Text key={i} style={styles.parsedLine}>{line}</Text>
        ))}
        <Text style={styles.hint}>Committed ✓</Text>
      </View>
    );
  }

  return null;
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginTop: 0,
    left: 12,
    right: 12,
    backgroundColor: '#0A0E1A',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1A2340',
  },
  listeningBorder: {
    borderColor: '#FF3333',
  },
  parsedBorder: {
    borderColor: '#00FF66',
  },
  errorBorder: {
    borderColor: '#FF3333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  listeningText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#00FF66',
    fontWeight: '700',
  },
  recBadge: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#FF3333',
    fontWeight: '700',
  },
  vuMeter: {
    fontFamily: 'monospace',
    fontSize: 18,
    color: '#00FF66',
    letterSpacing: 2,
    marginVertical: 4,
  },
  hint: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#5A6B8A',
    marginTop: 6,
  },
  parsedLine: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#00FF66',
    marginBottom: 2,
  },
  countdownSection: {
    marginTop: 8,
  },
  countdownBar: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#FFAA00',
    marginBottom: 4,
  },
  autoText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#FFAA00',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
  },
  editBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  editBtnText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#3366FF',
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cancelBtnText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#FF3333',
    fontWeight: '700',
  },
  confirmBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  confirmBtnText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#00FF66',
    fontWeight: '700',
  },
  errorIcon: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#FF3333',
    fontWeight: '700',
    marginBottom: 4,
  },
  errorText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#FF3333',
    marginBottom: 4,
  },
});
