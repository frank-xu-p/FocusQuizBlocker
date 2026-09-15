import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import ForegroundWatcher from 'foreground-watcher';
import { ALWAYS_WHITELIST, SUGGESTED_APPS } from '../constants';
import { getBlocklist, setBlocklist } from '../lib/storage';
import type { InstalledApp } from '../types';

function Row({
  name,
  pkg,
  blocked,
  onToggle,
}: {
  name: string;
  pkg: string;
  blocked: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.appName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.pkg} numberOfLines={1}>
          {pkg}
        </Text>
      </View>
      <Switch value={blocked} onValueChange={onToggle} />
    </View>
  );
}

export default function BlocklistScreen() {
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [list, bl] = await Promise.all([
          ForegroundWatcher.getInstalledApps(),
          getBlocklist(),
        ]);
        setApps(
          list.filter((a) => !ALWAYS_WHITELIST.has(a.packageName) && !a.isLauncher),
        );
        setBlocked(new Set(bl));
      } catch {
        /* native not linked */
      }
    })();
  }, []);

  const toggle = async (pkg: string) => {
    const next = new Set(blocked);
    if (next.has(pkg)) next.delete(pkg);
    else next.add(pkg);
    setBlocked(next);
    await setBlocklist([...next]);
  };

  const installedByPkg = useMemo(() => new Map(apps.map((a) => [a.packageName, a])), [apps]);

  const suggested = useMemo(
    () =>
      SUGGESTED_APPS.filter((s) => installedByPkg.has(s.packageName)).map((s) => ({
        ...s,
        appName: installedByPkg.get(s.packageName)!.appName,
      })),
    [installedByPkg],
  );
  const suggestedPkgs = useMemo(() => new Set(suggested.map((s) => s.packageName)), [suggested]);

  const rest = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps.filter(
      (a) =>
        !suggestedPkgs.has(a.packageName) &&
        (!q || a.appName.toLowerCase().includes(q) || a.packageName.toLowerCase().includes(q)),
    );
  }, [apps, suggestedPkgs, query]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Blocked apps</Text>
      <Text style={styles.sub}>
        Opening one of these triggers a quiz. Phone, messages and contacts can never
        be blocked. {blocked.size} blocked.
      </Text>

      {suggested.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suggested distractors</Text>
          {suggested.map((s) => (
            <Row
              key={s.packageName}
              name={s.appName}
              pkg={s.packageName}
              blocked={blocked.has(s.packageName)}
              onToggle={() => toggle(s.packageName)}
            />
          ))}
        </View>
      )}

      <TextInput
        style={styles.search}
        placeholder="Search apps…"
        placeholderTextColor="#6b6a8f"
        value={query}
        onChangeText={setQuery}
      />
      <FlatList
        data={rest}
        keyExtractor={(a) => a.packageName}
        renderItem={({ item }) => (
          <Row
            name={item.appName}
            pkg={item.packageName}
            blocked={blocked.has(item.packageName)}
            onToggle={() => toggle(item.packageName)}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No apps found. (Native app list unavailable?)</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0d1f', padding: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  sub: { color: '#a5a3c7', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  section: { marginBottom: 8 },
  sectionTitle: { color: '#c7c5e8', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  search: {
    backgroundColor: '#1b1836',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b1836',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  rowText: { flex: 1, marginRight: 8 },
  appName: { color: '#fff', fontSize: 15, fontWeight: '500' },
  pkg: { color: '#6b6a8f', fontSize: 11 },
  empty: { color: '#6b6a8f', textAlign: 'center', marginTop: 24 },
});
