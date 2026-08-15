/**
 * @format
 */

// Must be the first import — required by react-native-gesture-handler
// (used internally by React Navigation's native-stack).
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
