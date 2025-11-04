import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';
import { TrulyYouReactNativeSDK } from '../sdk/TrulyYouReactNativeSDK';

interface LoginScreenProps {
  onLogin: (username?: string) => void;
  enrollmentKeyId: string | null; // Passed from App when enrollment completes
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, enrollmentKeyId }) => {
  const [loginMode, setLoginMode] = useState<'authenticate' | 'legacy'>('authenticate');
  const [showPin, setShowPin] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [accountNumber, setAccountNumber] = useState('');
  const [pin, setPin] = useState('');
  const [showFAQ, setShowFAQ] = useState(false);
  const [keyId, setKeyId] = useState('');
  const [storedKeyId, setStoredKeyId] = useState<string | null>(null);

  // Load stored keyId from AsyncStorage on mount
  useEffect(() => {
    const loadStoredKeyId = async () => {
      try {
        const stored = await AsyncStorage.getItem('passkeyKeyId');
        console.log('[LoginScreen]: Loaded keyId from AsyncStorage:', stored);
        setStoredKeyId(stored);
        if (stored) {
          setKeyId(stored); // Pre-fill the keyId input
        }
      } catch (error) {
        console.error('[LoginScreen]: Failed to load keyId from AsyncStorage:', error);
      }
    };

    loadStoredKeyId();
  }, []);

  // React to enrollment completion
  useEffect(() => {
    if (enrollmentKeyId) {
      console.log('[LoginScreen]: Enrollment completed with keyId:', enrollmentKeyId);
      setStoredKeyId(enrollmentKeyId);
      setKeyId(enrollmentKeyId);
    }
  }, [enrollmentKeyId]);

  const toggleLoginMode = () => {
    setLoginMode(loginMode === 'authenticate' ? 'legacy' : 'authenticate');
  };

  const handleEnrollPasskey = async () => {
    setIsEnrolling(true);
    
    try {
      const apiUrl = Config.TRULYYOU_API_URL || 'https://api.dev.ng.truly.you';
      const frontendUrl = Config.TRULYYOU_FRONTEND_URL || 'https://dev.ng.truly.you';
      const authAppId = Config.TRULYYOU_AUTH_APP_ID || '68ffc3b61f30b67a3fae716e';
      
      console.log('[LoginScreen]: Starting passkey enrollment...');
      console.log('[LoginScreen]: API URL:', apiUrl);
      console.log('[LoginScreen]: Frontend URL:', frontendUrl);
      console.log('[LoginScreen]: Auth App ID:', authAppId);
      
      // Create a temporary SDK instance just for enrollment
      // We use a dummy keyId since it's not used for enrollment
      const sdk = new TrulyYouReactNativeSDK({
        apiUrl,
        frontendUrl,
        authAppId,
        keyId: 'dummy-for-enrollment',
        deepLinkScheme: 'nairabankapp'
      });
      
      await sdk.startEnrollment();
      
      console.log('[LoginScreen]: Enrollment flow initiated, waiting for callback...');
      // The deep link handler in App.tsx will save the keyId when enrollment completes
      
    } catch (error: any) {
      console.error('[LoginScreen]: Enrollment error:', error);
      alert('Enrollment failed: ' + (error.message || 'Unknown error'));
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleLogin = async () => {
    // No longer require keyId - we have a fallback
    setIsAuthenticating(true);
    
    try {
      if (loginMode === 'authenticate') {
        // Use React Native SDK for authentication
        // Get values from environment variables
        console.log('[LoginScreen]: Config object:', Config);
        console.log('[LoginScreen]: Config.TRULYYOU_AUTH_APP_ID:', Config.TRULYYOU_AUTH_APP_ID);
        console.log('[LoginScreen]: All Config keys:', Object.keys(Config || {}));
        
        // Use keyId from input or fallback to hardcoded default
        const finalKeyId = keyId || 'ZmaJrVuF8hDz-IRQAY093A';
        console.log('[LoginScreen]: Using keyId:', finalKeyId, keyId ? '(from input)' : '(fallback)');
        
        const apiUrl = Config.TRULYYOU_API_URL || 'https://api.dev.ng.truly.you';
        const backendApiUrl = Config.TRULYYOU_BACKEND_API_URL || 'https://personalbanking-api.demo.truly.you';
        const authAppId = Config.TRULYYOU_AUTH_APP_ID || '68ffc3b61f30b67a3fae716e'; // Fallback for now
        
        console.log('[LoginScreen]: Final authAppId:', authAppId);
        console.log('[LoginScreen]: API URL:', apiUrl);
        console.log('[LoginScreen]: Backend URL:', backendApiUrl);
        
        if (!authAppId) {
          throw new Error('TRULYYOU_AUTH_APP_ID is required. Please set it in your .env file.');
        }

        const sdk = new TrulyYouReactNativeSDK({
          apiUrl,
          authAppId,
          keyId: finalKeyId,
        });

        const loginUrl = `${backendApiUrl}/api/auth/login`;
        console.log('[LoginScreen]: Calling fetchWithSignature with URL:', loginUrl);
        console.log('[LoginScreen]: Using keyId:', finalKeyId);

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
          alert('Authentication failed: ' + (errorData.message || 'Unknown error'));
          setIsAuthenticating(false);
        }
      } else {
        // Legacy mode - simulate authentication
        setTimeout(() => {
          setIsAuthenticating(false);
          onLogin('Demo User');
        }, 1500);
      }
    } catch (error: any) {
      console.error('[LoginScreen]: Authentication error:', error);
      
      // If passkey not found (e.g., user deleted it), clear stored keyId
      if (error.message && (error.message.includes('Cancelled by user') || error.message.includes('No credentials'))) {
        console.log('[LoginScreen]: Passkey not found, clearing stored keyId');
        await AsyncStorage.removeItem('passkeyKeyId');
        setStoredKeyId(null);
        setKeyId('');
        alert('Passkey not found. Please enroll again.');
      } else {
        alert('Authentication error: ' + (error.message || 'Unknown error'));
      }
      
      setIsAuthenticating(false);
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
        
        {/* Hidden keyId input in FAQ section */}
        {showFAQ && (
          <View style={styles.faqSection}>
            <Text style={styles.faqTitle}>Developer Settings</Text>
            <TextInput
              style={styles.keyIdInput}
              placeholder="Enter KeyId from passkey"
              placeholderTextColor="#9CA3AF"
              value={keyId}
              onChangeText={setKeyId}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.faqHint}>
              Paste the keyId from your passkey configured on dev.ng.truly.you
            </Text>
          </View>
        )}
        
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

