import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import Config from 'react-native-config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrulyYouReactNativeSDK } from '@truly-you/react-native-sdk';

interface TokenizedCard {
  token: string;
  last4: string;
  expiry: string;
  brand: string;
  createdAt: string;
  type?: string;
}

interface CardsScreenProps {
  onBack: () => void;
  sdk: TrulyYouReactNativeSDK | null; // Main banking SDK (don't touch)
}

const CardsScreen: React.FC<CardsScreenProps> = ({ onBack, sdk }) => {
  const [cards, setCards] = useState<TokenizedCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [nairaCardSdk, setNairaCardSdk] = useState<TrulyYouReactNativeSDK | null>(null);

  const nairaCardBackendUrl = Config.NAIRA_CARD_BACKEND_URL;
  const nairaCardAuthAppId = Config.NAIRA_CARD_AUTH_APP_ID;
  const nairaCardApiUrl = Config.NAIRA_CARD_API_URL || Config.TRULYYOU_API_URL;

  // Initialize Naira Card SDK
  useEffect(() => {
    if (!nairaCardAuthAppId || !nairaCardApiUrl) {
      console.warn('[CardsScreen]: Missing Naira Card environment variables');
      return;
    }

    const initNairaCardSdk = async () => {
      try {
        // Initialize Naira Card SDK with its own authAppId
        // The SDK will automatically:
        // 1. Fetch its own authFlowId based on nairaCardAuthAppId
        // 2. Look for keyId stored as `trulyYouKeyId_<nairaCardAuthFlowId>`
        // 3. If not found, trigger enrollment for this specific flow when fetchWithSignature is called
        const sdkConfig: any = {
          apiUrl: nairaCardApiUrl,
          authAppId: nairaCardAuthAppId,
        };
        
        if (Platform.OS === 'ios') {
          sdkConfig.bundleId = 'com.nairabankmobile.company';
        } else if (Platform.OS === 'android') {
          sdkConfig.packageName = 'com.nairabankmobile';
        }

        const nairaCardSdkInstance = new TrulyYouReactNativeSDK(sdkConfig);
        
        // Check if keyId exists for Naira Card flow
        // The SDK will handle enrollment automatically when fetchWithSignature is called if no keyId exists
        const isEnrolled = await nairaCardSdkInstance.isEnrolled();
        if (isEnrolled) {
          console.log('[CardsScreen]: User is enrolled for Naira Card flow');
        } else {
          console.log('[CardsScreen]: No keyId found for Naira Card flow - enrollment will be triggered on first fetchWithSignature');
        }
        
        setNairaCardSdk(nairaCardSdkInstance);
        console.log('[CardsScreen]: Naira Card SDK initialized');
      } catch (error) {
        console.error('[CardsScreen]: Error initializing Naira Card SDK:', error);
      }
    };

    initNairaCardSdk();
  }, [sdk, nairaCardAuthAppId, nairaCardApiUrl]);

  // Fetch cards on mount
  useEffect(() => {
    if (nairaCardSdk && nairaCardBackendUrl) {
      fetchCards();
    }
  }, [nairaCardSdk, nairaCardBackendUrl]);

  // Helper to get keyId for Naira Card flow
  const getNairaCardKeyId = async (): Promise<string | null> => {
    if (!nairaCardAuthAppId || !nairaCardApiUrl) return null;

    try {
      // Fetch authFlowId for Naira Card app
      const configResponse = await fetch(`${nairaCardApiUrl}/api/apps/${nairaCardAuthAppId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (configResponse.ok) {
        const configData = await configResponse.json();
        const app = configData.app || configData;
        const authFlowId = app?.authFlowId;

        if (authFlowId) {
          const storageKey = `trulyYouKeyId_${authFlowId}`;
          const storedKeyId = await AsyncStorage.getItem(storageKey);
          return storedKeyId;
        }
      }
    } catch (error) {
      console.error('[CardsScreen]: Error getting Naira Card keyId:', error);
    }

    return null;
  };

  const fetchCards = async () => {
    if (!nairaCardBackendUrl) {
      console.warn('[CardsScreen]: Missing backend URL');
      return;
    }

    try {
      setLoading(true);
      
      // Get keyId for Naira Card flow (uses Naira Card's authFlowId)
      const nairaCardKeyId = await getNairaCardKeyId();
      
      if (!nairaCardKeyId) {
        console.log('[CardsScreen]: No keyId found for Naira Card flow - user needs to enroll first');
        setCards([]);
        return;
      }

      console.log('[CardsScreen]: Fetching cards with keyId:', nairaCardKeyId?.substring(0, 10) + '...');
      const response = await fetch(`${nairaCardBackendUrl}/tokens`, {
        headers: {
          'Authorization': nairaCardKeyId,
          'Content-Type': 'application/json'
        }
      });

      console.log('[CardsScreen]: /tokens response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[CardsScreen]: Cards fetched successfully:', data.cards?.length || 0);
        setCards(data.cards || []);
      } else {
        const errorText = await response.text();
        console.warn('[CardsScreen]: /tokens error - status:', response.status, 'response:', errorText);
        if (response.status === 401) {
          console.warn('[CardsScreen]: Unauthorized - keyId may be invalid or missing');
        }
        setCards([]);
      }
    } catch (error) {
      console.error('[CardsScreen]: Error fetching cards:', error);
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  const handleIssueCard = async () => {
    if (!nairaCardSdk || !nairaCardBackendUrl) {
      Alert.alert('Error', 'Naira Card SDK not initialized');
      return;
    }

    // Show confirmation
    Alert.alert(
      'Issue Virtual Card',
      'A virtual card will be issued. A fee of NGN 500 will be charged. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setIssuing(true);
              
              const issueUrl = `${nairaCardBackendUrl}/issue`;
              
              const result = await nairaCardSdk.fetchWithSignature(issueUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });

              if (!result || !result.response) {
                Alert.alert('Error', 'Failed to issue card');
                setIssuing(false);
                return;
              }

              if (result.response.ok) {
                const issueData = await result.response.json();
                Alert.alert('Success', `Virtual card issued!\nLast 4: ${issueData.last4}\nToken: ${issueData.token.substring(0, 10)}...`);
                // Refresh cards list
                await fetchCards();
              } else {
                const errorData = await result.response.json();
                Alert.alert('Error', errorData.message || 'Failed to issue card');
              }
            } catch (error: any) {
              console.error('[CardsScreen]: Error issuing card:', error);
              Alert.alert('Error', error.message || 'Failed to issue card');
            } finally {
              setIssuing(false);
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Cards</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Issue Card Button */}
        <TouchableOpacity
          style={[styles.issueButton, issuing && styles.issueButtonDisabled]}
          onPress={handleIssueCard}
          disabled={issuing || !nairaCardSdk}
        >
          {issuing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.issueButtonText}>Issue New Virtual Card</Text>
          )}
        </TouchableOpacity>

        {/* Cards List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#90E93B" />
            <Text style={styles.loadingText}>Loading cards...</Text>
          </View>
        ) : cards.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No cards yet</Text>
            <Text style={styles.emptySubtext}>Issue a virtual card to get started</Text>
          </View>
        ) : (
          <View style={styles.cardsList}>
            {cards.map((card, index) => (
              <View key={card.token} style={styles.cardItem}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardBrand}>{card.brand}</Text>
                  <Text style={styles.cardType}>{card.type === 'virtual' ? 'Virtual' : 'Physical'}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardNumber}>**** **** **** {card.last4}</Text>
                  <Text style={styles.cardExpiry}>Expires: {card.expiry}</Text>
                </View>
                <Text style={styles.cardDate}>
                  Issued: {new Date(card.createdAt).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}
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
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#90E93B',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 60,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  issueButton: {
    backgroundColor: '#90E93B',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  issueButtonDisabled: {
    opacity: 0.6,
  },
  issueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  cardsList: {
    gap: 16,
  },
  cardItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardBrand: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  cardType: {
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  cardBody: {
    marginBottom: 12,
  },
  cardNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    letterSpacing: 2,
    marginBottom: 8,
  },
  cardExpiry: {
    fontSize: 14,
    color: '#6B7280',
  },
  cardDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});

export default CardsScreen;

