import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { GRACE_PRESETS } from '../constants';
import { getQueue, setQueue } from '../lib/storage';
import { flushQueue } from '../lib/api';
import type { AnswerPayload, AppSettings, BlockMode } from '../types';

interface Props {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
}

export default function SettingsScreen({ settings, onChange }: Props) {
  const [syncStatus, setSyncStatus] = useState('');
  const [syncing, setSyncing] = useState(false);

  const setMode = (mode: BlockMode) => onChange({ mode });

  const syncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncStatus('Syncing…');
    try {
      const { sent, failed } = await flushQueue(settings.serverUrl, getQueue, setQueue);
      if (sent === 0 && failed === 0) {
        setSyncStatus('Nothing queued — all answers are synced ✓');
      } else if (failed === 0) {
        setSyncStatus(`Sent ${sent} queued answer${sent === 1 ? '' : 's'} ✓`);
      } else {
        setSyncStatus(`Sent ${sent}; ${failed} still queued (server unreachable?)`);
      }
    } catch {
      setSyncStatus('Sync failed — check the server URL.');
    }
    setSyncing(false);
  };

  const exportAnswers = async () => {
    const q: AnswerPayload[] = await getQueue();
    if (!q.length) {
      setSyncStatus('No queued answers to export.');
      return;
    }
    const lines = q.map(
      (a) => `- ${a.bank_id}: chose ${a.chosen_letter} (${a.correct ? 'correct' : 'wrong'}) at ${a.at}`,
    );
    await Clipboard.setStringAsync(`FocusQuiz queued answers\n${lines.join('\n')}`);
    setSyncStatus(
      `Copied ${q.length} answer${q.length === 1 ? '' : 's'} — paste to Spark in chat to log them.`,
    );
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.label}>Block mode</Text>
      <View style={styles.segment}>
        {(['hard', 'gentle'] as BlockMode[]).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.segBtn, settings.mode === m && styles.segBtnActive]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.segText, settings.mode === m && styles.segTextActive]}>
              {m === 'hard' ? 'Hard block' : 'Gentle'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.hint}>
        {settings.mode === 'hard'
          ? 'You must answer correctly to continue. No skip, no back button.'
          : 'A Skip button appears — skips are logged on-device only, not in your study tracker.'}
      </Text>

      <Text style={styles.label}>Grace period after a correct answer</Text>
      <View style={styles.presets}>
        {GRACE_PRESETS.map((min) => (
          <TouchableOpacity
            key={min}
            style={[styles.preset, settings.graceMinutes === min && styles.presetActive]}
            onPress={() => onChange({ graceMinutes: min })}
          >
            <Text style={[styles.presetText, settings.graceMinutes === min && styles.segTextActive]}>
              {min}m
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Quiz server URL</Text>
      <TextInput
        style={styles.input}
        value={settings.serverUrl}
        onChangeText={(t) => onChange({ serverUrl: t.trim() })}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="https://…"
        placeholderTextColor="#6b6a8f"
      />
      <Text style={styles.hint}>
        Questions come from your study question bank via this server. Answers sync back
        automatically when online.
      </Text>

      <TouchableOpacity style={styles.syncBtn} onPress={syncNow} disabled={syncing}>
        <Text style={styles.syncBtnText}>{syncing ? 'Syncing…' : 'Sync now'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.exportBtn} onPress={exportAnswers}>
        <Text style={styles.exportBtnText}>Export queued answers</Text>
      </TouchableOpacity>
      {syncStatus !== '' && <Text style={styles.syncStatus}>{syncStatus}</Text>}

      <Text style={styles.version}>FocusQuiz 1.0.0 · answers feed your Adobe cert study tracker</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0d1f', padding: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  label: { color: '#c7c5e8', fontSize: 14, fontWeight: '600', marginTop: 14, marginBottom: 8 },
  hint: { color: '#6b6a8f', fontSize: 12, lineHeight: 17, marginTop: 6 },
  segment: { flexDirection: 'row', backgroundColor: '#1b1836', borderRadius: 12, padding: 4 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segBtnActive: { backgroundColor: '#4f46e5' },
  segText: { color: '#a5a3c7', fontSize: 15, fontWeight: '600' },
  segTextActive: { color: '#fff' },
  presets: { flexDirection: 'row', gap: 8 },
  preset: {
    backgroundColor: '#1b1836',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  presetActive: { backgroundColor: '#4f46e5' },
  presetText: { color: '#a5a3c7', fontSize: 15, fontWeight: '600' },
  input: {
    backgroundColor: '#1b1836',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },
  syncBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 18,
  },
  syncBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  exportBtn: {
    backgroundColor: '#1b1836',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#2a2650',
  },
  exportBtnText: { color: '#c7c5e8', fontSize: 15, fontWeight: '600' },
  syncStatus: { color: '#a5a3c7', fontSize: 13, marginTop: 8, textAlign: 'center' },
  version: { color: '#4a4969', fontSize: 11, textAlign: 'center', marginTop: 28 },
});
