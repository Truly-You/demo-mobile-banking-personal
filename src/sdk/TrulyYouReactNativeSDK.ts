import { TrulyYouReactNativeSDKConfig, FetchOptions, SigningResult, FetchResult } from './types'
import { Passkey } from 'react-native-passkey'
import { Linking } from 'react-native'

export class TrulyYouReactNativeSDK {
  private config: TrulyYouReactNativeSDKConfig
  private apiUrl: string
  private frontendUrl: string
  private authAppId: string | undefined
  private keyId: string
  private deepLinkScheme: string

  constructor(config: TrulyYouReactNativeSDKConfig) {
    this.config = config
    this.apiUrl = config.apiUrl || 'http://localhost:3003'
    this.frontendUrl = config.frontendUrl || 'https://dev.ng.truly.you'
    this.authAppId = config.authAppId
    this.keyId = config.keyId
    this.deepLinkScheme = config.deepLinkScheme || 'nairabankapp'

    if (!this.keyId) {
      throw new Error('keyId is required for TrulyYouReactNativeSDK')
    }
  }

  /**
   * Start enrollment flow - opens Custom Tab for passkey creation
   * Returns a Promise that resolves when the deep link is received
   */
  async startEnrollment(): Promise<void> {
    if (!this.authAppId) {
      throw new Error('authAppId is required for enrollment. Please configure authAppId in SDK config.')
    }

    console.log('[ReactNativeSDK]: Starting enrollment flow')

    try {
      // Step 1: Get app to retrieve authFlowId
      const appResponse = await fetch(`${this.apiUrl}/api/apps/${this.authAppId}`)
      
      if (!appResponse.ok) {
        throw new Error('Failed to load app configuration')
      }

      const appData = await appResponse.json()
      const app = appData.app

      if (!app.authFlowId) {
        throw new Error('App does not have an authentication flow configured')
      }

      console.log('[ReactNativeSDK]: App loaded, authFlowId:', app.authFlowId)

      // Step 2: Generate a clientId for this session
      const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Step 3: Create session via SDK backend
      const sessionResponse = await fetch(`${this.apiUrl}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: this.authAppId,
          flowId: app.authFlowId,
          clientId: clientId
        })
      })

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json()
        throw new Error(errorData.error || 'Failed to create enrollment session')
      }

      const sessionData = await sessionResponse.json()
      const sessionId = sessionData.data.sessionId

      console.log('[ReactNativeSDK]: Session created:', sessionId)

      // Step 4: Build enrollment URL with deep link parameters
      const returnUrl = `${this.deepLinkScheme}://enrollment-success`
      const enrollUrlParams = new URLSearchParams({
        authAppId: this.authAppId,
        sessionId: sessionId,
        returnTo: 'deeplink',
        returnUrl: returnUrl
      })
      
      const enrollUrl = `${this.frontendUrl}/enroll?${enrollUrlParams.toString()}`

      console.log('[ReactNativeSDK]: Opening Custom Tab for enrollment:', enrollUrl)

      // Step 5: Open Custom Tab (opens in main browser, not in-app)
      // Note: Don't use canOpenURL() for HTTPS URLs as it may return false on Android
      // Just try to open it and catch any errors
      try {
        await Linking.openURL(enrollUrl)
        console.log('[ReactNativeSDK]: Custom Tab opened successfully')
        console.log('[ReactNativeSDK]: Waiting for deep link callback to:', returnUrl)
      } catch (openError: any) {
        console.error('[ReactNativeSDK]: Failed to open URL:', openError)
        throw new Error('Failed to open enrollment URL: ' + openError.message)
      }
      
      // Note: The app needs to handle the deep link and call a callback
      // The keyId will be received via deep link: nairabankapp://enrollment-success?keyId=...
      
    } catch (error) {
      console.error('[ReactNativeSDK]: Enrollment failed:', error)
      throw error
    }
  }

  /**
   * Encode payload the same way web SDK does
   */
  private encodePayload(apiCallStructure: {
    body: any
    uri: string
    method: string
    headers?: any
  }): string {
    const sortObjectByKeys = (obj: any): any => {
      if (obj === null || typeof obj !== 'object' || obj instanceof Array) {
        return obj
      }
      const sorted: any = {}
      Object.keys(obj).sort().forEach(key => {
        sorted[key] = sortObjectByKeys(obj[key])  // Recursive sorting like web SDK
      })
      return sorted
    }

    const dataToProcess = apiCallStructure.body === undefined || apiCallStructure.body === null ? {} : apiCallStructure.body
    const queryParamsToProcess = {} // Extract from URI if needed
    
    const sortedData = sortObjectByKeys(dataToProcess)
    const sortedQueryParams = sortObjectByKeys(queryParamsToProcess)
    
    // React Native compatible base64 encoding
    const encodedBody = this.base64Encode(JSON.stringify(sortedData))
    const encodedQueryParams = this.base64Encode(JSON.stringify(sortedQueryParams))
    
    const payloadData = {
      method: apiCallStructure.method,
      uriId: apiCallStructure.uri,
      requestBody: encodedBody,
      queryParams: encodedQueryParams,
    }
    
    return this.base64Encode(JSON.stringify(payloadData))
  }

  /**
   * Base64 encode for React Native with proper UTF-8 handling
   */
  private base64Encode(str: string): string {
    // Convert string to UTF-8 bytes first, then encode
    // This ensures characters like underscores in signatureId are handled correctly
    const utf8Bytes: number[] = []
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i)
      if (charCode < 0x80) {
        utf8Bytes.push(charCode)
      } else if (charCode < 0x800) {
        utf8Bytes.push(0xc0 | (charCode >> 6))
        utf8Bytes.push(0x80 | (charCode & 0x3f))
      } else if (charCode < 0x10000) {
        utf8Bytes.push(0xe0 | (charCode >> 12))
        utf8Bytes.push(0x80 | ((charCode >> 6) & 0x3f))
        utf8Bytes.push(0x80 | (charCode & 0x3f))
      }
    }

