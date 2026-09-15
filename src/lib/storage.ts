import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AnswerPayload, AppSettings, QuizQuestion } from '../types';
import { defaultServerUrl } from '../constants';

const K = {
  settings: '@fq:settings',
  blocklist: '@fq:blocklist',
  grace: '@fq:grace',
  queue: '@fq:answerQueue',
  spare: '@fq:spareQuestion',
  skipped: '@fq:skippedLog',
  snapshotUsed: '@fq:snapshotUsed',
  snapshotResults: '@fq:snapshotResults',
};

function defaultSettings(): AppSettings {
  return {
    mode: 'hard',
    graceMinutes: 15,
    serverUrl: defaultServerUrl(),
    onboardingDone: false,
  };
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(K.settings);
    if (raw) return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch {
    /* corrupted storage -> defaults */
  }
  return defaultSettings();
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await AsyncStorage.setItem(K.settings, JSON.stringify(s));
}

// --- Blocklist (array of package names) -------------------------------------

export async function getBlocklist(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(K.blocklist);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function setBlocklist(list: string[]): Promise<void> {
  await AsyncStorage.setItem(K.blocklist, JSON.stringify(list));
}

// --- Grace periods (package -> timestamp ms until which no quiz fires) ------

export async function getGraceUntil(pkg: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(K.grace);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    return map[pkg] ?? 0;
  } catch {
    return 0;
  }
}

export async function setGraceUntil(pkg: string, until: number): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(K.grace);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[pkg] = until;
    await AsyncStorage.setItem(K.grace, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

// --- Offline answer queue ----------------------------------------------------

export async function getQueue(): Promise<AnswerPayload[]> {
  try {
    const raw = await AsyncStorage.getItem(K.queue);
    return raw ? (JSON.parse(raw) as AnswerPayload[]) : [];
  } catch {
    return [];
  }
}

export async function setQueue(q: AnswerPayload[]): Promise<void> {
  await AsyncStorage.setItem(K.queue, JSON.stringify(q));
}

export async function enqueueAnswer(a: AnswerPayload): Promise<void> {
  const q = await getQueue();
  q.push(a);
  await setQueue(q);
}

// --- Cached spare question (offline fallback) --------------------------------

export async function getSpareQuestion(): Promise<QuizQuestion | null> {
  try {
    const raw = await AsyncStorage.getItem(K.spare);
    return raw ? (JSON.parse(raw) as QuizQuestion) : null;
  } catch {
    return null;
  }
}

export async function setSpareQuestion(q: QuizQuestion): Promise<void> {
  await AsyncStorage.setItem(K.spare, JSON.stringify(q));
}

export async function clearSpareQuestion(): Promise<void> {
  await AsyncStorage.removeItem(K.spare);
}

// --- Offline snapshot bookkeeping --------------------------------------------
// The bundled assets/quiz-snapshot.json holds pre-claimed bank sets (already
// marked `used` server-side). Served ids are tracked so nothing repeats until
// the snapshot is exhausted; per-question results drive wrong-first re-quiz.

export async function getSnapshotUsed(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(K.snapshotUsed);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function addSnapshotUsed(bankId: string): Promise<void> {
  const used = await getSnapshotUsed();
  if (!used.includes(bankId)) {
    used.push(bankId);
    await AsyncStorage.setItem(K.snapshotUsed, JSON.stringify(used));
  }
}

export async function getSnapshotResults(): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(K.snapshotResults);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export async function recordSnapshotResult(bankId: string, correct: boolean): Promise<void> {
  try {
    const results = await getSnapshotResults();
    results[bankId] = correct;
    await AsyncStorage.setItem(K.snapshotResults, JSON.stringify(results));
  } catch {
    /* ignore */
  }
}

// --- Skipped log (gentle mode; local only, never sent to the tracker) --------

export async function logSkipped(bankId: string, packageName: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(K.skipped);
    const log = raw ? (JSON.parse(raw) as unknown[]) : [];
    log.push({ at: new Date().toISOString(), bank_id: bankId, packageName });
    await AsyncStorage.setItem(K.skipped, JSON.stringify(log.slice(-100)));
  } catch {
    /* ignore */
  }
}
