import axios from 'axios';

const EIMZO_SERVER_URL = process.env.EIMZO_SERVER_URL || 'http://localhost:8080';

export interface EImzoVerifyResult {
  success: boolean;
  status?: number;
  pkcs7WithTimestamp?: string;  // For contract signing - returns the signature with timestamp
  pkcs7Info?: {
    signers: Array<{
      serialNumber: string;
      subjectName: string;
      signTime: string;
      certificate: {
        validFrom: string;
        validTo: string;
        CN: string;
        O: string;
        TIN: string;
        PINFL: string;
      };
    }>;
    document?: string;
    documentBase64?: string;
  };
  error?: string;
}

export interface EImzoTimestampResult {
  success: boolean;
  pkcs7WithTimestamp?: string;
  error?: string;
}

export class EImzoService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || EIMZO_SERVER_URL;
  }

  /**
   * Sanitize base64 string - remove ALL characters that are not valid base64
   * This handles hidden UTF-8 BOM, zero-width chars, etc.
   */
  private sanitizeBase64(input: string): { sanitized: string; invalidChars: string[] } {
    if (!input) return { sanitized: '', invalidChars: [] };
    
    const invalidChars: string[] = [];
    const validBase64Chars = /^[A-Za-z0-9+/=]$/;
    
    let sanitized = '';
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      if (validBase64Chars.test(char)) {
        sanitized += char;
      } else {
        invalidChars.push(`char[${i}]='${char}' code=${char.charCodeAt(0)}`);
      }
    }
    
    return { sanitized, invalidChars };
  }

  /**
   * Validate and re-encode base64 to ensure canonical form
   */
  private validateAndReencodeBase64(input: string): { valid: boolean; canonical?: string; error?: string } {
    try {
      const buffer = Buffer.from(input, 'base64');
      if (buffer.length === 0 && input.length > 0) {
        return { valid: false, error: 'Decoded to empty buffer' };
      }
      const canonical = buffer.toString('base64');
      return { valid: true, canonical };
    } catch (e: any) {
      return { valid: false, error: e.message };
    }
  }

  async ping(): Promise<{ success: boolean; vpnKeyInfo?: any; error?: string }> {
    try {
      const response = await axios.get(`${this.baseUrl}/ping`, { timeout: 5000 });
      return { success: true, vpnKeyInfo: response.data.vpnKeyInfo };
    } catch (error: any) {
      console.error('[E-IMZO] Ping failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async getChallenge(): Promise<{ success: boolean; challenge?: string; error?: string }> {
    try {
      console.log('[E-IMZO] Getting challenge from:', `${this.baseUrl}/frontend/challenge`);
      // E-IMZO server requires GET method for /frontend/challenge endpoint
      const response = await axios.get(`${this.baseUrl}/frontend/challenge`, { 
        timeout: 10000
      });
      console.log('[E-IMZO] Challenge response status:', response.status);
      if (response.data && response.data.challenge) {
        return { success: true, challenge: response.data.challenge };
      }
      console.error('[E-IMZO] No challenge in response:', response.data);
      return { success: false, error: 'No challenge received' };
    } catch (error: any) {
      console.error('[E-IMZO] Get challenge failed:', error.message);
      if (error.response) {
        console.error('[E-IMZO] Challenge error status:', error.response.status);
        console.error('[E-IMZO] Challenge error data:', error.response.data);
      }
      return { success: false, error: `E-IMZO server error: ${error.message}` };
    }
  }

  async verifyAuth(pkcs7: string, clientIp?: string): Promise<EImzoVerifyResult> {
    try {
      // Strict base64 sanitization - remove ALL non-base64 characters
      const { sanitized, invalidChars } = this.sanitizeBase64(pkcs7);
      
      console.log('[E-IMZO] Auth verification, original length:', pkcs7?.length, ', sanitized length:', sanitized?.length);
      console.log('[E-IMZO] First 100 chars of sanitized:', sanitized?.substring(0, 100));
      console.log('[E-IMZO] Last 50 chars of sanitized:', sanitized?.substring(sanitized.length - 50));
      
      if (invalidChars.length > 0) {
        console.log('[E-IMZO] Removed invalid characters:', invalidChars.slice(0, 20).join(', '), invalidChars.length > 20 ? `... and ${invalidChars.length - 20} more` : '');
      }
      
      // Validate base64 can be decoded (but don't re-encode - keep original)
      try {
        const buffer = Buffer.from(sanitized, 'base64');
        console.log('[E-IMZO] Base64 decoded successfully, binary length:', buffer.length);
      } catch (e: any) {
        console.error('[E-IMZO] Base64 decode failed locally:', e.message);
        return { success: false, error: `Invalid base64: ${e.message}` };
      }
      
      console.log('[E-IMZO] Auth verifying at:', `${this.baseUrl}/backend/auth`, 'clientIp:', clientIp);
      
      // E-IMZO expects raw base64 string as body, NOT JSON
      // Note: Removed hardcoded Host header - E-IMZO server uses API-KEY for domain validation
      const headers: Record<string, string> = { 
        'Content-Type': 'text/plain'
      };
      if (clientIp) {
        headers['X-Real-IP'] = clientIp;
      }
      
      console.log('[E-IMZO] Request body length:', sanitized.length);
      
      const response = await axios.post(
        `${this.baseUrl}/backend/auth`,
        sanitized,  // Raw base64 string, not JSON
        { 
          timeout: 30000,
          headers
        }
      );
      
      console.log('[E-IMZO] Auth verification response status:', response.data.status);
      // Log structure keys only (no PII)
      console.log('[E-IMZO] Response keys:', Object.keys(response.data || {}));
      
      if (response.data.status === 1) {
        // E-IMZO server returns subjectCertificateInfo for /backend/auth
        // Documentation shows format: {status, subjectCertificateInfo: {signerCertificateInfo: [...]}}
        const certInfo = response.data.subjectCertificateInfo || response.data.pkcs7Info;
        console.log('[E-IMZO] Certificate info keys:', certInfo ? Object.keys(certInfo) : 'null');
        return {
          success: true,
          status: response.data.status,
          pkcs7Info: certInfo
        };
      }
      
      return { 
        success: false, 
        status: response.data.status,
        error: response.data.message || 'Verification failed' 
      };
    } catch (error: any) {
      console.error('[E-IMZO] Auth verification failed:', error.message);
      if (error.response) {
        console.error('[E-IMZO] Auth response status:', error.response.status);
        console.error('[E-IMZO] Auth response data:', error.response.data);
      }
      return { success: false, error: error.message };
    }
  }

  async addTimestamp(pkcs7: string): Promise<EImzoTimestampResult> {
    try {
      // E-IMZO expects raw base64 string as body, NOT JSON
      // Note: Removed hardcoded Host header - E-IMZO server uses API-KEY for domain validation
      const response = await axios.post(
        `${this.baseUrl}/frontend/timestamp/pkcs7`,
        pkcs7,  // Raw base64 string
        { 
          timeout: 30000,
          headers: { 
            'Content-Type': 'text/plain',
            'X-Real-IP': '127.0.0.1'  // Local server-to-server call
          }
        }
      );
      
      // Response contains pkcs7b64 field
      if (response.data.pkcs7b64) {
        return { success: true, pkcs7WithTimestamp: response.data.pkcs7b64 };
      }
      
      return { success: false, error: response.data.message || 'Timestamp failed' };
    } catch (error: any) {
      console.error('[E-IMZO] Timestamp failed:', error.message);
      if (error.response) {
        console.error('[E-IMZO] Timestamp response:', error.response.status, error.response.data);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify a signature with attached document using /backend/pkcs7/verify/attached.
   * This is suitable for profile updates and other non-contract signatures where
   * the signed document is larger than 128 bytes.
   * 
   * Note: /backend/auth only supports documents up to 128 bytes (for challenge verification).
   * Note: /backend/pkcs7/verify/attached REQUIRES timestamp, so we add it first via /backend/pkcs7/join
   */
  async verifySignature(pkcs7: string, clientIp?: string): Promise<EImzoVerifyResult> {
    try {
      // Strict base64 sanitization - remove ALL non-base64 characters
      const { sanitized, invalidChars } = this.sanitizeBase64(pkcs7);
      
      console.log('[E-IMZO] Verifying signature via /backend/pkcs7/verify/attached, original length:', pkcs7?.length, ', sanitized length:', sanitized?.length);
      console.log('[E-IMZO] First 100 chars of sanitized:', sanitized?.substring(0, 100));
      
      if (invalidChars.length > 0) {
        console.log('[E-IMZO] Removed invalid characters:', invalidChars.slice(0, 20).join(', '), invalidChars.length > 20 ? `... and ${invalidChars.length - 20} more` : '');
      }
      
      // Validate base64 can be decoded locally first
      try {
        const buffer = Buffer.from(sanitized, 'base64');
        console.log('[E-IMZO] Base64 decoded successfully, binary length:', buffer.length);
      } catch (e: any) {
        console.error('[E-IMZO] Base64 decode failed locally:', e.message);
        return { success: false, error: `Invalid base64: ${e.message}` };
      }
      
      // Step 1: Add timestamp to the signature (required by /backend/pkcs7/verify/attached)
      console.log('[E-IMZO] Adding timestamp to signature...');
      const timestampResult = await this.addTimestamp(sanitized);
      
      if (!timestampResult.success || !timestampResult.pkcs7WithTimestamp) {
        console.error('[E-IMZO] Failed to add timestamp:', timestampResult.error);
        return { success: false, error: `Timestamp failed: ${timestampResult.error}` };
      }
      
      console.log('[E-IMZO] Timestamp added successfully, new length:', timestampResult.pkcs7WithTimestamp.length);
      const pkcs7WithTimestamp = timestampResult.pkcs7WithTimestamp;
      
      // Step 2: Verify signature with timestamp
      console.log('[E-IMZO] Verifying at:', `${this.baseUrl}/backend/pkcs7/verify/attached`);
      
      // Build headers
      const headers: Record<string, string> = { 
        'Content-Type': 'text/plain'
      };
      if (clientIp) {
        headers['X-Real-IP'] = clientIp;
      }
      
      const response = await axios.post(
        `${this.baseUrl}/backend/pkcs7/verify/attached`,
        pkcs7WithTimestamp,  // Signature WITH timestamp
        { 
          timeout: 30000,
          headers
        }
      );
      
      console.log('[E-IMZO] Verification response status:', response.data.status);
      console.log('[E-IMZO] Verification response:', JSON.stringify(response.data).substring(0, 500));
      
      if (response.data.status === 1) {
        return {
          success: true,
          status: response.data.status,
          pkcs7WithTimestamp,  // Return signature with timestamp
          pkcs7Info: response.data.pkcs7Info || response.data.subjectCertificateInfo
        };
      }
      
      return { 
        success: false, 
        status: response.data.status,
        error: response.data.message || 'Signature verification failed' 
      };
    } catch (error: any) {
      console.error('[E-IMZO] Signature verification failed:', error.message);
      if (error.response) {
        console.error('[E-IMZO] Response status:', error.response.status);
        console.error('[E-IMZO] Response data:', error.response.data);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify a signature WITH timestamp using /backend/pkcs7/verify/attached.
   * This is required for contracts that need legal timestamps.
   * For profile updates, use verifySignature() instead.
   */
  async verifySignatureWithTimestamp(pkcs7: string): Promise<EImzoVerifyResult> {
    try {
      // Strict base64 sanitization
      const { sanitized, invalidChars } = this.sanitizeBase64(pkcs7);
      
      console.log('[E-IMZO] Verifying signature with timestamp, original length:', pkcs7?.length, ', sanitized length:', sanitized?.length);
      
      if (invalidChars.length > 0) {
        console.log('[E-IMZO] Removed invalid characters:', invalidChars.slice(0, 20).join(', '));
      }
      
      // Validate base64 locally
      try {
        const buffer = Buffer.from(sanitized, 'base64');
        console.log('[E-IMZO] Base64 decoded successfully, binary length:', buffer.length);
      } catch (e: any) {
        console.error('[E-IMZO] Base64 decode failed locally:', e.message);
        return { success: false, error: `Invalid base64: ${e.message}` };
      }
      
      // Step 1: Add timestamp to the signature
      console.log('[E-IMZO] Adding timestamp to signature...');
      const timestampResult = await this.addTimestamp(sanitized);
      
      if (!timestampResult.success || !timestampResult.pkcs7WithTimestamp) {
        console.error('[E-IMZO] Failed to add timestamp:', timestampResult.error);
        return { success: false, error: `Timestamp failed: ${timestampResult.error}` };
      }
      
      console.log('[E-IMZO] Timestamp added successfully');
      const pkcs7WithTimestamp = timestampResult.pkcs7WithTimestamp;
      
      // Step 2: Verify with timestamp
      console.log('[E-IMZO] Verifying at:', `${this.baseUrl}/backend/pkcs7/verify/attached`);
      
      // Note: Removed hardcoded Host header - E-IMZO server uses API-KEY for domain validation
      const response = await axios.post(
        `${this.baseUrl}/backend/pkcs7/verify/attached`,
        pkcs7WithTimestamp,
        { 
          timeout: 30000,
          headers: { 
            'Content-Type': 'text/plain',
            'X-Real-IP': '127.0.0.1'  // Local server-to-server call
          }
        }
      );
      
      console.log('[E-IMZO] Verification response status:', response.data.status);
      
      if (response.data.status === 1) {
        return {
          success: true,
          status: response.data.status,
          pkcs7WithTimestamp,  // Return the signature with timestamp for storage
          pkcs7Info: response.data.pkcs7Info
        };
      }
      
      return { 
        success: false, 
        status: response.data.status,
        error: response.data.message || 'Signature verification failed' 
      };
    } catch (error: any) {
      console.error('[E-IMZO] Signature verification with timestamp failed:', error.message);
      if (error.response) {
        console.error('[E-IMZO] Response status:', error.response.status);
        console.error('[E-IMZO] Response data:', error.response.data);
      }
      return { success: false, error: error.message };
    }
  }

  extractSignerInfo(pkcs7Info: any): {
    serialNumber: string;
    CN: string;
    O: string;
    TIN: string;
    PINFL: string;
    signTime: string;
  } | null {
    // Handle multiple E-IMZO response formats:
    // 1. /backend/auth: {subjectCertificateInfo: {signerCertificateInfo: [{...}]}}
    // 2. /backend/auth alt: {subjectCertificateInfo: {CN, TIN, PINFL, ...}}
    // 3. /backend/pkcs7/verify/attached: {pkcs7Info: {signers: [{...}]}}
    if (!pkcs7Info) {
      console.log('[E-IMZO] extractSignerInfo: null input');
      return null;
    }
    
    console.log('[E-IMZO] extractSignerInfo: available keys:', Object.keys(pkcs7Info));
    
    // Format 1: signerCertificateInfo array (documented format for /backend/auth)
    if (pkcs7Info.signerCertificateInfo && Array.isArray(pkcs7Info.signerCertificateInfo) && pkcs7Info.signerCertificateInfo.length > 0) {
      console.log('[E-IMZO] Extracting from signerCertificateInfo array format');
      const signer = pkcs7Info.signerCertificateInfo[0];
      const subjectName = signer.subjectName || '';
      return {
        serialNumber: signer.serialNumber || '',
        CN: signer.CN || this.getX500Val(subjectName, 'CN'),
        O: signer.O || this.getX500Val(subjectName, 'O'),
        // CORRECT OID mapping per E-IMZO documentation:
        // 1.2.860.3.16.1.1 = Company TIN/INN (СТИР) - for legal entities
        // 1.2.860.3.16.1.2 = PINFL (ПИНФЛ) - personal ID
        TIN: signer.TIN || this.getX500Val(subjectName, '1.2.860.3.16.1.1') || this.getX500Val(subjectName, 'UID'),
        PINFL: signer.PINFL || this.getX500Val(subjectName, '1.2.860.3.16.1.2'),
        signTime: signer.signTime || ''
      };
    }
    
    // Format 2: Direct fields in subjectCertificateInfo (alternative format)
    // E-IMZO returns: {serialNumber, X500Name, subjectName, validFrom, validTo}
    // subjectName or X500Name can be object or string
    if (pkcs7Info.subjectName || pkcs7Info.X500Name || pkcs7Info.CN) {
      console.log('[E-IMZO] Extracting from direct subjectCertificateInfo format');
      // Try subjectName first, fallback to X500Name
      const subjectName = pkcs7Info.subjectName || pkcs7Info.X500Name || '';
      console.log('[E-IMZO] subjectName type:', typeof subjectName);
      if (typeof subjectName === 'object') {
        console.log('[E-IMZO] subjectName keys:', Object.keys(subjectName));
      }
      
      return {
        serialNumber: pkcs7Info.serialNumber || '',
        CN: pkcs7Info.CN || this.getX500Val(subjectName, 'CN'),
        O: pkcs7Info.O || this.getX500Val(subjectName, 'O'),
        // CORRECT OID mapping per E-IMZO documentation:
        // 1.2.860.3.16.1.1 = Company TIN/INN (СТИР) - for legal entities
        // 1.2.860.3.16.1.2 = PINFL (ПИНФЛ) - personal ID
        TIN: pkcs7Info.TIN || this.getX500Val(subjectName, '1.2.860.3.16.1.1') || this.getX500Val(subjectName, 'UID'),
        PINFL: pkcs7Info.PINFL || this.getX500Val(subjectName, '1.2.860.3.16.1.2'),
        signTime: pkcs7Info.signTime || ''
      };
    }
    
    // Format 3: signers array (for /backend/pkcs7/verify/attached)
    if (pkcs7Info.signers && Array.isArray(pkcs7Info.signers) && pkcs7Info.signers.length > 0) {
      console.log('[E-IMZO] Extracting from pkcs7Info.signers format');
      const signer = pkcs7Info.signers[0];
      const subjectName = signer.subjectName || signer.certificate?.subjectName || '';
      return {
        serialNumber: signer.serialNumber || '',
        CN: this.getX500Val(subjectName, 'CN'),
        O: this.getX500Val(subjectName, 'O'),
        // CORRECT OID mapping per E-IMZO documentation:
        // 1.2.860.3.16.1.1 = Company TIN/INN (СТИР) - for legal entities
        // 1.2.860.3.16.1.2 = PINFL (ПИНФЛ) - personal ID
        TIN: this.getX500Val(subjectName, '1.2.860.3.16.1.1') || this.getX500Val(subjectName, 'UID'),
        PINFL: this.getX500Val(subjectName, '1.2.860.3.16.1.2'),
        signTime: signer.signTime || ''
      };
    }
    
    console.log('[E-IMZO] extractSignerInfo: no matching format found');
    return null;
  }

  private getX500Val(s: string | Record<string, any>, f: string): string {
    if (!s) return '';
    
    // If s is an object, try to get the field directly
    if (typeof s === 'object') {
      // Direct field access (e.g., s.CN, s.O)
      if (s[f] !== undefined) {
        return String(s[f]);
      }
      // For OID fields like 1.2.860.3.16.1.1, they might be stored differently
      // Try common aliases
      if (f === '1.2.860.3.16.1.1') {
        return String(s['1.2.860.3.16.1.1'] || s['UID'] || s['TIN'] || s['INN'] || '');
      }
      if (f === '1.2.860.3.16.1.2') {
        return String(s['1.2.860.3.16.1.2'] || s['PINFL'] || '');
      }
      return '';
    }
    
    // If s is a string, parse it as X500 DN
    if (typeof s !== 'string') return '';
    
    const parts = s.split(',');
    for (const part of parts) {
      const kv = part.trim().split('=');
      if (kv.length === 2 && kv[0].trim() === f) {
        return kv[1].trim();
      }
    }
    return '';
  }
}

export const eimzoService = new EImzoService();
