import type { AnswerPayload, QuizQuestion } from '../types';
import { getSnapshotQuestion } from './snapshot';

function base(serverUrl: string): string {
  return serverUrl.replace(/\/$/, '');
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 8000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchNextQuestion(serverUrl: string): Promise<QuizQuestion> {
  const data = await fetchJson(`${base(serverUrl)}/api/quiz/next`);
  if (!data || !data.bank_id || !Array.isArray(data.options)) {
    throw new Error('bad question payload');
  }
  return data as QuizQuestion;
}

export async function postAnswer(serverUrl: string, a: AnswerPayload): Promise<void> {
  await fetchJson(`${base(serverUrl)}/api/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(a),
  });
}

export interface SpareStore {
  getSpare: () => Promise<QuizQuestion | null>;
  setSpare: (q: QuizQuestion) => Promise<void>;
  clearSpare: () => Promise<void>;
}

/**
 * Question to show when a blocked app opens.
 *
 * Primary: live fetch from the quiz server (each fetch marks a bank set used
 * server-side, so scheduled chat quizzes never repeat it; a spare is cached
 * while online for the next offline moment).
 * Fallback: the bundled offline snapshot (pre-claimed bank sets).
 * When no server URL is configured, the spare/snapshot path is used directly.
 */
export async function getQuestionForBlock(
  serverUrl: string,
  spare: SpareStore,
): Promise<QuizQuestion | null> {
  if (serverUrl) {
    try {
      const q = await fetchNextQuestion(serverUrl);
      try {
        if (!(await spare.getSpare())) {
          const s = await fetchNextQuestion(serverUrl);
          await spare.setSpare(s);
        }
      } catch {
        /* spare top-up is best-effort */
      }
      return q;
    } catch {
      /* server unreachable -> fall through to offline sources */
    }
    try {
      const s = await spare.getSpare();
      if (s) {
        await spare.clearSpare(); // one-time use; replenished on next online fetch
        return s;
      }
    } catch {
      /* ignore */
    }
  }
  return getSnapshotQuestion();
}

/** POST every queued answer; returns counts and leaves failures queued. */
export async function flushQueue(
  serverUrl: string,
  getQ: () => Promise<AnswerPayload[]>,
  setQ: (q: AnswerPayload[]) => Promise<void>,
): Promise<{ sent: number; failed: number }> {
  const q = await getQ();
  let sent = 0;
  const failed: AnswerPayload[] = [];
  for (const a of q) {
    try {
      await postAnswer(serverUrl, a);
      sent++;
    } catch {
      failed.push(a);
    }
  }
  await setQ(failed);
  return { sent, failed: failed.length };
}
