import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { PinInput } from '../components/PinInput';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

interface PinScreenProps {
  mode: 'create' | 'confirm' | 'verify';
  onSuccess?: () => void;
}

export function PinScreen({ mode, onSuccess }: PinScreenProps) {
  const { t } = useLanguage();
  const { verifyPin, setPin, authenticateWithBiometrics, biometricsEnabled, hasBiometrics } = useAuth();
  const colors = Colors.light;
  
  const [error, setError] = useState('');
  const [createdPin, setCreatedPin] = useState('');
  const [currentMode, setCurrentMode] = useState(mode);

  useEffect(() => {
    // Try biometrics on mount for verify mode
    if (currentMode === 'verify' && biometricsEnabled) {
      handleBiometrics();
    }
  }, []);

  const getTitle = () => {
    switch (currentMode) {
      case 'create':
        return t.createPin;
      case 'confirm':
        return t.confirmPin;
      case 'verify':
        return t.enterPin;
      default:
        return t.enterPin;
    }
  };

  const handleBiometrics = async () => {
    const success = await authenticateWithBiometrics();
    if (success) {
      onSuccess?.();
    }
  };

  const handlePinComplete = async (pin: string) => {
    setError('');

    if (currentMode === 'create') {
      setCreatedPin(pin);
      setCurrentMode('confirm');
      return;
    }

    if (currentMode === 'confirm') {
      if (pin === createdPin) {
        await setPin(pin);
        onSuccess?.();
      } else {
        setError(t.pinMismatch);
        setCurrentMode('create');
        setCreatedPin('');
      }
      return;
    }

    if (currentMode === 'verify') {
      const isValid = await verifyPin(pin);
      if (isValid) {
        onSuccess?.();
      } else {
        setError(t.wrongPin);
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.logo, { color: colors.primary }]}>
          {t.appName}
        </Text>
        
        <PinInput
          title={getTitle()}
          onComplete={handlePinComplete}
          onBiometrics={handleBiometrics}
          showBiometrics={currentMode === 'verify' && biometricsEnabled && hasBiometrics}
          error={error}
        />
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
    padding: 24,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 48,
  },
});
