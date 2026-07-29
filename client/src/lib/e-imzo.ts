declare global {
  interface Window {
    CAPIWS: any;
    Base64: any;
    EIMZOClient: any;
  }
}

// API keys for E-IMZO domains
// Each domain needs its own API key from E-IMZO provider
// NOTE: www.yukbozor.uz redirects to yukbozor.uz via nginx, so no separate key needed
const API_KEYS = [
  'localhost', '96D0C1491615C82B9A54D9989779DF825B690748224C2B04F500F370D51827CE2644D8D4A82C18184D73AB8530BB8ED537269603F61DB0D03D2104ABF789970B',
  '127.0.0.1', 'A7BCFA5D490B351BE0754130DF03A068F855DB4333D43921125B9CF2670EF6A40370C646B90401955E1F7BC9CDBF59CE0B2C5467D820BE189C845D0B79CFC96F',
  'yukbozor.uz', '95D6D165C7DD8F5B083803364156BD7F510406808EC2BC2783AA054CBC42CEFE3FAA4994D03EE22AA064666992A54033EE7AC31FE2647A6D1F0A9D7A843099F4'
];

export interface EImzoKey {
  id: string;
  name: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  CN: string;
  TIN: string;
  PINFL: string;
  O: string;
  type: string;
  certType: 'legal' | 'ip' | 'individual'; // Based on certificate data
  disk?: string;
  path?: string;
  alias?: string;
}

export interface EImzoSignResult {
  pkcs7: string;
  pkcs7WithTimestamp?: string;
  signerInfo?: {
    serialNumber: string;
    CN: string;
    TIN: string;
    PINFL: string;
    O: string;
  };
}

class EImzoService {
  private initialized = false;
  private apiKeySet = false;

