declare module 'react-native-config' {
  export interface NativeConfig {
    TRULYYOU_API_URL?: string;
    TRULYYOU_AUTH_APP_ID?: string;
    NAIRA_BANK_BACKEND_URL?: string;
  }

  export const Config: NativeConfig;
  export default Config;
}

