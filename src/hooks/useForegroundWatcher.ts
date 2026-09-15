import { useEffect, useRef } from 'react';
import type { EventSubscription } from 'expo-modules-core';
import ForegroundWatcher from 'foreground-watcher';
import QuizOverlay from 'quiz-overlay';
import {
  clearSpareQuestion,
  getBlocklist,
  getGraceUntil,
  getSpareQuestion,
  loadSettings,
  setSpareQuestion,
} from '../lib/storage';
import { getQuestionForBlock } from '../lib/api';

interface WatcherEmitter {
  addListener(
    event: 'ForegroundAppChanged',
    listener: (e: { packageName: string }) => void,
  ): EventSubscription;
}

// Since Expo SDK 52 the native module proxy is already an event emitter.
const watcherEmitter = ForegroundWatcher as unknown as WatcherEmitter;

/**
 * Watches foreground-app changes and fires the quiz overlay when a blocklisted
 * app comes to the foreground and its grace period has expired.
 */
export function useForegroundWatcher(active: boolean): void {
  const busyRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    let sub: EventSubscription | null = null;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const onForegroundApp = async ({ packageName }: { packageName: string }) => {
      if (busyRef.current || cancelled) return;
      try {
        const [blocklist, settings] = await Promise.all([getBlocklist(), loadSettings()]);
        if (!blocklist.includes(packageName)) return;
        if (Date.now() < (await getGraceUntil(packageName))) return;

        busyRef.current = true;
        const question = await getQuestionForBlock(settings.serverUrl, {
          getSpare: getSpareQuestion,
          setSpare: setSpareQuestion,
          clearSpare: clearSpareQuestion,
        });
        if (cancelled || !question) {
          busyRef.current = false;
          return;
        }
        QuizOverlay.showQuiz(
          JSON.stringify({ question, mode: settings.mode, packageName }),
        );
        // Release the gate once the overlay is dismissed.
        pollTimer = setInterval(() => {
          try {
            if (!QuizOverlay.isShowing()) {
              if (pollTimer) clearInterval(pollTimer);
              pollTimer = null;
              busyRef.current = false;
            }
          } catch {
            /* native not linked */
          }
        }, 500);
      } catch {
        busyRef.current = false;
      }
    };

    (async () => {
      try {
        if (!ForegroundWatcher.isUsageAccessGranted()) return;
        sub = watcherEmitter.addListener('ForegroundAppChanged', onForegroundApp);
        await ForegroundWatcher.startWatching();
      } catch {
        /* native modules not linked (e.g. running under Expo Go) */
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
      if (pollTimer) clearInterval(pollTimer);
      try {
        ForegroundWatcher.stopWatching();
      } catch {
        /* ignore */
      }
      busyRef.current = false;
    };
  }, [active]);
}
