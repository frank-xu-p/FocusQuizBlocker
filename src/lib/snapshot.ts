import snapshotData from '../../assets/quiz-snapshot.json';
import type { QuizQuestion } from '../types';
import { addSnapshotUsed, getSnapshotResults, getSnapshotUsed } from './storage';

const SNAPSHOT = snapshotData as unknown as QuizQuestion[];

/**
 * Offline question source. The snapshot holds bank sets pre-claimed for this
 * app (already marked `used` server-side, so the scheduled chat quizzes never
 * repeat them). Serves each once, then re-quizzes wrong answers first
 * (spaced repetition), then cycles the whole snapshot — never a dead end.
 */
export async function getSnapshotQuestion(): Promise<QuizQuestion | null> {
  if (!SNAPSHOT.length) return null;
  const [used, results] = await Promise.all([getSnapshotUsed(), getSnapshotResults()]);
  const fresh = SNAPSHOT.find((q) => !used.includes(q.bank_id));
  if (fresh) {
    await addSnapshotUsed(fresh.bank_id);
    return fresh;
  }
  const wrong = SNAPSHOT.find((q) => results[q.bank_id] === false);
  return wrong ?? SNAPSHOT[0];
}

/** How many snapshot questions are still unserved. */
export async function snapshotRemaining(): Promise<number> {
  const used = await getSnapshotUsed();
  return SNAPSHOT.filter((q) => !used.includes(q.bank_id)).length;
}
