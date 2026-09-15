// JS wrapper for the native ForegroundWatcher expo module.
// The real typing lives in the app's src/types/native-modules.d.ts.
import { requireNativeModule } from 'expo-modules-core';

export default requireNativeModule('ForegroundWatcher');
