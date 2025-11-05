import React, { useState, useEffect } from 'react';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState<string | undefined>('');
  const [enrollmentKeyId, setEnrollmentKeyId] = useState<string | null>(null);
  const [shouldAutoTrigger, setShouldAutoTrigger] = useState(true);

  // Handle deep links for enrollment callback
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      console.log('[APP]: Deep link received:', event.url);
      
      // Check if it's an enrollment success callback
      if (event.url.startsWith('nairabankapp://enrollment-success')) {
        // Parse query parameters manually (React Native doesn't have URLSearchParams)
        const queryString = event.url.split('?')[1];
        const params: Record<string, string> = {};
        
        if (queryString) {
          queryString.split('&').forEach(param => {
            const [key, value] = param.split('=');
            if (key && value) {
              params[key] = decodeURIComponent(value);
            }
          });
        }
        
        const keyId = params.keyId;
        const error = params.error;
        
        if (error) {
          console.error('[APP]: Enrollment failed:', error);
          // TODO: Show error to user
          return;
        }
        
        if (keyId) {
          console.log('[APP]: Enrollment successful, saving keyId:', keyId);
          
          // Store keyId in AsyncStorage
          try {
            await AsyncStorage.setItem('passkeyKeyId', keyId);
            console.log('[APP]: keyId saved to AsyncStorage');
            
            // Update state to trigger re-render of LoginScreen and enable auto-trigger
            setEnrollmentKeyId(keyId);
            setShouldAutoTrigger(true);
          } catch (error) {
            console.error('[APP]: Failed to save keyId to AsyncStorage:', error);
          }
        }
      }
    };

    // Listen for deep links when app is already open
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened from a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleLogin = (user?: string) => {
    setIsLoggedIn(true);
    setUsername(user || 'Demo User');
    // Disable auto-trigger after successful login
    setShouldAutoTrigger(false);
  };

  const handleLogout = async () => {
    setIsLoggedIn(false);
    setUsername(undefined);
    // Mark logout time to prevent immediate auto-trigger on LoginScreen remount
    try {
      await AsyncStorage.setItem('lastLogoutTime', Date.now().toString());
    } catch (error) {
      console.error('[APP]: Failed to save logout time:', error);
    }
    // Re-enable auto-trigger so user can authenticate when they return from background
    setShouldAutoTrigger(true);
  };

  if (isLoggedIn) {
    return (
      <DashboardScreen
        username={username}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <LoginScreen 
      onLogin={handleLogin} 
      enrollmentKeyId={enrollmentKeyId}
      shouldAutoTrigger={shouldAutoTrigger}
    />
  );
};

export default App;
