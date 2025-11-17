import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
  TextInput,
} from 'react-native';
import { Mrtd } from '@truly-you/react-native-sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';

// Debug: Log immediately when module loads
console.log('🔵🔵🔵 [Dashboard] MODULE LOADED 🔵🔵🔵');
console.log('[Dashboard] Module loaded. Mrtd:', Mrtd);
console.log('[Dashboard] Mrtd.isNfcAvailable type:', typeof Mrtd?.isNfcAvailable);
console.log('[Dashboard] Mrtd.readPassport type:', typeof Mrtd?.readPassport);

interface DashboardScreenProps {
  username?: string;
  onLogout: () => void;
  isNfcReadingRef?: React.MutableRefObject<boolean>;
  isMrzCameraRef?: React.MutableRefObject<boolean>;
  onNavigateToCards?: () => void;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ username, onLogout, isNfcReadingRef, isMrzCameraRef, onNavigateToCards }) => {
  const [nfcAvailable, setNfcAvailable] = useState(false);
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPassportReader, setShowPassportReader] = useState(false);
  const defaultMrz =
    'P<NLDSPIES<<RORY<FREDERIK<<<<<\n' +
    'NRK2DJ9498NLD9803134M3102101229624789<<<<<38';
  const [mrzText, setMrzText] = useState(defaultMrz);

  useEffect(() => {
    (async () => {
      console.log('===== [Dashboard] NFC CHECK START =====');
      const RN = require('react-native');
      console.log('[Dashboard] NativeModules.TrulyMrtd:', RN.NativeModules.TrulyMrtd);
      console.log('[Dashboard] All modules:', Object.keys(RN.NativeModules).join(', '));
      
      if (!RN.NativeModules.TrulyMrtd) {
        console.error('[Dashboard] ❌ TrulyMrtd NOT FOUND in NativeModules!');
        setNfcAvailable(false);
        return;
      }
      
      console.log('[Dashboard] ✅ TrulyMrtd found! Calling isNfcAvailable...');
      try {
        const result = await RN.NativeModules.TrulyMrtd.isNfcAvailable();
        console.log('[Dashboard] Result:', result);
        setNfcAvailable(result);
      } catch (e: any) {
        console.error('[Dashboard] Error:', e?.message || e);
        setNfcAvailable(false);
      }
      console.log('===== [Dashboard] NFC CHECK END =====');
      try {
        const saved = await AsyncStorage.getItem('mrzText');
        if (saved && saved.trim().length > 0) {
          setMrzText(saved);
        }
      } catch (e) {
        console.error('[Dashboard] Error loading saved MRZ:', e);
      }
    })();
  }, []);

  const handleRead = async () => {
    console.log('[Dashboard] handleRead called');
    console.log('[Dashboard] Platform.OS:', Platform.OS);
    console.log('[Dashboard] Mrtd.readPassport:', typeof Mrtd?.readPassport);
    setError(null);
    setResult(null);
    setReading(true);
    if (isNfcReadingRef) {
      isNfcReadingRef.current = true; // Mark NFC reading as in progress
    }
    try {
      console.log('[Dashboard] Calling Mrtd.readPassport with MRZ:', mrzText.substring(0, 50));
      console.log('[Dashboard] Mrtd object keys:', Object.keys(Mrtd));
      console.log('[Dashboard] Mrtd.readPassport function:', Mrtd.readPassport);
      console.log('[Dashboard] Mrtd.readPassport.toString():', Mrtd.readPassport?.toString?.()?.substring(0, 200));
      const data = await Mrtd.readPassport(mrzText);
      console.log('[Dashboard] readPassport returned:', data ? 'data received' : 'no data');
      setResult(data);
      // Post extraction to backend (awaited, with basic logging)
      try {
        const appId = Config.TRULYYOU_AUTH_APP_ID || '';
        const endpoint = 'https://e9387f0a6b74.ngrok-free.app/api/biometric/extractions';
        if (data?.mrz && data?.faceImageBase64) {
          const extraction = {
            givenNames: data.mrz.secondaryIdentifier || '',
            surname: data.mrz.primaryIdentifier || '',
            nationality: data.mrz.nationality || '',
            sex: (data.mrz.sex || '').toString().toUpperCase().startsWith('M') ? 'MALE'
              : (data.mrz.sex || '').toString().toUpperCase().startsWith('F') ? 'FEMALE' : 'UNSPECIFIED',
            dateOfBirth: formatMrzDate(data.mrz.dateOfBirth),
            documentType: data.mrz.documentCode || 'P',
            documentNumber: data.mrz.documentNumber || '',
            expiryDate: formatMrzDate(data.mrz.dateOfExpiry),
            issuingCountry: data.mrz.issuingState || '',
            issuer: data.mrz.issuingState || '',
            portrait: {
              mimeType: data.faceImageMimeType || 'image/jpeg',
              base64: data.faceImageBase64
            }
          };
          const body = {
            appId,
            reference: `mrtd_${Date.now()}`,
            metadata: { platform: Platform.OS, source: 'demo-mobile-banking-personal' },
            extraction
          };
          console.log('[MRTD] POST to backend', endpoint);
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          const ok = res.ok;
          console.log('[MRTD] POST status', res.status, 'ok=', ok);
          try {
            const json = await res.json();
            const portrait = json?.data?.portrait;
            if (portrait?.base64 && portrait?.mimeType) {
              // Replace local portrait with server-converted one (e.g., JPEG)
              setResult((prev: any) => {
                const next = { ...(prev || data) };
                next.faceImageBase64 = portrait.base64;
                next.faceImageMimeType = portrait.mimeType;
                return next;
              });
            }
          } catch {
            // ignore parse errors
          }
        }
      } catch (e: any) {
        console.log('[MRTD] POST failed', e?.message || String(e));
      }
    } catch (e: any) {
      const errorMsg = e?.message || e?.toString() || 'Failed to read passport';
      console.error('[Dashboard] Read passport error:', errorMsg);
      console.error('[Dashboard] Error object:', e);
      console.error('[Dashboard] Error name:', e?.name);
      console.error('[Dashboard] Error code:', e?.code);
      console.error('[Dashboard] Full error:', JSON.stringify(e, null, 2));
      setError(errorMsg);
    } finally {
      setReading(false);
      if (isNfcReadingRef) {
        isNfcReadingRef.current = false; // Mark NFC reading as complete
      }
    }
  };
  const handleSaveMrz = async () => {
    try {
      await AsyncStorage.setItem('mrzText', mrzText);
    } catch {}
  };

  const handleReadMrz = async () => {
    console.log('[Dashboard] handleReadMrz called');
    setError(null);
    if (isMrzCameraRef) {
      isMrzCameraRef.current = true; // Mark MRZ camera as active
      console.log('[Dashboard] MRZ camera marked as active');
    }
    try {
      const detectedMrz = await Mrtd.readMrz();
      console.log('[Dashboard] readMrz returned:', detectedMrz ? 'MRZ detected' : 'no MRZ');
      if (detectedMrz && detectedMrz.trim().length > 0) {
        setMrzText(detectedMrz);
        // Auto-save the detected MRZ
        await AsyncStorage.setItem('mrzText', detectedMrz);
        console.log('[Dashboard] MRZ detected and saved:', detectedMrz.substring(0, 50));
      }
    } catch (e: any) {
      console.error('[Dashboard] readMrz error:', e);
      setError(e?.message || 'Failed to read MRZ');
    } finally {
      if (isMrzCameraRef) {
        isMrzCameraRef.current = false; // Mark MRZ camera as inactive
        console.log('[Dashboard] MRZ camera marked as inactive');
      }
    }
  };
  const formatMrzDate = (yyMMdd?: string) => {
    if (!yyMMdd || yyMMdd.length !== 6) return yyMMdd || '';
    const yy = parseInt(yyMMdd.slice(0, 2), 10);
    const mm = yyMMdd.slice(2, 4);
    const dd = yyMMdd.slice(4, 6);
    const currentYY = parseInt(new Date().getFullYear().toString().slice(-2), 10);
    const century = yy > currentYY ? '19' : '20';
    return `${century}${yy.toString().padStart(2, '0')}-${mm}-${dd}`;
  };
  const sexToWord = (s?: string) => {
    if (!s) return '';
    const c = s.toUpperCase()[0];
    if (c === 'M') return 'MALE';
    if (c === 'F') return 'FEMALE';
    return 'UNSPECIFIED';
  };
  const handleLogout = () => {
    onLogout();
  };
  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Image
            source={require('../assets/nairabank.jpeg')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>Personal Internet Banking</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Welcome Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome to Your Dashboard</Text>
          <Text style={styles.cardText}>
            You have successfully logged in to Naira Bank Personal Internet Banking.
          </Text>
          {username && (
            <View style={styles.userInfo}>
              <Text style={styles.userInfoLabel}>Logged in as:</Text>
              <Text style={styles.userInfoValue}>{username}</Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <View style={styles.quickActionCard}>
            <Text style={styles.quickActionIcon}>💰</Text>
            <Text style={styles.quickActionTitle}>Account Balance</Text>
            <Text style={styles.quickActionText}>
              View your account balance and transaction history
            </Text>
          </View>

          <View style={styles.quickActionCard}>
            <Text style={styles.quickActionIcon}>📤</Text>
            <Text style={styles.quickActionTitle}>Transfer Funds</Text>
            <Text style={styles.quickActionText}>
              Transfer money to other accounts securely
            </Text>
          </View>

          <View style={styles.quickActionCard}>
            <Text style={styles.quickActionIcon}>💳</Text>
            <Text style={styles.quickActionTitle}>Pay Bills</Text>
            <Text style={styles.quickActionText}>
              Pay your utility bills and other services
            </Text>
          </View>

          {onNavigateToCards && (
            <TouchableOpacity style={styles.quickActionCard} onPress={onNavigateToCards}>
              <Text style={styles.quickActionIcon}>💳</Text>
              <Text style={styles.quickActionTitle}>Cards</Text>
              <Text style={styles.quickActionText}>
                Manage your virtual and physical cards
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Recent Activity */}
        <View style={styles.card}>
          <TouchableOpacity onPress={() => setShowPassportReader(!showPassportReader)}>
            <Text style={styles.cardTitle}>Recent Activity</Text>
            <Text style={styles.cardText}>No recent transactions to display.</Text>
          </TouchableOpacity>
          
          {showPassportReader && (
            <View style={{ marginTop: 16 }}>
              {/* MRTD Reader */}
              <Text style={styles.cardTitle}>Passport NFC Reader</Text>
              <Text style={styles.cardText}>
                Tap Read and hold the passport to the back of the phone.
              </Text>
              <Text style={[styles.userInfoLabel, { marginBottom: 6 }]}>MRZ (TD3 - 2 lines)</Text>
              <TouchableOpacity 
                style={[styles.readButton, { backgroundColor: '#10B981', marginBottom: 8 }]} 
                onPress={handleReadMrz}
              >
                <Text style={styles.readButtonText}>📷 Scan MRZ with Camera</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.textInput}
                multiline
                value={mrzText}
                onChangeText={setMrzText}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="Paste or scan MRZ here..."
              />
              <TouchableOpacity style={[styles.readButton, { backgroundColor: '#374151', marginBottom: 8 }]} onPress={handleSaveMrz}>
                <Text style={styles.readButtonText}>Save MRZ</Text>
              </TouchableOpacity>
              <Text style={[styles.quickActionText, { marginBottom: 8 }]}>
                NFC available: {nfcAvailable ? 'Yes' : 'No'}
              </Text>
              <TouchableOpacity
                style={[styles.readButton, reading ? styles.readButtonDisabled : null]}
                onPress={handleRead}
                disabled={reading || !nfcAvailable}
              >
                <Text style={styles.readButtonText}>{reading ? 'Waiting for NFC...' : 'Read Passport'}</Text>
              </TouchableOpacity>
              {error && <Text style={[styles.cardText, { color: '#DC2626' }]}>{error}</Text>}
              {result?.mrz && (
                <View style={styles.userInfo}>
                  <Text style={styles.userInfoLabel}>givenNames</Text>
                  <Text style={styles.userInfoValue}>{result.mrz.secondaryIdentifier || ''}</Text>

                  <Text style={styles.userInfoLabel}>surname</Text>
                  <Text style={styles.userInfoValue}>{result.mrz.primaryIdentifier || ''}</Text>

                  <Text style={styles.userInfoLabel}>nationality</Text>
                  <Text style={styles.userInfoValue}>{result.mrz.nationality || ''}</Text>

                  <Text style={styles.userInfoLabel}>sex</Text>
                  <Text style={styles.userInfoValue}>{sexToWord(result.mrz.sex)}</Text>

                  <Text style={styles.userInfoLabel}>dateOfBirth</Text>
                  <Text style={styles.userInfoValue}>{formatMrzDate(result.mrz.dateOfBirth)}</Text>

                  <Text style={styles.userInfoLabel}>personalNumber</Text>
                  <Text style={styles.userInfoValue}>{result.mrz.personalNumber ?? 'null'}</Text>

                  <Text style={styles.userInfoLabel}>documentType</Text>
                  <Text style={styles.userInfoValue}>{result.mrz.documentCode || ''}</Text>

                  <Text style={styles.userInfoLabel}>documentNumber</Text>
                  <Text style={styles.userInfoValue}>{result.mrz.documentNumber || ''}</Text>

                  <Text style={styles.userInfoLabel}>expiryDate</Text>
                  <Text style={styles.userInfoValue}>{formatMrzDate(result.mrz.dateOfExpiry)}</Text>

                  <Text style={styles.userInfoLabel}>issuingCountry</Text>
                  <Text style={styles.userInfoValue}>{result.mrz.issuingState || ''}</Text>

                  <Text style={styles.userInfoLabel}>issuer</Text>
                  <Text style={styles.userInfoValue}>{result.mrz.issuingState || ''}</Text>
                </View>
              )}
              {result?.faceImageBase64 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.userInfoLabel}>portrait</Text>
                  <Image
                    source={{ uri: `data:${result.faceImageMimeType || 'image/jpeg'};base64,${result.faceImageBase64}` }}
                    style={{ width: 160, height: 200, borderRadius: 6, backgroundColor: '#E5E7EB' }}
                    resizeMode="cover"
                  />
                  {String(result.faceImageMimeType || '').toLowerCase().includes('jp2') && (
                    <Text style={[styles.cardText, { marginTop: 6 }]}>
                      Preview for image/jp2 may not render on some Android devices. Data extracted OK.
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          © 2024 NAIRA BANK PLC (LICENSED BY THE CENTRAL BANK OF NIGERIA)
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
  },
  logoutButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#90E93B',
    marginBottom: 12,
  },
  cardText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  userInfo: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 6,
    marginTop: 8,
  },
  userInfoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  userInfoValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  quickActions: {
    gap: 16,
  },
  quickActionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 14,
    color: '#6B7280',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    padding: 12,
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minHeight: 90,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  readButton: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 8,
  },
  readButtonDisabled: {
    opacity: 0.6,
  },
  readButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginTop: 32,
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

export default DashboardScreen;

