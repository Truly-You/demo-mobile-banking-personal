import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface TrulyYouConfig {
  pusher: {
    realtimeUrl: string;
    appKey: string;
  };
  urls: {
    frontendUrl: string;
    sdkFrontendUrl: string;
    sdkBackendUrl: string;
    dashboardBackendUrl: string;
    mobileAppCallback: string;
  };
}

interface ConfigResponse {
  success: boolean;
  setupRequired: boolean;
  setupCompleted: boolean;
  data: {
    config: TrulyYouConfig;
    masterAppId: string;
  };
}

class ConfigService {
  private config: TrulyYouConfig | null = null;
  private fetchPromise: Promise<TrulyYouConfig> | null = null;
  private readonly CONFIG_STORAGE_KEY = 'trulyyou_config';
  private readonly CONFIG_TIMESTAMP_KEY = 'trulyyou_config_timestamp';
  private readonly CONFIG_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get the bundle ID or package name based on platform
   * For iOS: com.nairabankmobile.company
   * For Android: com.nairabankmobile
   */
  private getBundleIdentifier(): string {
    if (Platform.OS === 'ios') {
      // iOS bundle ID - would ideally come from native module
      // For now, using hardcoded value that matches Info.plist
      return 'com.nairabankmobile.company';
    } else {
      // Android package name - matches android/app/build.gradle
      return 'com.nairabankmobile';
    }
  }

  /**
   * Get the TrulyYou config, fetching from cache or API as needed
   */
  async getConfig(apiUrl: string): Promise<TrulyYouConfig> {
    // If config is already in memory, return it
    if (this.config) {
      console.log('[ConfigService]: Returning cached config from memory');
      return this.config;
    }

    // If a fetch is already in progress, wait for it
    if (this.fetchPromise) {
      console.log('[ConfigService]: Waiting for in-flight config fetch');
      return this.fetchPromise;
    }

    // Try to load from AsyncStorage first
    try {
      const cachedConfig = await AsyncStorage.getItem(this.CONFIG_STORAGE_KEY);
      const cachedTimestamp = await AsyncStorage.getItem(this.CONFIG_TIMESTAMP_KEY);

      if (cachedConfig && cachedTimestamp) {
        const age = Date.now() - parseInt(cachedTimestamp);
        if (age < this.CONFIG_TTL_MS) {
          console.log('[ConfigService]: Returning cached config from AsyncStorage (age: ' + Math.round(age / 1000 / 60) + ' min)');
          this.config = JSON.parse(cachedConfig);
          return this.config;
        } else {
          console.log('[ConfigService]: Cached config expired (age: ' + Math.round(age / 1000 / 60 / 60) + ' hours)');
        }
      }
    } catch (error) {
      console.warn('[ConfigService]: Failed to load cached config:', error);
    }

    // Fetch from API
    console.log('[ConfigService]: Fetching config from API:', apiUrl + '/api/config');
    this.fetchPromise = this.fetchConfigFromAPI(apiUrl);
    
    try {
      this.config = await this.fetchPromise;
      return this.config;
    } finally {
      this.fetchPromise = null;
    }
  }

  /**
   * Fetch config from the API and cache it
   */
  private async fetchConfigFromAPI(apiUrl: string): Promise<TrulyYouConfig> {
    const bundleIdentifier = this.getBundleIdentifier();
    const paramName = Platform.OS === 'ios' ? 'bundleId' : 'packageName';
    const url = `${apiUrl}/api/config?${paramName}=${encodeURIComponent(bundleIdentifier)}`;
    
    console.log(`[ConfigService]: Fetching config with ${paramName}: ${bundleIdentifier}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`);
    }

    const data: ConfigResponse = await response.json();

    if (!data.success || !data.data?.config) {
      throw new Error('Invalid config response from API');
    }

    const config = data.data.config;
    
    // Validate required fields
    if (!config.urls) {
      throw new Error('Config API response missing urls object');
    }
    if (!config.urls.sdkFrontendUrl) {
      throw new Error('Config API response missing urls.sdkFrontendUrl');
    }
    if (!config.urls.mobileAppCallback) {
      throw new Error('Config API response missing urls.mobileAppCallback');
    }

    // Cache in AsyncStorage
    try {
      await AsyncStorage.setItem(this.CONFIG_STORAGE_KEY, JSON.stringify(config));
      await AsyncStorage.setItem(this.CONFIG_TIMESTAMP_KEY, Date.now().toString());
      console.log('[ConfigService]: Config cached successfully');
    } catch (error) {
      console.warn('[ConfigService]: Failed to cache config:', error);
    }

    return config;
  }

  /**
   * Get the SDK frontend URL from config
   */
  async getSdkFrontendUrl(apiUrl: string): Promise<string> {
    const config = await this.getConfig(apiUrl);
    const frontendUrl = config.urls.sdkFrontendUrl;
    
    if (!frontendUrl) {
      throw new Error('sdkFrontendUrl is not set in TrulyYou config API response');
    }
    
    return frontendUrl;
  }

  /**
   * Get the mobile app callback scheme from config
   */
  async getMobileAppCallback(apiUrl: string): Promise<string> {
    const config = await this.getConfig(apiUrl);
    const callback = config.urls.mobileAppCallback;
    
    if (!callback) {
      throw new Error('mobileAppCallback is not set in TrulyYou config API response');
    }
    
    return callback;
  }

  /**
   * Clear cached config (force refresh on next request)
   */
  async clearCache(): Promise<void> {
    this.config = null;
    try {
      await AsyncStorage.removeItem(this.CONFIG_STORAGE_KEY);
      await AsyncStorage.removeItem(this.CONFIG_TIMESTAMP_KEY);
      console.log('[ConfigService]: Cache cleared');
    } catch (error) {
      console.warn('[ConfigService]: Failed to clear cache:', error);
    }
  }
}

// Export singleton instance
export const configService = new ConfigService();

