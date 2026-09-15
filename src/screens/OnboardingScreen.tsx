import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ForegroundWatcher from 'foreground-watcher';
import QuizOverlay from 'quiz-overlay';

interface Props {
  onDone: () => void;
}

export default function OnboardingScreen({ onDone }: Props) {
  const [usageGranted, setUsageGranted] = useState(false);
  const [overlayGranted, setOverlayGranted] = useState(false);

  const check = useCallback(() => {
    try {
      setUsageGranted(ForegroundWatcher.isUsageAccessGranted());
    } catch {
      setUsageGranted(false);
    }
    try {
      setOverlayGranted(QuizOverlay.hasOverlayPermission());
    } catch {
      setOverlayGranted(false);
    }
  }, []);

  useEffect(() => {
    check();
    const t = setInterval(check, 1500); // re-check while she's in Settings
    return () => clearInterval(t);
  }, [check]);

  const openUsage = () => {
    try {
      ForegroundWatcher.openUsageAccessSettings();
    } catch {
      /* ignore */
    }
  };
  const openOverlay = () => {
    try {
      QuizOverlay.openOverlaySettings();
    } catch {
      /* ignore */
    }
  };

  const ready = usageGranted && overlayGranted;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>FocusQuiz needs two permissions</Text>
      <Text style={styles.sub}>
        Both are granted manually in Android Settings. This screen checks them live —
        grant them, come back, and continue.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {usageGranted ? '✓' : '○'} Usage access
        </Text>
        <Text style={styles.cardBody}>
          Lets FocusQuiz see which app is in the foreground, so it knows when you
          open a distracting app.
        </Text>
        {!usageGranted && (
          <TouchableOpacity style={styles.btn} onPress={openUsage}>
            <Text style={styles.btnText}>Open usage-access settings</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {overlayGranted ? '✓' : '○'} Display over other apps
        </Text>
        <Text style={styles.cardBody}>
          Lets FocusQuiz show the quiz full-screen on top of the distracting app.
        </Text>
        {!overlayGranted && (
          <TouchableOpacity style={styles.btn} onPress={openOverlay}>
            <Text style={styles.btnText}>Open overlay settings</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[styles.continue, !ready && styles.continueDisabled]}
        onPress={onDone}
        disabled={!ready}
      >
        <Text style={styles.btnText}>{ready ? 'Continue' : 'Grant both to continue'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0d1f', padding: 24, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  sub: { color: '#a5a3c7', fontSize: 14, lineHeight: 20, marginBottom: 24 },
  card: {
    backgroundColor: '#1b1836',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
  },
  cardTitle: { color: '#fff', fontSize: 17, fontWeight: '600', marginBottom: 6 },
  cardBody: { color: '#a5a3c7', fontSize: 13, lineHeight: 19, marginBottom: 12 },
  btn: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  continue: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  continueDisabled: { backgroundColor: '#374151' },
});