  // Wait for CAPIWS to be available (e-imzo.js to fully load)
  async waitForCAPIWS(timeoutMs: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const check = () => {
        if (typeof window.CAPIWS !== 'undefined') {
          console.log('E-IMZO: CAPIWS loaded successfully');
          resolve(true);
          return;
        }
        
        if (Date.now() - startTime >= timeoutMs) {
          console.error('E-IMZO: CAPIWS not loaded within timeout');
          resolve(false);
          return;
        }
        
        setTimeout(check, 100);
      };
      
      check();
    });
  }

  // Reset initialization state (needed when domain changes or re-init required)
  reset(): void {
    this.initialized = false;
    this.apiKeySet = false;
    console.log('E-IMZO: State reset');
  }

  async init(): Promise<boolean> {
    // Log current domain for debugging
    const currentDomain = window.location.hostname;
    const currentOrigin = window.location.origin;
    console.log('E-IMZO: Initializing for domain:', currentDomain, 'origin:', currentOrigin);
    
    // Check if we're on www - should have been redirected
    if (currentDomain === 'www.yukbozor.uz') {
      console.error('E-IMZO: Still on www domain - redirect did not work!');
      // Force redirect
      window.location.replace('https://yukbozor.uz' + window.location.pathname + window.location.search);
      return false;
    }
    
    // First, wait for CAPIWS to be available
    const capiLoaded = await this.waitForCAPIWS();
    if (!capiLoaded) {
      console.error('E-IMZO: CAPIWS not loaded - убедитесь, что E-IMZO.exe запущен');
      return false;
    }
    
    // If already initialized successfully, return true
    if (this.initialized && this.apiKeySet) {
      console.log('E-IMZO: Already initialized');
      return true;
    }
    
    return new Promise((resolve) => {
      console.log('E-IMZO: Calling CAPIWS.apikey with', API_KEYS.length / 2, 'domain keys');
      window.CAPIWS.apikey(API_KEYS, 
        (event: any, data: any) => {
          if (data.success) {
            this.apiKeySet = true;
            this.initialized = true;
            console.log('E-IMZO: API key set successfully for domain:', currentDomain);
            resolve(true);
          } else {
            // Reset state on failure so next attempt can retry
            this.initialized = false;
            this.apiKeySet = false;
            console.error('E-IMZO: API key error for domain', currentDomain, ':', data.reason);
            resolve(false);
          }
        },
        (error: any) => {
          // Reset state on failure
          this.initialized = false;
          this.apiKeySet = false;
          console.error('E-IMZO: WebSocket error - убедитесь, что E-IMZO.exe запущен:', error);
          resolve(false);
        }
      );
    });
  }

  async checkVersion(): Promise<{ major: number; minor: number } | null> {
    return new Promise((resolve) => {
      if (typeof window.CAPIWS === 'undefined') {
        resolve(null);
        return;
      }

      window.CAPIWS.version(
        (event: any, data: any) => {
          if (data.success) {
            resolve({ major: parseInt(data.major), minor: parseInt(data.minor) });
          } else {
            resolve(null);
          }
        },
        (error: any) => {
          resolve(null);
        }
      );
    });
  }

  async listKeys(): Promise<EImzoKey[]> {
    await this.init();
    
    return new Promise((resolve, reject) => {
      if (typeof window.CAPIWS === 'undefined') {
        reject(new Error('E-IMZO не установлен'));
        return;
      }

      window.CAPIWS.callFunction(
        { plugin: 'pfx', name: 'list_all_certificates' },
        (event: any, data: any) => {
          if (data.success) {
            const keys: EImzoKey[] = (data.certificates || []).map((cert: any, index: number) => {
              // Debug: log full certificate object to see available fields
              console.log(`E-IMZO: Raw cert ${index} data:`, JSON.stringify(cert, null, 2));
              
              // E-IMZO returns data in 'alias' field, not 'subjectName'
              const subjectName = cert.alias || cert.subjectName || cert.subjectDN || cert.subject || '';
              
              // Helper to capitalize names properly (e.g., "normatov rustam" -> "Normatov Rustam")
              const capitalize = (str: string): string => {
                if (!str) return '';
                return str.split(' ').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                ).join(' ');
              };
              
              const rawCN = this.getX500Val(subjectName, 'cn') || cert.CN || cert.commonName || '';
              const CN = capitalize(rawCN);
              
              // CORRECT OID mapping:
              // 1.2.860.3.16.1.1 = Company TIN/INN (СТИР) - only for legal entities
              // 1.2.860.3.16.1.2 = PINFL (ПИНФЛ) - personal ID
              // Also check UID field which sometimes contains TIN
              const TIN = this.getX500Val(subjectName, '1.2.860.3.16.1.1') ||
                         this.getX500Val(subjectName, 'uid') ||
                         this.getX500Val(subjectName, 'UID') ||
                         this.getX500Val(subjectName, 'inn') ||
                         this.getX500Val(subjectName, 'INN') ||
                         this.getX500Val(subjectName, 'tin') ||
                         this.getX500Val(subjectName, 'TIN') ||
                         cert.TIN || cert.tin || cert.UID || cert.uid || '';
              const PINFL = this.getX500Val(subjectName, '1.2.860.3.16.1.2') || 
                           this.getX500Val(subjectName, 'pinfl') ||
                           this.getX500Val(subjectName, 'PINFL') ||
                           cert.PINFL || cert.pinfl || '';
              
              const rawO = this.getX500Val(subjectName, 'o') || cert.O || cert.organization || '';
              const O = rawO.toUpperCase(); // Organization names in uppercase
              
              // Determine certificate type based on O field content and TIN presence
              // IP certificates have O field containing "ЯККА ТАРТИБДАГИ ТАДБИРКОР" (Uzbek) or similar IP indicators
              // Legal entity certificates have company name in O field and company TIN
              // Individual certificates have no O field
              const isIP = rawO && (
                rawO.toUpperCase().includes('ЯККА ТАРТИБДАГИ ТАДБИРКОР') ||
                rawO.toUpperCase().includes('YAKKA TARTIBDAGI') ||
                rawO.toUpperCase().includes('ИП') ||
                rawO.toUpperCase().includes('INDIVIDUAL ENTREPRENEUR') ||
                rawO.toUpperCase().includes('ЯТТ')
              );
              
              let certType: 'legal' | 'ip' | 'individual';
              if (isIP) {
                certType = 'ip';
              } else if (TIN && rawO) {
                // Has company TIN and organization name (not IP indicator) = legal entity
                certType = 'legal';
              } else if (rawO) {
                // Has organization but no TIN - could be IP with different format
                certType = 'ip';
              } else {
                // No organization field = individual
                certType = 'individual';
              }
              
              console.log(`E-IMZO: Cert ${index} - CN: ${CN}, O: ${O}, TIN: ${TIN}, PINFL: ${PINFL}, type: ${certType}`);
              
              // Extract validfrom and validto from alias string (format: validfrom=2024.05.07 16:21:38)
              const validFromRaw = this.getX500Val(subjectName, 'validfrom') || cert.validFrom || '';
              const validToRaw = this.getX500Val(subjectName, 'validto') || cert.validTo || '';
              
              console.log(`E-IMZO: Cert ${index} dates - validFrom: ${validFromRaw}, validTo: ${validToRaw}`);
              
              return {
                id: `pfx_${index}`,
                name: cert.name || 'Unknown',
                serialNumber: cert.serialNumber || this.getX500Val(subjectName, 'serialnumber') || '',
                validFrom: validFromRaw,
                validTo: validToRaw,
                CN,
                TIN,
                PINFL,
                O,
                type: 'pfx',
                certType: certType as 'legal' | 'ip' | 'individual',
                disk: cert.disk,
                path: cert.path,
                alias: cert.alias
              };
            });
            resolve(keys);
          } else {
            reject(new Error(data.reason || 'Не удалось получить список ключей'));
          }
        },
        (error: any) => {
          reject(new Error('Ошибка соединения с E-IMZO'));
        }
      );
    });
  }

  async loadKey(key: EImzoKey): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof window.CAPIWS === 'undefined') {
        reject(new Error('E-IMZO не установлен'));
        return;
      }

      window.CAPIWS.callFunction(
        { 
          plugin: 'pfx', 
          name: 'load_key', 
          arguments: [key.disk, key.path, key.name, key.alias] 
        },
        (event: any, data: any) => {
          if (data.success) {
            resolve(data.keyId);
          } else {
            reject(new Error(data.reason || 'Не удалось загрузить ключ'));
          }
        },
        (error: any) => {
          reject(new Error('Ошибка соединения с E-IMZO'));
        }
      );
    });
  }

  async createPkcs7(keyId: string, document: string, detached = false): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof window.CAPIWS === 'undefined') {
        reject(new Error('E-IMZO не установлен'));
        return;
      }

      const data64 = window.Base64 ? window.Base64.encode(document) : btoa(unescape(encodeURIComponent(document)));
      
      window.CAPIWS.callFunction(
        {
          plugin: 'pkcs7',
          name: 'create_pkcs7',
          arguments: [data64, keyId, detached ? 'yes' : 'no']
        },
        (event: any, data: any) => {
          if (data.success) {
            resolve(data.pkcs7_64);
          } else {
            reject(new Error(data.reason || 'Не удалось создать подпись'));
          }
        },
        (error: any) => {
          reject(new Error('Ошибка соединения с E-IMZO'));
        }
      );
    });
  }

  // Create PKCS7 signature and add timestamp via E-IMZO server
  // This is the required flow for signing documents that need legal validity
  // CRITICAL: Timestamp is mandatory for legal compliance - throws on failure
  async createPkcs7WithTimestamp(keyId: string, document: string): Promise<string> {
    console.log('[E-IMZO] Creating PKCS7 with timestamp (required for legal validity)...');
    
    // Step 1: Create PKCS7 locally
    const pkcs7 = await this.createPkcs7(keyId, document, false);
    console.log('[E-IMZO] PKCS7 created, length:', pkcs7.length);
    
    // Step 2: Send to our backend which will add timestamp via E-IMZO server
    // Timestamp is MANDATORY - failure should block submission
    const response = await fetch('/api/eimzo/timestamp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pkcs7 })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[E-IMZO] Timestamp failed - cannot proceed:', errorData);
      throw new Error(errorData.error || 'Не удалось добавить метку времени к подписи. Попробуйте позже.');
    }
    
    const data = await response.json();
    
    if (!data.pkcs7WithTimestamp) {
      console.error('[E-IMZO] No timestamped PKCS7 returned');
      throw new Error('E-IMZO сервер не вернул подпись с меткой времени');
    }
    
    console.log('[E-IMZO] Timestamp added successfully, new length:', data.pkcs7WithTimestamp.length);
    return data.pkcs7WithTimestamp;
  }

  private getX500Val(s: string, f: string): string {
    if (!s) return '';
    const parts = s.split(',');
    for (const part of parts) {
      const kv = part.trim().split('=');
      if (kv.length === 2 && kv[0].trim() === f) {
        return kv[1].trim();
      }
    }
    return '';
  }

  isInstalled(): boolean {
    return typeof window.CAPIWS !== 'undefined';
  }

  // Async version - waits for CAPIWS to potentially load
  async isInstalledAsync(timeoutMs: number = 3000): Promise<boolean> {
    const loaded = await this.waitForCAPIWS(timeoutMs);
    return loaded;
  }
}

export const eimzoService = new EImzoService();
