import type { InstalledApp } from '../types';

interface ForegroundWatcherNative {
  isUsageAccessGranted(): boolean;
  openUsageAccessSettings(): void;
  getInstalledApps(): InstalledApp[];
  startWatching(): Promise<void>;
  stopWatching(): void;
}

declare const mod: ForegroundWatcherNative;
export default mod;
