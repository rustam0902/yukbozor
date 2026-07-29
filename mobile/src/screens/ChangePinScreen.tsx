import { View, Text, StyleSheet, TouchableOpacity, Vibration, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { secureStorage } from '../services/secureStorage';

interface ChangePinScreenProps {
  navigation: any;
}

type ChangeStep = 'current' | 'new' | 'confirm';

export function ChangePinScreen({ navigation }: ChangePinScreenProps) {
  const { language } = useLanguage();
  const colors = Colors.light;
  
  const [step, setStep] = useState<ChangeStep>('current');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');

  const handleNumberPress = (num: string) => {
    setError('');
    
    if (step === 'current') {
      if (currentPin.length < 4) {
        const pin = currentPin + num;
        setCurrentPin(pin);
        
        if (pin.length === 4) {
          setTimeout(() => verifyCurrentPin(pin), 200);
        }
      }
    } else if (step === 'new') {
      if (newPin.length < 4) {
        const pin = newPin + num;
        setNewPin(pin);
        
        if (pin.length === 4) {
          setTimeout(() => {
            setStep('confirm');
          }, 200);
        }
      }
    } else if (step === 'confirm') {
      if (confirmPin.length < 4) {
        const pin = confirmPin + num;
        setConfirmPin(pin);
        
        if (pin.length === 4) {
          setTimeout(() => saveNewPin(pin), 200);
        }
      }
    }
  };

  const handleDelete = () => {
    if (step === 'current' && currentPin.length > 0) {
      setCurrentPin(currentPin.slice(0, -1));
    } else if (step === 'new' && newPin.length > 0) {
      setNewPin(newPin.slice(0, -1));
    } else if (step === 'confirm' && confirmPin.length > 0) {
      setConfirmPin(confirmPin.slice(0, -1));
    }
    setError('');
  };

  const verifyCurrentPin = async (pin: string) => {
    const isValid = await secureStorage.verifyPin(pin);
    
    if (isValid) {
      setStep('new');
      setCurrentPin('');
    } else {
      Vibration.vibrate(200);
      setError(language === 'ru' ? 'Неверный PIN-код' : 'Noto\'g\'ri PIN-kod');
      setCurrentPin('');
    }
  };

  const saveNewPin = async (pin: string) => {
    if (newPin !== pin) {
      Vibration.vibrate(200);
      setError(language === 'ru' ? 'PIN-коды не совпадают' : 'PIN-kodlar mos kelmadi');
      setConfirmPin('');
      return;
    }

    try {
      await secureStorage.savePin(pin);
      Alert.alert(
        language === 'ru' ? 'Готово' : 'Tayyor',
        language === 'ru' ? 'PIN-код успешно изменен' : 'PIN-kod muvaffaqiyatli o\'zgartirildi',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      setError(language === 'ru' ? 'Ошибка сохранения' : 'Saqlashda xatolik');
    }
  };

  const getCurrentPin = () => {
    switch (step) {
      case 'current': return currentPin;
      case 'new': return newPin;
      case 'confirm': return confirmPin;
    }
  };

  const getTitle = () => {
    switch (step) {
      case 'current': 
        return language === 'ru' ? 'Введите текущий PIN' : 'Joriy PIN-kodni kiriting';
      case 'new': 
        return language === 'ru' ? 'Введите новый PIN' : 'Yangi PIN-kodni kiriting';
      case 'confirm': 
        return language === 'ru' ? 'Подтвердите новый PIN' : 'Yangi PIN-kodni tasdiqlang';
    }
  };

  const renderPinDots = () => {
    const pin = getCurrentPin();
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backText, { color: colors.primary }]}>
            ← {language === 'ru' ? 'Отмена' : 'Bekor qilish'}
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <View style={styles.progressContainer}>
          {['current', 'new', 'confirm'].map((s, i) => (
            <View
              key={s}
              style={[
                styles.progressDot,
                {
                  backgroundColor: 
                    (step === 'current' && i === 0) ||
                    (step === 'new' && i <= 1) ||
                    (step === 'confirm' && i <= 2)
                      ? colors.primary 
                      : colors.muted,
                }
              ]}
            />
          ))}
        </View>
        
        <Text style={[styles.title, { color: colors.foreground }]}>
          {getTitle()}
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
  header: {
    padding: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 16,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  progressContainer: {
    flexDirection: 'row',
    marginBottom: 32,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 6,
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
});
