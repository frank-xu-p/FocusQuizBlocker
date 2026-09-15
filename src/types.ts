export interface QuizOption {
  letter: string;
  text: string;
}

export interface QuizQuestion {
  bank_id: string;
  phase: string;
  subtopic: string;
  question: string;
  options: QuizOption[];
  answer_key: string;
  why_correct: string;
  /** letter -> explanation of why that distractor is wrong */
  why_wrong: Record<string, string>;
  sources: string[];
}

export type BlockMode = 'hard' | 'gentle';

export interface AppSettings {
  mode: BlockMode;
  graceMinutes: number;
  serverUrl: string;
  onboardingDone: boolean;
}

export interface InstalledApp {
  packageName: string;
  appName: string;
  isLauncher: boolean;
}

export interface AnswerPayload {
  bank_id: string;
  chosen_letter: string;
  correct: boolean;
  at: string;
}

export interface OverlayPayload {
  question: QuizQuestion;
  mode: BlockMode;
  packageName: string;
}
