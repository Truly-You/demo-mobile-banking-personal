import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  AppState,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';
import { TrulyYouReactNativeSDK } from '../sdk/TrulyYouReactNativeSDK';
import { configService } from '../services/ConfigService';

interface LoginScreenProps {
  onLogin: (username?: string) => void;
  enrollmentKeyId: string | null; // Passed from App when enrollment completes
  shouldAutoTrigger: boolean; // Whether to auto-trigger authentication on mount
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, enrollmentKeyId, shouldAutoTrigger }) => {
  const [loginMode, setLoginMode] = useState<'authenticate' | 'legacy'>('authenticate');
  const [showPin, setShowPin] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [accountNumber, setAccountNumber] = useState('');
  const [pin, setPin] = useState('');
  const [showFAQ, setShowFAQ] = useState(false);
  const [keyId, setKeyId] = useState('');
  const [storedKeyId, setStoredKeyId] = useState<string | null>(null);
  const [hasUserDismissed, setHasUserDismissed] = useState(false);
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);
  const appState = useRef(AppState.currentState);
  const mountTime = useRef(Date.now());

  // Load stored keyId from AsyncStorage on mount and auto-trigger if appropriate
  useEffect(() => {
    const loadStoredKeyIdAndAutoLogin = async () => {
      try {
        const stored = await AsyncStorage.getItem('passkeyKeyId');
        console.log('[LoginScreen]: Loaded keyId from AsyncStorage:', stored);
        setStoredKeyId(stored);
        if (stored) {
          setKeyId(stored); // Pre-fill the keyId input
          
          // Check if we just logged out (within last 2 seconds)
          const lastLogoutTimeStr = await AsyncStorage.getItem('lastLogoutTime');
          const lastLogoutTime = lastLogoutTimeStr ? parseInt(lastLogoutTimeStr) : 0;
          const timeSinceLogoutMs = Date.now() - lastLogoutTime;
          
          if (timeSinceLogoutMs < 2000) {
            console.log('[LoginScreen]: Recently logged out, skipping auto-trigger on mount');
            return;
          }
          
          // Auto-trigger if conditions are met
          if (shouldAutoTrigger && !hasUserDismissed && loginMode === 'authenticate') {
            console.log('[LoginScreen]: Auto-triggering authentication on mount with keyId:', stored);
            performAuthentication(stored);
          }
        }
      } catch (error) {
        console.error('[LoginScreen]: Failed to load keyId from AsyncStorage:', error);
      }
    };

    loadStoredKeyIdAndAutoLogin();
  }, []);

  // React to enrollment completion
  useEffect(() => {
    if (enrollmentKeyId) {
      console.log('[LoginScreen]: Enrollment completed with keyId:', enrollmentKeyId);
      setStoredKeyId(enrollmentKeyId);
      setKeyId(enrollmentKeyId);
      
      // Reset auto-trigger flag so it triggers again after enrollment
      setHasAutoTriggered(false);
      setHasUserDismissed(false);
      
      // Auto-trigger login after enrollment with the new keyId directly
      console.log('[LoginScreen]: Auto-triggering authentication after enrollment with keyId:', enrollmentKeyId);
      performAuthentication(enrollmentKeyId);
    }
  }, [enrollmentKeyId]);

  // Listen for app state changes (background -> foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      // Detect when app comes back to foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[LoginScreen]: App came to foreground');
        console.log('[LoginScreen]: shouldAutoTrigger:', shouldAutoTrigger, 'hasUserDismissed:', hasUserDismissed, 'keyId:', keyId);
        
        // Reset dismissal flag when coming from background - user might want to authenticate after backgrounding
        setHasUserDismissed(false);
        
        // Auto-trigger authentication if enabled and keyId exists
        if (shouldAutoTrigger && !isAuthenticating && keyId && loginMode === 'authenticate') {
          console.log('[LoginScreen]: Auto-triggering authentication on app resume with keyId:', keyId);
          performAuthentication(keyId);
        } else {
          console.log('[LoginScreen]: Not auto-triggering. Reason:', !shouldAutoTrigger ? 'shouldAutoTrigger=false' : !keyId ? 'no keyId' : isAuthenticating ? 'already authenticating' : 'wrong mode');
        }
      }
      
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [shouldAutoTrigger, hasUserDismissed, isAuthenticating, keyId, loginMode]);

  const toggleLoginMode = () => {
    setLoginMode(loginMode === 'authenticate' ? 'legacy' : 'authenticate');
  };

  const handleEnrollPasskey = async () => {
    setIsEnrolling(true);
    
    try {
      const apiUrl = Config.TRULYYOU_API_URL;
      const authAppId = Config.TRULYYOU_AUTH_APP_ID;
      
      if (!apiUrl) {
        throw new Error('TRULYYOU_API_URL is not set in environment configuration');
      }
      if (!authAppId) {
        throw new Error('TRULYYOU_AUTH_APP_ID is not set in environment configuration');
      }
      
      console.log('[LoginScreen]: Starting passkey enrollment...');
      console.log('[LoginScreen]: API URL:', apiUrl);
      console.log('[LoginScreen]: Auth App ID:', authAppId);
      
      // Create SDK instance - it will fetch frontendUrl and deepLinkScheme automatically from backend
      // We use a dummy keyId since it's not used for enrollment
      const sdk = new TrulyYouReactNativeSDK({
        apiUrl,
        authAppId,
        keyId: 'dummy-for-enrollment'
      });
      
      await sdk.startEnrollment();
      
      console.log('[LoginScreen]: Enrollment flow initiated, waiting for callback...');
      // The deep link handler in App.tsx will save the keyId when enrollment completes
      
    } catch (error: any) {
      console.error('[LoginScreen]: Enrollment error:', error);
      Alert.alert('Enrollment Error', 'Enrollment failed: ' + (error.message || 'Unknown error'));
    } finally {
      setIsEnrolling(false);
    }
  };

  // Core authentication function that takes keyId as parameter to avoid race conditions
  const performAuthentication = async (keyIdToUse: string) => {
    setIsAuthenticating(true);
    
    try {
      console.log('[LoginScreen]: Using keyId:', keyIdToUse);
      
      const apiUrl = Config.TRULYYOU_API_URL;
      const backendApiUrl = (Config as any).NAIRA_BANK_BACKEND_URL;
      const authAppId = Config.TRULYYOU_AUTH_APP_ID;
      
      if (!apiUrl) {
        throw new Error('TRULYYOU_API_URL is not set in environment configuration');
      }
      if (!authAppId) {
        throw new Error('TRULYYOU_AUTH_APP_ID is not set in environment configuration');
      }
      if (!backendApiUrl) {
        throw new Error('NAIRA_BANK_BACKEND_URL is not set in environment configuration');
      }
      
      console.log('[LoginScreen]: API URL:', apiUrl);
      console.log('[LoginScreen]: Backend URL:', backendApiUrl);
      console.log('[LoginScreen]: Auth App ID:', authAppId);

      const sdk = new TrulyYouReactNativeSDK({
        apiUrl,
        authAppId,
        keyId: keyIdToUse,
      });

      const loginUrl = `${backendApiUrl}/api/auth/login`;
      console.log('[LoginScreen]: Calling fetchWithSignature with URL:', loginUrl);
      console.log('[LoginScreen]: Using keyId:', keyIdToUse);

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
        onLogin(loginData.user?.username || 'Demo User');
      } else {
        const errorData = await result.response.json();
        console.error('[LoginScreen]: Authentication failed:', errorData);
        Alert.alert('Authentication Failed', errorData.message || 'Unknown error');
        setIsAuthenticating(false);
      }
    } catch (error: any) {
      // Check if user cancelled - silently fail without alerts or clearing keys
      const errorMessage = (error.message || '').toLowerCase();
      const errorCode = error.code || '';
      const errorString = JSON.stringify(error).toLowerCase();
      
      const isCancellation = errorMessage.includes('cancelled by user') || 
                            errorMessage.includes('cancelled') ||
                            errorMessage.includes('canceled') ||
                            errorMessage.includes('cancel') ||
                            errorMessage.includes('operation couldn') || // Catches typos like "opetation"
                            errorCode === 1001 || // iOS ASAuthorizationError.canceled
                            errorCode === 'ERR_CANCELED' ||
                            errorString.includes('error 1001') || // iOS error code in string
                            errorString.includes('authorizationerror');
      
      if (isCancellation) {
        console.log('[LoginScreen]: User cancelled authentication - silently failing');
        // Mark as dismissed so it doesn't auto-trigger again
        setHasUserDismissed(true);
        // Reset authentication state without alerts or clearing keys
        setIsAuthenticating(false);
        return;
      }
      
      // For actual errors (not cancellations), log and show alert but don't clear keys
      console.error('[LoginScreen]: Authentication error:', error);
      Alert.alert('Authentication Error', error.message);
      setHasUserDismissed(true);
      setIsAuthenticating(false);
    }
  };

  const handleLogin = async () => {
    if (loginMode === 'authenticate') {
      if (!keyId) {
        Alert.alert('No Passkey', 'No keyId found. Please enroll a passkey first.');
        return;
      }
      console.log('[LoginScreen]: Manual login triggered with keyId:', keyId);
      await performAuthentication(keyId);
    } else {
      // Legacy mode - simulate authentication
      setIsAuthenticating(true);
      setTimeout(() => {
        setIsAuthenticating(false);
        onLogin('Demo User');
      }, 1500);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome to Naira Bank Internet Banking</Text>
        
        {/* Naira Bank Logo - click to toggle login mode */}
        <TouchableOpacity 
          style={styles.logoContainer}
          onPress={toggleLoginMode}
          activeOpacity={0.7}
        >
          <Image
            source={require('../../assets/nairabank.jpeg')}
            style={styles.logo}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
      
      {/* Login Form */}
      <View style={styles.formContainer}>
        <View style={styles.loginCard}>
          {/* Login Header */}
          <View style={styles.loginHeader}>
            <Text style={styles.loginHeaderText}>LOGIN</Text>
          </View>
          
          <View style={styles.loginContent}>
            {loginMode === 'authenticate' ? (
              // Authenticate Mode - Authenticate or Enroll button
              <View style={styles.authenticateContainer}>
                {storedKeyId ? (
                  // User is enrolled - show authenticate button
                  <TouchableOpacity
                    style={[styles.authenticateButton, isAuthenticating && styles.loginButtonDisabled]}
                    onPress={handleLogin}
                    disabled={isAuthenticating}
                  >
                    {isAuthenticating ? (
                      <View style={styles.buttonContent}>
                        <ActivityIndicator color="#FFFFFF" size="small" />
                        <Text style={styles.loginButtonText}>Authenticating...</Text>
                      </View>
                    ) : (
                      <Text style={styles.loginButtonText}>Authenticate</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  // User not enrolled - show enroll button
                  <>
                    <Text style={styles.enrollmentMessage}>
                      No passkey found. Please enroll to continue.
                    </Text>
                    <TouchableOpacity
                      style={[styles.authenticateButton, isEnrolling && styles.loginButtonDisabled]}
                      onPress={handleEnrollPasskey}
                      disabled={isEnrolling}
                    >
                      {isEnrolling ? (
                        <View style={styles.buttonContent}>
                          <ActivityIndicator color="#FFFFFF" size="small" />
                          <Text style={styles.loginButtonText}>Enrolling...</Text>
                        </View>
                      ) : (
                        <Text style={styles.loginButtonText}>Enroll Passkey</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ) : (
              // Legacy Mode - Full form with PIN and Token
              <>
                <Text style={styles.instructionText}>
                  Please choose how you would like to Log in today
                </Text>
                
                {/* Login Method Dropdown */}
                <View style={styles.dropdownContainer}>
                  <View style={styles.dropdown}>
                    <Text style={styles.dropdownText}>PIN and Token</Text>
                    <Text style={styles.dropdownArrow}>▼</Text>
                  </View>
                </View>
                
                {/* Input Fields */}
                <View style={styles.inputContainer}>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>👤</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="ACCOUNT NUMBER"
                      placeholderTextColor="#9CA3AF"
                      value={accountNumber}
                      onChangeText={setAccountNumber}
                      keyboardType="numeric"
                    />
                  </View>
                  
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>🔒</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="PIN AND TOKEN"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showPin}
                      value={pin}
                      onChangeText={setPin}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPin(!showPin)}
                      style={styles.eyeButton}
                    >
                      <Text style={styles.eyeIcon}>{showPin ? '🙈' : '👁️'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Login Button */}
                <TouchableOpacity
                  style={[styles.loginButton, isAuthenticating && styles.loginButtonDisabled]}
                  onPress={handleLogin}
                  disabled={isAuthenticating}
                >
                  {isAuthenticating ? (
                    <View style={styles.buttonContent}>
                      <ActivityIndicator color="#FFFFFF" size="small" />
                      <Text style={styles.loginButtonText}>Authenticating...</Text>
                    </View>
                  ) : (
                    <Text style={styles.loginButtonText}>LOGIN</Text>
                  )}
                </TouchableOpacity>
                
                {/* Action Links */}
                <View style={styles.actionLinks}>
                  <TouchableOpacity>
                    <Text style={styles.linkText}>FORGOT PASSWORD</Text>
                  </TouchableOpacity>
                  <TouchableOpacity>
                    <Text style={styles.linkText}>HARDWARE TOKEN UNLOCK/RESET</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </View>
      
      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLinks}>
          <TouchableOpacity>
            <Text style={styles.footerLinkText}>⚠️ SCAM ALERT</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Text style={styles.footerLinkText}>✉️ EMAIL FRAUD AND PHISHING</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Text style={styles.footerLinkText}>📞 CONTACT US</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowFAQ(!showFAQ)}>
            <Text style={styles.footerLinkText}>ℹ️ FAQ</Text>
          </TouchableOpacity>
        </View>
        
        
        <Text style={styles.copyright}>
          © 2024 NAIRA BANK PLC (LICENSED BY THE CENTRAL BANK OF NIGERIA) | TERMS & CONDITIONS
        </Text>
        
        <TouchableOpacity style={styles.otherServicesButton}>
          <Text style={styles.otherServicesText}>Other Services →</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 24,
    textAlign: 'center',
  },
  logoContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  logo: {
    width: 128,
    height: 64,
  },
  authenticateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  authenticateButton: {
    backgroundColor: '#90E93B',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#90E93B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  formContainer: {
    paddingHorizontal: 24,
    alignItems: 'center',
    flex: 1,
  },
  loginCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  loginHeader: {
    backgroundColor: '#90E93B',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  loginHeaderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  loginContent: {
    padding: 24,
  },
  instructionText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  enrollmentMessage: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  dropdownContainer: {
    marginBottom: 16,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  dropdownText: {
    fontSize: 14,
    color: '#1F2937',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#90E93B',
  },
  inputContainer: {
    gap: 12,
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1F2937',
  },
  eyeButton: {
    padding: 4,
  },
  eyeIcon: {
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: '#90E93B',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#90E93B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionLinks: {
    gap: 8,
    alignItems: 'center',
  },
  linkText: {
    color: '#2563EB',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 32,
  },
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
    justifyContent: 'center',
  },
  footerLinkText: {
    color: '#6B7280',
    fontSize: 11,
  },
  copyright: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 14,
  },
  otherServicesButton: {
    backgroundColor: '#374151',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-end',
  },
  otherServicesText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  faqSection: {
    marginTop: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  faqTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  keyIdInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  faqHint: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
  },
});

export default LoginScreen;