    // Now base64 encode the UTF-8 bytes
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
    let result = ''
    const len = utf8Bytes.length
    
    for (let i = 0; i < len; i += 3) {
      const a = utf8Bytes[i]
      const b = i + 1 < len ? utf8Bytes[i + 1] : 0
      const c = i + 2 < len ? utf8Bytes[i + 2] : 0
      const bitmap = (a << 16) | (b << 8) | c
      
      result += chars.charAt((bitmap >> 18) & 63)
      result += chars.charAt((bitmap >> 12) & 63)
      result += (i + 1 < len) ? chars.charAt((bitmap >> 6) & 63) : '='
      result += (i + 2 < len) ? chars.charAt(bitmap & 63) : '='
    }
    return result
  }

  /**
   * Sign payload using WebAuthn with the provided keyId
   * Uses react-native-passkey library for native WebAuthn support
   */
  private async signPayload(apiCallStructure: {
    body: any
    uri: string
    method: string
    headers?: any
  }, signatureId?: string): Promise<SigningResult> {
    // Declare challenge and rpId at function scope so they're accessible in error handler
    let challenge: string = ''
    let rpId: string = ''
    
    try {
      // Encode the payload the same way web SDK does
      const encodedPayload = this.encodePayload(apiCallStructure)

      // Convert to base64url (no padding) as required by react-native-passkey
      // The issue might be that the passkey was created on web with different settings
      challenge = encodedPayload
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')

      console.log('[ReactNativeSDK]: Using keyId:', this.keyId)
      console.log('[ReactNativeSDK]: Challenge (base64url, no padding), length:', challenge.length)
      console.log('[ReactNativeSDK]: ERROR 16 suggests passkey might not be compatible with cross-platform use')
      console.log('[ReactNativeSDK]: Passkey may need to be recreated natively on mobile')

      rpId = this.getRpId()
      
      // Validate that all required fields are present
      if (!challenge || !rpId) {
        throw new Error(`Missing required fields: challenge=${!!challenge}, rpId=${!!rpId}`)
      }

      // Include allowCredentials with the specific keyId - this ensures the correct passkey is used
      // and prevents userHandle mismatch issues with cross-platform passkeys
      const assertionRequest = {
        challenge: challenge, // base64url (no padding) - WebAuthn standard format
        rpId: rpId, // Must match domain where passkey was registered
        timeout: 60000,
        userVerification: 'required' as const,
        allowCredentials: [{
          type: 'public-key' as const,
          id: this.keyId // Use the stored keyId to specify which credential to use
        }]
      }

      // Validate JSON can be stringified
      let requestJsonString: string
      try {
        requestJsonString = JSON.stringify(assertionRequest)
        if (!requestJsonString || requestJsonString.length === 0) {
          throw new Error('JSON stringification resulted in empty string')
        }
        // Validate it can be parsed back
        JSON.parse(requestJsonString)
      } catch (jsonError: any) {
        console.error('[ReactNativeSDK]: JSON validation failed:', jsonError)
        throw new Error('Invalid request JSON: ' + jsonError.message)
      }

      console.log('[ReactNativeSDK]: ========== PASSKEY AUTHENTICATION REQUEST ==========')
      console.log('[ReactNativeSDK]: Request JSON:', requestJsonString)
      console.log('[ReactNativeSDK]: Challenge (base64url):', challenge)
      console.log('[ReactNativeSDK]: Challenge length:', challenge.length)
      console.log('[ReactNativeSDK]: Challenge first 50 chars:', challenge.substring(0, 50))
      console.log('[ReactNativeSDK]: RpId:', rpId)
      console.log('[ReactNativeSDK]: Expected KeyId:', this.keyId)
      console.log('[ReactNativeSDK]: Timeout:', assertionRequest.timeout)
      console.log('[ReactNativeSDK]: UserVerification:', assertionRequest.userVerification)
      console.log('[ReactNativeSDK]: AllowCredentials:', 'NOT SPECIFIED - letting Android discover')
      console.log('[ReactNativeSDK]: ===================================================')

      // Use react-native-passkey to authenticate
      // The TypeScript types say Passkey.get expects PasskeyGetRequest (object)
      // The JS wrapper internally stringifies it before passing to native
      console.log('[ReactNativeSDK]: About to call Passkey.get...')
      console.log('[ReactNativeSDK]: This will show Android passkey picker with available credentials')
      console.log('[ReactNativeSDK]: 🔍 DEBUG - Expected keyId:', this.keyId)
      console.log('[ReactNativeSDK]: 🔍 DEBUG - Challenge being sent:', challenge.substring(0, 100))
      console.log('[ReactNativeSDK]: 🔍 DEBUG - RpId:', rpId)
      let passkeyResult
      try {
        // Pass as object - the JS wrapper will stringify it internally
        passkeyResult = await Passkey.get(assertionRequest)
        console.log('[ReactNativeSDK]: ✅ Passkey.get succeeded! Got response.')
        console.log('[ReactNativeSDK]: Passkey.get result type:', typeof passkeyResult)
        console.log('[ReactNativeSDK]: Passkey.get result:', JSON.stringify(passkeyResult, null, 2))
      } catch (passkeyError: any) {
        // Log the raw error to get more details
        console.error('[ReactNativeSDK]: ❌ Passkey.get FAILED')
        console.error('[ReactNativeSDK]: Error object:', JSON.stringify(passkeyError, null, 2))
        console.error('[ReactNativeSDK]: Error type:', typeof passkeyError)
        console.error('[ReactNativeSDK]: Error constructor:', passkeyError?.constructor?.name)
        console.error('[ReactNativeSDK]: Error message:', passkeyError?.message)
        console.error('[ReactNativeSDK]: Error code:', passkeyError?.code)
        console.error('[ReactNativeSDK]: Error name:', passkeyError?.name)
        
        // Extract error code from message if present
        const errorMsg = String(passkeyError?.message || '')
        const errorCodeMatch = errorMsg.match(/\[(\d+)\]/)
        if (errorCodeMatch) {
          const errorCode = errorCodeMatch[1]
          console.error('[ReactNativeSDK]: ⚠️  Android Error Code:', errorCode)
          console.error('[ReactNativeSDK]: Error code meanings:')
          console.error('[ReactNativeSDK]:   16 = INVALID_STATE_ERROR - User cancelled or credential validation failed')
          console.error('[ReactNativeSDK]:   Other codes: https://developer.android.com/reference/androidx/credentials/exceptions/GetCredentialException')
        }
        
        throw passkeyError
      }
      
      // Parse the result
      let result: any
      if (typeof passkeyResult === 'string') {
        try {
          result = JSON.parse(passkeyResult)
        } catch (e) {
          // If parsing fails, treat it as an error message
          throw new Error('Failed to parse passkey response: ' + passkeyResult)
        }
      } else {
        result = passkeyResult
      }

      console.log('[ReactNativeSDK]: Parsed result:', JSON.stringify(result, null, 2))

      // Validate that the returned credential ID matches the expected keyId
      const returnedCredentialId = result.id
      if (returnedCredentialId && returnedCredentialId !== this.keyId) {
        console.warn('[ReactNativeSDK]: WARNING - Credential ID mismatch!')
        console.warn('[ReactNativeSDK]: Expected keyId:', this.keyId)
        console.warn('[ReactNativeSDK]: Returned credential ID:', returnedCredentialId)
        console.warn('[ReactNativeSDK]: This means a different passkey was used than expected')
        // Note: We'll proceed anyway and use the returned credential ID
      } else if (returnedCredentialId === this.keyId) {
        console.log('[ReactNativeSDK]: ✅ Credential ID matches expected keyId')
      }

      // Format the signature the same way as the web SDK
      // The web SDK sends the ENTIRE WebAuthn assertion, not just the signature field
      // Structure: { id, rawId, type, response: { authenticatorData, clientDataJSON, signature, userHandle } }
      const signatureData = {
        id: result.id,
        rawId: result.rawId || result.id, // react-native-passkey might not include rawId separately
        type: result.type || 'public-key',
        response: {
          authenticatorData: result.response.authenticatorData,
          clientDataJSON: result.response.clientDataJSON,
          signature: result.response.signature,
          userHandle: result.response.userHandle || null
        }
      }

      // Base64 encode the entire signatureData object (matching web SDK format)
      const signatureJson = JSON.stringify(signatureData)
      console.log('[ReactNativeSDK]: SignatureData JSON length:', signatureJson.length)
      console.log('[ReactNativeSDK]: SignatureData JSON (first 200):', signatureJson.substring(0, 200))
      
      const signature = this.base64Encode(signatureJson)
      console.log('[ReactNativeSDK]: Formatted signature length:', signature.length)
      console.log('[ReactNativeSDK]: Formatted signature (first 100 chars):', signature.substring(0, 100))

      // Use the returned credential ID if available, otherwise fall back to configured keyId
      const actualKeyId = returnedCredentialId || this.keyId

      return {
        signature,
        keyId: actualKeyId,
        signatureId,
      }
    } catch (error: any) {
      // Try to extract maximum error information
      const errorDetails: any = {
        type: typeof error,
        message: error?.message,
        error: error?.error,
        nativeError: error?.nativeError,
        code: error?.code,
        userInfo: error?.userInfo,
        stack: error?.stack
      }
      
      // Try to stringify the entire error object
      try {
        errorDetails.fullErrorString = JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      } catch (e) {
        errorDetails.stringifyError = String(e)
      }
      
      // Log all error details
      console.error('[ReactNativeSDK]: ========== FULL SIGNING ERROR DETAILS ==========')
      console.error('[ReactNativeSDK]: Error details object:', JSON.stringify(errorDetails, null, 2))
      console.error('[ReactNativeSDK]: Error constructor:', error?.constructor?.name)
      console.error('[ReactNativeSDK]: Error prototype keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(error || {})))
      console.error('[ReactNativeSDK]: All error keys:', Object.keys(error || {}))
      console.error('[ReactNativeSDK]: Error toString:', String(error))
      console.error('[ReactNativeSDK]: ==============================================')
      
      // Check if this is error 16
      const errorStr = JSON.stringify(error)
      if (errorStr.includes('[16]') || errorStr.includes('Cancelled by user')) {
        console.error('[ReactNativeSDK]: ERROR 16 DETAILED ANALYSIS:')
        console.error('[ReactNativeSDK]: - This is GetPublicKeyCredentialDomException from Android')
        console.error('[ReactNativeSDK]: - Occurs AFTER biometric succeeds but BEFORE response is returned')
        console.error('[ReactNativeSDK]: - Indicates Android Credential Manager rejected the request')
        console.error('[ReactNativeSDK]: - Common causes: missing allowCredentials, rpId mismatch, invalid challenge format')
        console.error('[ReactNativeSDK]: - Current challenge:', challenge.substring(0, 50) + '...')
        console.error('[ReactNativeSDK]: - Current rpId:', rpId)
        console.error('[ReactNativeSDK]: - Current keyId:', this.keyId)
        console.error('[ReactNativeSDK]: - Verify the keyId exists and matches the registered passkey')
      }
      
      throw new Error('Signing failed: ' + (error.message || 'Unknown error'))
    }
  }

  /**
   * Get Relying Party ID - must match the domain where passkey was registered
   * For dev.ng.truly.you, the rpId should be 'dev.ng.truly.you'
   */
  private getRpId(): string {
    // The rpId must match the domain where the passkey was created
    // Always return 'dev.ng.truly.you' for this application
    // This matches the domain where passkeys are registered via assetlinks.json
    return 'dev.ng.truly.you'
  }

  /**
   * Base64 URL encode
   */
  private base64UrlEncode(buffer: Uint8Array): string {
    return this.base64Encode(String.fromCharCode(...buffer))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  /**
   * Base64 URL decode - React Native compatible
   */
  private base64UrlDecode(str: string): Uint8Array {
    // Add padding if needed
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
    while (base64.length % 4) {
      base64 += '='
    }
    
    // Decode base64 - React Native compatible
    let binaryString: string
    if (typeof atob !== 'undefined') {
      binaryString = atob(base64)
    } else {
      // Fallback polyfill for environments without atob
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
      let result = ''
      let i = 0
      base64 = base64.replace(/[^A-Za-z0-9\+\/\=]/g, '')
      while (i < base64.length) {
        const enc1 = chars.indexOf(base64.charAt(i++))
        const enc2 = chars.indexOf(base64.charAt(i++))
        const enc3 = chars.indexOf(base64.charAt(i++))
        const enc4 = chars.indexOf(base64.charAt(i++))
        const bitmap = (enc1 << 18) | (enc2 << 12) | (enc3 << 6) | enc4
        if (enc3 !== 64) result += String.fromCharCode((bitmap >> 16) & 255)
        if (enc4 !== 64) result += String.fromCharCode((bitmap >> 8) & 255)
        result += String.fromCharCode(bitmap & 255)
      }
      binaryString = result
    }
    
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  }

  /**
   * Fetch with automatic payload signing (same as web SDK)
   */
  async fetchWithSignature(
    url: string,
    options: FetchOptions = {}
  ): Promise<FetchResult> {
    let signatureId: string | undefined = undefined
    try {
      console.log('[ReactNativeSDK]: fetchWithSignature called for:', url)

      // Parse URL to get path and base URL (React Native compatible)
      // React Native doesn't have URL constructor, so we parse manually
      // Match: protocol, host, path (including query string)
      const urlMatch = url.match(/^(https?:)\/\/([^\/\?]+)(\/[^\?]*)?(\?.*)?$/)
      if (!urlMatch) {
        throw new Error('Invalid URL format: ' + url)
      }
      const protocol = urlMatch[1]
      const host = urlMatch[2]
      const pathname = urlMatch[3] || '/'
      const search = urlMatch[4] || ''
      const uriPath = pathname + search  // Include query string, matching web SDK: urlObj.pathname + urlObj.search
      const baseUrl = `${protocol}//${host}`
      
      console.log('[ReactNativeSDK]: Parsed URL - uriPath:', uriPath, 'baseUrl:', baseUrl)

      // Prepare API call structure
      const apiCallStructure = {
        body: options.body ? JSON.parse(options.body) : {},
        uri: uriPath,
        method: (options.method || 'GET').toUpperCase(),
        headers: options.headers || {}
      }

      console.log('[ReactNativeSDK]: API call structure:', apiCallStructure)

      if (!this.authAppId) {
        throw new Error('authAppId is required for signature validation')
      }

      // Generate signatureId
      signatureId = `sig_${Date.now()}_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`

      // Create signature document
      const signatureCreateUrl = `${this.apiUrl}/api/signatures/create`
      console.log('[ReactNativeSDK]: Creating signature document at:', signatureCreateUrl)
      console.log('[ReactNativeSDK]: apiUrl value:', this.apiUrl)
      
      const createPayload = {
        appId: this.authAppId,
        baseUrl,
        endpoint: uriPath,
        method: apiCallStructure.method,
        keyId: this.keyId,
        apiCallStructure,
        signatureId,
        isHandoff: false // React Native is always on-device
      }
      console.log('[ReactNativeSDK]: Create signature payload:', JSON.stringify(createPayload, null, 2))
      
      const createResponse = await fetch(signatureCreateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload)
      })

      console.log('[ReactNativeSDK]: Create signature response status:', createResponse.status)
      console.log('[ReactNativeSDK]: Create signature response ok:', createResponse.ok)

      if (!createResponse.ok) {
        const errorText = await createResponse.text()
        console.log('[ReactNativeSDK]: Create signature error response:', errorText)
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch (e) {
          errorData = { error: errorText || 'Creation request failed' }
        }
        throw new Error('Failed to create signature: ' + (errorData.error || errorData.message || 'Creation request failed'))
      }

      const createData = await createResponse.json()
      if (!createData.success || !createData.data?.signatureId) {
        throw new Error('Failed to create signature document: ' + (createData.error || 'No signatureId returned'))
      }

      console.log('[ReactNativeSDK]: Signature document created with signatureId:', createData.data.signatureId)

      // Sign the payload
      const signingResult = await this.signPayload(apiCallStructure, signatureId)

      // Make the actual API call with signature in header
      // New simplified structure: { signature: base64(WebAuthnAssertion), signatureId }
      // The keyId is extracted from assertion.id on the backend
      const authObject = {
        signature: signingResult.signature,
        signatureId
      }
      
      console.log('[ReactNativeSDK]: Auth object (before encoding):', {
        signatureLength: authObject.signature.length,
        signatureId: authObject.signatureId,
        signaturePreview: authObject.signature.substring(0, 100)
      })
      
      const authObjectJson = JSON.stringify(authObject)
      console.log('[ReactNativeSDK]: Auth object JSON length:', authObjectJson.length)
      console.log('[ReactNativeSDK]: Auth object JSON (first 200):', authObjectJson.substring(0, 200))
      
      const authHeaderValue = this.base64Encode(authObjectJson)
      console.log('[ReactNativeSDK]: Auth header value length:', authHeaderValue.length)
      console.log('[ReactNativeSDK]: Auth header value (first 100):', authHeaderValue.substring(0, 100))

      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'x-truly-auth': authHeaderValue
        }
      })

      console.log('[ReactNativeSDK]: Request complete, status:', response.status)

      return {
        response,
        signature: signingResult.signature,
        signatureId
      }
    } catch (error: any) {
      console.error('[ReactNativeSDK]: fetchWithSignature error:', error)
      throw error
    }
  }
}

