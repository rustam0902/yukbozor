import { View, Text, StyleSheet, TouchableOpacity, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { secureStorage } from '../services/secureStorage';
import { biometrics, BiometricStatus } from '../services/biometrics';

interface PinLoginScreenProps {
  navigation: any;
  route: any;
}

export function PinLoginScreen({ navigation, route }: PinLoginScreenProps) {
  const { language } = useLanguage();
  const colors = Colors.light;
  
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  
  const onSuccess = route.params?.onSuccess;
  const onLogout = route.params?.onLogout;

  const handleBiometricAuth = useCallback(async () => {
    if (!biometricStatus?.isAvailable || !biometricsEnabled) return;
    
    const biometricLabel = biometrics.getBiometricLabel(biometricStatus.biometricType, language);
    const promptMessage = language === 'ru' 
      ? `Войти с помощью ${biometricLabel}`
      : `${biometricLabel} yordamida kirish`;
    
    const result = await biometrics.authenticate(promptMessage);
    
    if (result.success) {
      completeLogin();
    }
  }, [biometricStatus, biometricsEnabled, language]);

  // Step 1: load biometric state from storage
  useEffect(() => {
    const loadBiometricState = async () => {
      const status = await biometrics.checkAvailability();
      setBiometricStatus(status);
      const enabled = await secureStorage.isBiometricsEnabled();
      setBiometricsEnabled(enabled);
    };
    loadBiometricState();
  }, []);

  // Step 2: auto-trigger biometrics once state is ready — fires after state updates
  useEffect(() => {
    if (biometricStatus?.isAvailable && biometricsEnabled) {
      const timer = setTimeout(handleBiometricAuth, 400);
      return () => clearTimeout(timer);
    }
  }, [biometricStatus, biometricsEnabled, handleBiometricAuth]);

  const handleNumberPress = (num: string) => {
    setError('');
    
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      
      if (newPin.length === 4) {
        setTimeout(() => {
          verifyPin(newPin);
        }, 200);
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
    setError('');
  };

  const verifyPin = async (enteredPin: string) => {
    const isValid = await secureStorage.verifyPin(enteredPin);
    
    if (isValid) {
      completeLogin();
    } else {
      Vibration.vibrate(200);
      setAttempts(prev => prev + 1);
      setPin('');
      
      if (attempts >= 4) {
        setError(language === 'ru' 
          ? 'Слишком много попыток. Войдите с паролем.' 
          : 'Juda ko\'p urinish. Parol bilan kiring.');
      } else {
        setError(language === 'ru' ? 'Неверный PIN-код' : 'Noto\'g\'ri PIN-kod');
      }
    }
  };

  const completeLogin = () => {
    if (onSuccess) {
      onSuccess();
    }
  };

  const handleLogout = async () => {
    await secureStorage.clearSession();
    if (onLogout) {
      onLogout();
    }
  };

  const renderPinDots = () => {
    return (
      <View style={styles.dotsContainer}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i < pin.length ? colors.primary : 'transparent',
                borderColor: colors.primary,
              }
            ]}
          />
        ))}
      </View>
    );
  };

  const renderNumberPad = () => {
    const showBiometric = biometricStatus?.isAvailable && biometricsEnabled;
    
    const numbers = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      [showBiometric ? 'bio' : '', '0', 'del'],
    ];

    return (
      <View style={styles.numberPad}>
        {numbers.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.numberRow}>
            {row.map((num, numIndex) => {
              if (num === '') {
                return <View key={numIndex} style={styles.numberButtonPlaceholder} />;
              }
              
              if (num === 'del') {
                return (
                  <TouchableOpacity
                    key={numIndex}
                    style={styles.numberButton}
                    onPress={handleDelete}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.deleteText, { color: colors.foreground }]}>⌫</Text>
                  </TouchableOpacity>
                );
              }
              
              if (num === 'bio') {
                const bioIconName = biometricStatus?.biometricType === 'facial'
                  ? 'scan-circle-outline'
                  : biometricStatus?.biometricType === 'iris'
                  ? 'eye-outline'
                  : 'finger-print';
                return (
                  <TouchableOpacity
                    key={numIndex}
                    style={[styles.numberButton, { borderColor: 'transparent', backgroundColor: 'transparent' }]}
                    onPress={handleBiometricAuth}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={bioIconName as any} size={36} color={colors.primary} />
                  </TouchableOpacity>
                );
              }
              
              return (
                <TouchableOpacity
                  key={numIndex}
                  style={[styles.numberButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleNumberPress(num)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.numberText, { color: colors.foreground }]}>{num}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.logo, { color: colors.primary }]}>Yukbozor</Text>
        
        <Text style={[styles.title, { color: colors.foreground }]}>
          {language === 'ru' ? 'Введите PIN-код' : 'PIN-kodni kiriting'}
        </Text>
        
        {renderPinDots()}
        
        {error ? (
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            {error}
          </Text>
        ) : null}
        
        {renderNumberPad()}
        
        {attempts >= 5 && (
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={[styles.logoutText, { color: colors.primary }]}>
              {language === 'ru' ? 'Войти с паролем' : 'Parol bilan kirish'}
            </Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={[styles.logoutText, { color: colors.mutedForeground }]}>
            {language === 'ru' ? 'Выйти из аккаунта' : 'Hisobdan chiqish'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 32,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginHorizontal: 10,
  },
  errorText: {
    fontSize: 14,
    marginBottom: 20,
  },
  numberPad: {
    width: '100%',
    maxWidth: 300,
  },
  numberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  numberButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberButtonPlaceholder: {
    width: 72,
    height: 72,
  },
  numberText: {
    fontSize: 28,
    fontWeight: '500',
  },
  deleteText: {
    fontSize: 24,
  },
  logoutButton: {
    marginTop: 24,
    paddingVertical: 12,
  },
  logoutText: {
    fontSize: 14,
  },
});
