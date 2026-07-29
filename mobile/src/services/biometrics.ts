import * as LocalAuthentication from 'expo-local-authentication';

export interface BiometricStatus {
  isAvailable: boolean;
  biometricType: 'fingerprint' | 'facial' | 'iris' | 'none';
  isEnrolled: boolean;
}

export const biometrics = {
  async checkAvailability(): Promise<BiometricStatus> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      let biometricType: BiometricStatus['biometricType'] = 'none';
      
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometricType = 'facial';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometricType = 'fingerprint';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        biometricType = 'iris';
      }
      
      return {
        isAvailable: hasHardware && isEnrolled,
        biometricType,
        isEnrolled,
      };
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return {
        isAvailable: false,
        biometricType: 'none',
        isEnrolled: false,
      };
    }
  },

  async authenticate(promptMessage: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: '',
        disableDeviceFallback: true,
      });
      
      if (result.success) {
        return { success: true };
      }
      
      return { 
        success: false, 
        error: result.error || 'Authentication failed' 
      };
    } catch (error: any) {
      console.error('Biometric authentication error:', error);
      return { 
        success: false, 
        error: error.message || 'Authentication error' 
      };
    }
  },

  getBiometricLabel(type: BiometricStatus['biometricType'], language: 'ru' | 'uz'): string {
    const labels = {
      fingerprint: { ru: 'Отпечаток пальца', uz: 'Barmoq izi' },
      facial: { ru: 'Face ID', uz: 'Face ID' },
      iris: { ru: 'Сканер радужки', uz: 'Ko\'z qarag\'i skaneri' },
      none: { ru: 'Биометрия', uz: 'Biometriya' },
    };
    return labels[type][language];
  },
};
