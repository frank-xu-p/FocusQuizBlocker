import { registerRootComponent } from 'expo';
import { AppRegistry } from 'react-native';
import App from './src/App';
import QuizOverlayRoot from './src/overlay/QuizOverlayRoot';

// Main app entry (dev-client / launcher).
registerRootComponent(App);

// Second root, rendered by the native QuizOverlay module inside a
// SYSTEM_ALERT_WINDOW overlay when a blocked app is opened.
AppRegistry.registerComponent('FocusQuizOverlay', () => QuizOverlayRoot);
