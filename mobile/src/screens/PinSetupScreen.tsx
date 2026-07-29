import { View, Text, StyleSheet, TouchableOpacity, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { secureStorage } from '../services/secureStorage';
import { biometrics, BiometricStatus } from '../services/biometrics';

interface PinSetupScreenProps {
  navigation: any;
  route: any;
}

type SetupStep = 'enter' | 'confirm' | 'biometric';

export function PinSetupScreen({ navigation, route }: PinSetupScreenProps) {
  const { language } = useLanguage();
  const colors = Colors.light;
  
  const [step, setStep] = useState<SetupStep>('enter');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null);
  
  const onComplete = route.params?.onComplete;

  useEffect(() => {
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    const status = await biometrics.checkAvailability();
    setBiometricStatus(status);
  };

  const handleNumberPress = (num: string) => {
    setError('');
    
    if (step === 'enter') {
      if (pin.length < 4) {
        const newPin = pin + num;
        setPin(newPin);
        
        if (newPin.length === 4) {
          setTimeout(() => {
            setFirstPin(newPin);
            setPin('');
            setStep('confirm');
          }, 200);
        }
      }
    } else if (step === 'confirm') {
      if (confirmPin.length < 4) {
        const newConfirm = confirmPin + num;
        setConfirmPin(newConfirm);
        
        if (newConfirm.length === 4) {
          setTimeout(() => {
            validateAndSavePin(newConfirm);
          }, 200);
        }
      }
    }
  };

  const handleDelete = () => {
    if (step === 'enter' && pin.length > 0) {
      setPin(pin.slice(0, -1));
    } else if (step === 'confirm' && confirmPin.length > 0) {
      setConfirmPin(confirmPin.slice(0, -1));
    }
    setError('');
  };

  const validateAndSavePin = async (confirmedPin: string) => {
    if (firstPin !== confirmedPin) {
      Vibration.vibrate(200);
      setError(language === 'ru' ? 'PIN-коды не совпадают' : 'PIN-kodlar mos kelmadi');
      setConfirmPin('');
      return;
    }

    try {
      await secureStorage.savePin(confirmedPin);
      
      if (biometricStatus?.isAvailable) {
        setStep('biometric');
      } else {
        completeSetup();
      }
    } catch (err) {
      setError(language === 'ru' ? 'Ошибка сохранения PIN' : 'PIN saqlashda xatolik');
    }
  };

  const handleEnableBiometrics = async (enable: boolean) => {
    await secureStorage.setBiometricsEnabled(enable);
    completeSetup();
  };

  const completeSetup = () => {
    if (onComplete) {
      onComplete();
    }
  };

  const getCurrentPin = () => {
    return step === 'enter' ? pin : confirmPin;
  };

  const renderPinDots = () => {
    const currentPin = getCurrentPin();
    return (
      <View style={styles.dotsContainer}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i < currentPin.length ? colors.primary : 'transparent',
                borderColor: colors.primary,
              }
            ]}
          />
        ))}
      </View>
    );
  };

  const renderNumberPad = () => {
    const numbers = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', 'del'],
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

  const renderBiometricStep = () => {
    if (!biometricStatus) return null;
    
    const biometricLabel = biometrics.getBiometricLabel(biometricStatus.biometricType, language);
    
    return (
      <View style={styles.biometricContainer}>
        <Text style={styles.biometricIcon}>
          {biometricStatus.biometricType === 'facial' ? '👤' : '👆'}
        </Text>
        
        <Text style={[styles.title, { color: colors.foreground }]}>
          {language === 'ru' 
            ? `Включить ${biometricLabel}?` 
            : `${biometricLabel}ni yoqish?`}
        </Text>
        
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {language === 'ru'
            ? 'Вы сможете входить быстрее с помощью биометрии'
            : 'Biometriya yordamida tezroq kirishingiz mumkin'}
        </Text>
        
        <TouchableOpacity
          style={[styles.biometricButton, { backgroundColor: colors.primary }]}
          onPress={() => handleEnableBiometrics(true)}
        >
          <Text style={[styles.biometricButtonText, { color: colors.primaryForeground }]}>
            {language === 'ru' ? 'Включить' : 'Yoqish'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => handleEnableBiometrics(false)}
        >
          <Text style={[styles.skipButtonText, { color: colors.mutedForeground }]}>
            {language === 'ru' ? 'Пропустить' : 'O\'tkazib yuborish'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (step === 'biometric') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {renderBiometricStep()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {step === 'enter'
            ? (language === 'ru' ? 'Создайте PIN-код' : 'PIN-kod yarating')
            : (language === 'ru' ? 'Подтвердите PIN-код' : 'PIN-kodni tasdiqlang')}
        </Text>
        
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {step === 'enter'
            ? (language === 'ru' ? 'Введите 4-значный PIN-код' : '4 raqamli PIN-kodni kiriting')
            : (language === 'ru' ? 'Повторите PIN-код еще раз' : 'PIN-kodni yana bir marta kiriting')}
        </Text>
        
        {renderPinDots()}
        
        {error ? (
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            {error}
          </Text>
        ) : null}
        
        {renderNumberPad()}
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 40,
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
  biometricContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  biometricIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  biometricButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 32,
  },
  biometricButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 14,
  },
});
