import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import QuizOverlay from 'quiz-overlay';
import QuizScreen from '../screens/QuizScreen';
import { loadSettings } from '../lib/storage';
import type { OverlayPayload } from '../types';

/**
 * Second React root, mounted by the native QuizOverlay module inside a
 * SYSTEM_ALERT_WINDOW overlay. Reads the question payload the native side
 * stashed via showQuiz(), renders the quiz, hides itself when done.
 */
export default function QuizOverlayRoot() {
  const [payload, setPayload] = useState<OverlayPayload | null>(null);
  const [graceMinutes, setGraceMinutes] = useState(15);
  const [serverUrl, setServerUrl] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const settings = await loadSettings();
        setGraceMinutes(settings.graceMinutes);
        setServerUrl(settings.serverUrl);
        const raw = QuizOverlay.getPendingQuestion();
        if (raw) setPayload(JSON.parse(raw) as OverlayPayload);
      } catch {
        /* malformed payload -> stay on spinner; native will time nothing out */
      }
    })();
  }, []);

  const done = () => {
    try {
      QuizOverlay.hideQuiz();
    } catch {
      /* ignore */
    }
  };

  if (!payload) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#818cf8" />
      </View>
    );
  }

  return (
    <QuizScreen
      question={payload.question}
      mode={payload.mode}
      packageName={payload.packageName}
      graceMinutes={graceMinutes}
      serverUrl={serverUrl}
      onDone={done}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#0f0d1f', alignItems: 'center', justifyContent: 'center' },
});
