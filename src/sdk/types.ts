export interface TrulyYouReactNativeSDKConfig {
  apiUrl: string // Required: SDK backend URL
  authAppId: string // Required: Auth app ID
  keyId: string // Required: keyId from passkey stored on device
  frontendUrl?: string // Optional: SDK frontend URL (will be fetched from backend if not provided)
  deepLinkScheme?: string // Optional: Deep link scheme for enrollment callback (will be fetched from backend if not provided)
}

export interface FetchOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
}

export interface SigningResult {
  signature: string
  keyId: string
  signatureId?: string
}

export interface FetchResult {
  response: Response
  signature?: string
  signatureId?: string
}
