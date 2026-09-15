import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { loadSettings, saveSettings } from './lib/storage';
import type { AppSettings } from './types';
import { useForegroundWatcher } from './hooks/useForegroundWatcher';
import OnboardingScreen from './screens/OnboardingScreen';
import BlocklistScreen from './screens/BlocklistScreen';
import SettingsScreen from './screens/SettingsScreen';

type Tab = 'blocklist' | 'settings';

export default function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [tab, setTab] = useState<Tab>('blocklist');

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  useForegroundWatcher(!!settings?.onboardingDone);

  const update = async (patch: Partial<AppSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveSettings(next);
  };

  if (!settings) {
    return <View style={styles.splash} />;
  }

  if (!settings.onboardingDone) {
    return <OnboardingScreen onDone={() => update({ onboardingDone: true })} />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.body}>
        {tab === 'blocklist' ? (
          <BlocklistScreen />
        ) : (
          <SettingsScreen settings={settings} onChange={update} />
        )}
      </View>
      <View style={styles.nav}>
        {(
          [
            { id: 'blocklist', label: 'Blocked apps' },
            { id: 'settings', label: 'Settings' },
          ] as { id: Tab; label: string }[]
        ).map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.navBtn, tab === t.id && styles.navBtnActive]}
            onPress={() => setTab(t.id)}
          >
            <Text style={[styles.navText, tab === t.id && styles.navTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#0f0d1f' },
  root: { flex: 1, backgroundColor: '#0f0d1f', paddingTop: 40 },
  body: { flex: 1 },
  nav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#232040',
    paddingVertical: 6,
    paddingHorizontal: 12,
    paddingBottom: 18,
  },
  navBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  navBtnActive: { backgroundColor: '#1b1836' },
  navText: { color: '#6b6a8f', fontSize: 14, fontWeight: '600' },
  navTextActive: { color: '#fff' },
});
