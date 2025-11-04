export interface TrulyYouReactNativeSDKConfig {
  apiUrl?: string
  frontendUrl?: string
  authAppId?: string
  keyId: string // Required: keyId from passkey stored on device
  deepLinkScheme?: string // Optional: Deep link scheme for enrollment callback (e.g., 'nairabankapp')
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
