import React, { useState, useEffect, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';
import { TrulyYouReactNativeSDK } from '@truly-you/react-native-sdk';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState<string | undefined>('');
  const [shouldAutoTrigger, setShouldAutoTrigger] = useState(true);
  const [sdk, setSdk] = useState<TrulyYouReactNativeSDK | null>(null);
  const appState = useRef(AppState.currentState);
  const isNfcReadingRef = useRef(false); // Track NFC reading state to prevent auto-logout
  const isMrzCameraRef = useRef(false); // Track MRZ camera state to prevent auto-logout/login
  
  useEffect(() => {
    const apiUrl = Config.TRULYYOU_API_URL;
    const authAppId = Config.TRULYYOU_AUTH_APP_ID;
    
    if (!apiUrl || !authAppId) {
      console.error('[APP]: Missing required environment variables');
      console.error('[APP]: apiUrl:', apiUrl);
      console.error('[APP]: authAppId:', authAppId);
      return;
    }
    
    // Determine bundleId or packageName based on platform
    const sdkConfig: any = {
      apiUrl,
      authAppId,
    };
    
    if (Platform.OS === 'ios') {
      sdkConfig.bundleId = 'com.nairabankmobile.company';
    } else if (Platform.OS === 'android') {
      sdkConfig.packageName = 'com.nairabankmobile';
    }
    
    console.log('[APP]: Initializing SDK with:', sdkConfig);
    const sdkInstance = new TrulyYouReactNativeSDK(sdkConfig);
    setSdk(sdkInstance);
    console.log('[APP]: SDK initialized and set');

    return () => {
      // Clean up SDK on unmount
      if (sdkInstance) {
        sdkInstance.destroy();
      }
    };
  }, []);

  const handleLogin = (user?: string) => {
    setIsLoggedIn(true);
    setUsername(user || 'Demo User');
    // Disable auto-trigger after successful login
    setShouldAutoTrigger(false);
  };

  const handleLogout = async (isManual: boolean = true) => {
    setIsLoggedIn(false);
    setUsername(undefined);
    // Only set logout time for MANUAL logout to prevent immediate auto-trigger
    // Auto-logout (bg) should NOT set this, so user can auto-login on fg
    if (isManual) {
      try {
        await AsyncStorage.setItem('lastLogoutTime', Date.now().toString());
        console.log('[APP]: Manual logout timestamp saved:', Date.now());
      } catch (error) {
        console.error('[APP]: Failed to save logout time:', error);
      }
    } else {
      console.log('[APP]: Auto-logout (no timestamp) - will allow auto-trigger on foreground');
    }
    // Keep auto-trigger enabled for future background-to-foreground transitions
    // LoginScreen will check lastLogoutTime to prevent immediate re-trigger
    setShouldAutoTrigger(true);
  };

  // Disable auto-logout on Android to avoid NFC/session interruptions taking app to background
  // Also skip auto-logout if NFC reading is in progress
  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        if (isLoggedIn) {
          // Skip auto-logout if NFC reading or MRZ camera is in progress
          if (isNfcReadingRef.current || isMrzCameraRef.current) {
            console.log('[APP]: App going to background but NFC/MRZ camera in progress - skipping auto-logout');
            appState.current = nextAppState;
            return;
          }
          console.log('[APP]: App going to background while logged in - auto logout (iOS only)');
          await handleLogout(false);
        }
      }
      appState.current = nextAppState;
    });
    return () => {
      subscription.remove();
    };
  }, [isLoggedIn]);

  if (isLoggedIn) {
    return (
      <DashboardScreen
        username={username}
        onLogout={handleLogout}
        isNfcReadingRef={isNfcReadingRef}
        isMrzCameraRef={isMrzCameraRef}
      />
    );
  }

  return (
    <LoginScreen 
      onLogin={handleLogin} 
      sdk={sdk}
      shouldAutoTrigger={shouldAutoTrigger}
      isMrzCameraRef={isMrzCameraRef}
    />
  );
};

export default App;
