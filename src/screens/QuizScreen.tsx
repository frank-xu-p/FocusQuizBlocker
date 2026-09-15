import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { enqueueAnswer, logSkipped, recordSnapshotResult, setGraceUntil } from '../lib/storage';
import { postAnswer } from '../lib/api';
import type { AnswerPayload, BlockMode, QuizQuestion } from '../types';

interface Props {
  question: QuizQuestion;
  mode: BlockMode;
  packageName: string;
  graceMinutes: number;
  serverUrl: string;
  onDone: () => void;
}

/**
 * The quiz itself. Used inside the overlay root. Answer keys are never shown
 * before she answers (study rule); explanations appear only after a tap.
 */
export default function QuizScreen({
  question,
  mode,
  packageName,
  graceMinutes,
  serverUrl,
  onDone,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const postedRef = useRef(false);

  const correct = selected === question.answer_key;

  const submitAnswer = (letter: string) => {
    if (answered) return;
    setSelected(letter);
    setAnswered(true);
    // Log the FIRST attempt only — that's the honest signal for spaced repetition.
    if (!postedRef.current) {
      postedRef.current = true;
      const isCorrect = letter === question.answer_key;
      const payload: AnswerPayload = {
        bank_id: question.bank_id,
        chosen_letter: letter,
        correct: isCorrect,
        at: new Date().toISOString(),
      };
      postAnswer(serverUrl, payload).catch(() => enqueueAnswer(payload));
      // Feeds the offline snapshot's wrong-first re-quiz ordering.
      recordSnapshotResult(question.bank_id, isCorrect).catch(() => {});
    }
    if (letter === question.answer_key) {
      setGraceUntil(packageName, Date.now() + graceMinutes * 60_000).catch(() => {});
      setTimeout(onDone, 1800);
    }
  };

  const retry = () => {
    setSelected(null);
    setAnswered(false);
  };

  const skip = () => {
    logSkipped(question.bank_id, packageName).catch(() => {});
    onDone();
  };

  const optionStyle = (letter: string) => {
    if (!answered) return styles.option;
    if (letter === question.answer_key) return [styles.option, styles.optionCorrect];
    if (letter === selected) return [styles.option, styles.optionWrong];
    return [styles.option, styles.optionDim];
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>FocusQuiz</Text>
        <Text style={styles.headerSub}>answer to continue</Text>
        {mode === 'gentle' && !answered && (
          <TouchableOpacity style={styles.skip} onPress={skip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyInner}>
        <Text style={styles.tag}>
          {question.phase} · {question.subtopic}
        </Text>
        <Text style={styles.question}>{question.question}</Text>

        {question.options.map((o) => (
          <TouchableOpacity
            key={o.letter}
            style={optionStyle(o.letter)}
            onPress={() => submitAnswer(o.letter)}
            disabled={answered}
            activeOpacity={0.7}
          >
            <Text style={styles.letter}>{o.letter}.</Text>
            <Text style={styles.optionText}>{o.text}</Text>
          </TouchableOpacity>
        ))}

        {answered && (
          <View style={[styles.feedback, correct ? styles.feedbackOk : styles.feedbackBad]}>
            <Text style={styles.feedbackTitle}>
              {correct ? '✓ Correct — nicely done.' : `✗ Not quite — the answer is ${question.answer_key}.`}
            </Text>
            <Text style={styles.feedbackBody}>{question.why_correct}</Text>
            {!correct && question.why_wrong[selected ?? ''] && (
              <Text style={styles.feedbackBody}>
                Why {selected} is wrong: {question.why_wrong[selected ?? '']}
              </Text>
            )}
            {!correct && (
              <TouchableOpacity style={styles.retry} onPress={retry}>
                <Text style={styles.retryText}>Retry this question</Text>
              </TouchableOpacity>
            )}
            {correct && <Text style={styles.graceNote}>App unlocked for {graceMinutes} min.</Text>}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0d1f' },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#232040',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: '#6b6a8f', fontSize: 13, marginLeft: 8, flex: 1 },
  skip: { backgroundColor: '#374151', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  skipText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  body: { flex: 1 },
  bodyInner: { padding: 20, paddingBottom: 40 },
  tag: { color: '#818cf8', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  question: { color: '#fff', fontSize: 17, lineHeight: 24, marginBottom: 18 },
  option: {
    flexDirection: 'row',
    backgroundColor: '#1b1836',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2650',
  },
  optionCorrect: { borderColor: '#16a34a', backgroundColor: '#12351f' },
  optionWrong: { borderColor: '#dc2626', backgroundColor: '#3b1414' },
  optionDim: { opacity: 0.55 },
  letter: { color: '#818cf8', fontSize: 16, fontWeight: '700', marginRight: 10 },
  optionText: { color: '#e8e7f5', fontSize: 15, lineHeight: 21, flex: 1 },
  feedback: { borderRadius: 12, padding: 16, marginTop: 8 },
  feedbackOk: { backgroundColor: '#12351f', borderWidth: 1, borderColor: '#16a34a' },
  feedbackBad: { backgroundColor: '#2a1a1a', borderWidth: 1, borderColor: '#7f1d1d' },
  feedbackTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  feedbackBody: { color: '#d6d4ec', fontSize: 13, lineHeight: 19, marginBottom: 6 },
  retry: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  graceNote: { color: '#86efac', fontSize: 12, marginTop: 8 },
});
