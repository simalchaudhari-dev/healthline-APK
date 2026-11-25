import 'react-native-gesture-handler';
import './src/utils/webWarnings';

import { registerRootComponent } from 'expo';
import * as ScreenOrientation from 'expo-screen-orientation';

import App from './App';

ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});

registerRootComponent(App);
