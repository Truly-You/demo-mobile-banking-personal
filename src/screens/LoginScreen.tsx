import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  AppState,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';
import { TrulyYouReactNativeSDK } from '@truly-you/react-native-sdk';

interface LoginScreenProps {
  onLogin: (username?: string) => void;
  sdk: TrulyYouReactNativeSDK | null;
  shouldAutoTrigger: boolean;
  isMrzCameraRef?: React.MutableRefObject<boolean>;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, sdk, shouldAutoTrigger, isMrzCameraRef }) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [hasUserDismissed, setHasUserDismissed] = useState(false);
  const hasUserDismissedRef = useRef(false); // Ref for synchronous checks without re-renders
  const appState = useRef(AppState.currentState);
  const [isEnrolled, setIsEnrolled] = useState(false);

  // Check SDK and enrollment status on mount
  useEffect(() => {
    const checkEnrollment = async () => {
      console.log('[LoginScreen]: SDK prop:', sdk ? 'initialized' : 'null');
      if (sdk) {
        const enrolled = await sdk.isEnrolled();
        setIsEnrolled(enrolled);
        console.log('[LoginScreen]: Is enrolled:', enrolled);
        
        // Check if recent logout (within 3 seconds)
        const lastLogoutTimeStr = await AsyncStorage.getItem('lastLogoutTime');
        const lastLogoutTime = lastLogoutTimeStr ? parseInt(lastLogoutTimeStr, 10) : 0;
        const timeSinceLogout = Date.now() - lastLogoutTime;
        const isRecentLogout = timeSinceLogout < 3000; // 3 seconds
        
        if (isRecentLogout) {
          console.log('[LoginScreen]: Recent logout detected, skipping auto-trigger');
          return;
        }
        
        // Auto-trigger if conditions are met (performAuthentication handles enrollment)
        if (shouldAutoTrigger && !hasUserDismissed) {
          console.log('[LoginScreen]: Auto-triggering authentication on mount (enrolled:', enrolled, ')');
          performAuthentication();
        }
      }
    };

    checkEnrollment();
  }, [sdk]);

  // Listen for app state changes (background -> foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      // Detect when app comes back to foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[LoginScreen]: App came to foreground');
        
        // Skip auto-login if MRZ camera is active
        if (isMrzCameraRef?.current) {
          console.log('[LoginScreen]: MRZ camera is active - skipping auto-trigger');
          appState.current = nextAppState;
          return;
        }
        
        // Check if recent logout (within 3 seconds)
        const lastLogoutTimeStr = await AsyncStorage.getItem('lastLogoutTime');
        const lastLogoutTime = lastLogoutTimeStr ? parseInt(lastLogoutTimeStr, 10) : 0;
        const timeSinceLogout = Date.now() - lastLogoutTime;
        const isRecentLogout = timeSinceLogout < 3000; // 3 seconds
        
        if (isRecentLogout) {
          console.log('[LoginScreen]: Recent logout detected, skipping auto-trigger on foreground');
          appState.current = nextAppState;
          return;
        }
        
        // Check ref for dismissal state (synchronous, no timing issues)
        const isDismissed = hasUserDismissedRef.current;
        
        // Auto-trigger if should auto-trigger AND user hasn't dismissed/errored
        // (Don't check isEnrolled - performAuthentication handles both enrollment and auth)
        if (shouldAutoTrigger && !isDismissed) {
          console.log('[LoginScreen]: Auto-triggering authentication after coming to foreground (enrolled:', isEnrolled, ')');
          performAuthentication();
        } else if (isDismissed) {
          console.log('[LoginScreen]: Skipping auto-trigger - user previously dismissed or error occurred (ref:', hasUserDismissedRef.current, ')');
        }
      }
      
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [shouldAutoTrigger, sdk]); // hasUserDismissedRef doesn't need to be in deps (it's a ref)

  const performAuthentication = async () => {
    if (!sdk) {
      console.error('[LoginScreen]: SDK not initialized');
      Alert.alert('Error', 'SDK not initialized. Please restart the app.');
      return;
    }

    console.log('[LoginScreen]: Starting authentication...');
    
    // Set dismissal flag IMMEDIATELY when starting auth (before passkey modal)
    // This prevents double-trigger when passkey modal closes
    setHasUserDismissed(true);
    hasUserDismissedRef.current = true;
    
    setIsAuthenticating(true);

    try {
      const backendApiUrl = Config.NAIRA_BANK_BACKEND_URL;
      
      if (!backendApiUrl) {
        throw new Error('NAIRA_BANK_BACKEND_URL is not set in environment configuration');
      }
      
      console.log('[LoginScreen]: Calling fetchWithSignature for backend:', backendApiUrl);
      const loginUrl = `${backendApiUrl}/api/auth/login`;

      // SDK handles everything - enrollment, signing, etc.
      const result = await sdk.fetchWithSignature(loginUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!result || !result.response) {
        console.log('[LoginScreen]: Signature request failed');
        setIsAuthenticating(false);
        return;
      }

      if (result.response.ok) {
        const loginData = await result.response.json();
        console.log('[LoginScreen]: Authentication successful:', loginData);
        
        // Update enrollment status
        const enrolled = await sdk.isEnrolled();
        setIsEnrolled(enrolled);
        
        onLogin(loginData.user?.username || 'Demo User');
      } else {
        const errorData = await result.response.json();
        console.error('[LoginScreen]: Authentication failed:', errorData);
        Alert.alert('Authentication Failed', errorData.message || 'Unknown error');
        setIsAuthenticating(false);
      }
    } catch (error: any) {
      // Dismissal flag already set at start of performAuthentication
      
      // Check if user cancelled or timeout - silently fail without alerts
      const errorMessage = (error.message || '').toLowerCase();
      const errorCode = error.code || '';
      const errorString = JSON.stringify(error).toLowerCase();
      
      const isCancellation = errorMessage.includes('cancelled by user') || 
                            errorMessage.includes('cancelled') ||
                            errorMessage.includes('canceled') ||
                            errorMessage.includes('cancel') ||
                            errorMessage.includes('operation couldn') ||
                            errorCode === 1001 ||
                            errorCode === '1001' ||
                            errorString.includes('cancel');
      
      const isTimeout = errorMessage.includes('timeout') ||
                       errorMessage.includes('timed out') ||
                       errorString.includes('timeout');
      
      if (isCancellation) {
        console.log('[LoginScreen]: User cancelled authentication');
      } else if (isTimeout) {
        console.log('[LoginScreen]: Authentication timed out - silently resetting');
      } else {
        console.error('[LoginScreen]: Authentication error:', error);
        Alert.alert('Authentication Error', error.message || 'An unknown error occurred');
      }
      
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    if (!sdk) {
      console.error('[LoginScreen]: SDK not initialized');
      return;
    }

    try {
      // DON'T clear the key - it persists always
      // Just reset dismissal state so auto-trigger works on next app open
      setHasUserDismissed(false);
      hasUserDismissedRef.current = false;
      
      // Store logout time to prevent immediate auto-trigger when navigating back
      await AsyncStorage.setItem('lastLogoutTime', Date.now().toString());
      
      console.log('[LoginScreen]: Logged out (key persists)');
      Alert.alert('Success', 'You have been logged out.');
    } catch (error) {
      console.error('[LoginScreen]: Failed to logout:', error);
      Alert.alert('Error', 'Failed to logout');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={async () => {
            if (isEnrolled) {
              Alert.alert(
                'Clear Secure Key',
                'Are you sure you want to clear your secure key? You will need to re-enroll.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear', style: 'destructive', onPress: handleLogout }
                ]
              );
            }
          }}
          activeOpacity={0.8}
        >
          <Image
            source={require('../assets/nairabank.jpeg')}
            style={styles.logo}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <Text style={styles.subtitle}>Personal Banking</Text>
      </View>

      <View style={styles.card}>
        {isAuthenticating ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#81e62e" />
            <Text style={styles.loadingText}>Authenticating with biometrics...</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.authenticateButton, !sdk && styles.disabledButton]}
              onPress={() => {
                console.log('[LoginScreen]: Authenticate button pressed, SDK:', sdk ? 'initialized' : 'null');
                performAuthentication();
              }}
              disabled={!sdk}
            >
              <Text style={styles.authenticateButtonText}>
                Authenticate
              </Text>
            </TouchableOpacity>

            <Text style={styles.infoText}>
              {!sdk 
                ? 'Initializing...'
                : isEnrolled 
                  ? 'Tap to authenticate using your device biometrics'
                  : 'Tap to set up secure biometric authentication'
              }
            </Text>
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F3F4F6',
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 24,
  },
  header: {
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 40 : 20,
    marginBottom: 40,
  },
  logo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '500',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  authenticateButton: {
    backgroundColor: '#81e62e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  authenticateButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#EF4444',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default LoginScreen;
