declare module 'react-native-config' {
  export interface NativeConfig {
    TRULYYOU_API_URL?: string;
    TRULYYOU_AUTH_APP_ID?: string;
    NAIRA_BANK_BACKEND_URL?: string;
    // Naira Card (virtual card) configuration
    NAIRA_CARD_AUTH_APP_ID?: string;
    NAIRA_CARD_API_URL?: string; // Optional, defaults to TRULYYOU_API_URL
    NAIRA_CARD_BACKEND_URL?: string;
  }

  export const Config: NativeConfig;
  export default Config;
}

