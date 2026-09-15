interface QuizOverlayNative {
  getPendingQuestion(): string | null;
  hasOverlayPermission(): boolean;
  openOverlaySettings(): void;
  isShowing(): boolean;
  showQuiz(payload: string): void;
  hideQuiz(): void;
}

declare const mod: QuizOverlayNative;
export default mod;
