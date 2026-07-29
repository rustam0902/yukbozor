import { View, Text, StyleSheet, TouchableOpacity, Vibration } from 'react-native';
import { useState, useEffect } from 'react';
import { Colors } from '../constants/colors';

interface PinInputProps {
  length?: number;
  onComplete: (pin: string) => void;
  onBiometrics?: () => void;
  showBiometrics?: boolean;
  error?: string;
  title?: string;
}

export function PinInput({
  length = 4,
  onComplete,
  onBiometrics,
  showBiometrics = false,
  error,
  title,
}: PinInputProps) {
  const [pin, setPin] = useState('');
  const colors = Colors.light;

  useEffect(() => {
    if (pin.length === length) {
      onComplete(pin);
    }
  }, [pin, length, onComplete]);

  useEffect(() => {
    if (error) {
      Vibration.vibrate(100);
      setPin('');
    }
  }, [error]);

  const handlePress = (digit: string) => {
    if (pin.length < length) {
      setPin(prev => prev + digit);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const renderDots = () => {
    const dots = [];
    for (let i = 0; i < length; i++) {
      dots.push(
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i < pin.length ? colors.primary : 'transparent',
              borderColor: error ? colors.destructive : colors.primary,
            },
          ]}
        />
      );
    }
    return dots;
  };

  const renderKeypad = () => {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      [showBiometrics ? 'bio' : '', '0', 'del'],
    ];

    return keys.map((row, rowIndex) => (
      <View key={rowIndex} style={styles.keyRow}>
        {row.map((key, keyIndex) => {
          if (key === '') {
            return <View key={keyIndex} style={styles.key} />;
          }

          if (key === 'bio') {
            return (
              <TouchableOpacity
                key={keyIndex}
                style={[styles.key, { backgroundColor: colors.primary + '20' }]}
                onPress={onBiometrics}
              >
                <Text style={[styles.keyText, { color: colors.primary }]}>
                  👆
                </Text>
              </TouchableOpacity>
            );
          }

          if (key === 'del') {
            return (
              <TouchableOpacity
                key={keyIndex}
                style={styles.key}
                onPress={handleDelete}
              >
                <Text style={[styles.keyText, { color: colors.foreground }]}>
                  ⌫
                </Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={keyIndex}
              style={[styles.key, { backgroundColor: colors.secondary }]}
              onPress={() => handlePress(key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.keyText, { color: colors.foreground }]}>
                {key}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    ));
  };

  return (
    <View style={styles.container}>
      {title && (
        <Text style={[styles.title, { color: colors.foreground }]}>
          {title}
        </Text>
      )}
      
      <View style={styles.dotsContainer}>
        {renderDots()}
      </View>

      {error && (
        <Text style={[styles.error, { color: colors.destructive }]}>
          {error}
        </Text>
      )}

      <View style={styles.keypad}>
        {renderKeypad()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 32,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    marginHorizontal: 8,
  },
  error: {
    fontSize: 14,
    marginBottom: 16,
  },
  keypad: {
    marginTop: 24,
  },
  keyRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
  },
  keyText: {
    fontSize: 28,
    fontWeight: '500',
  },
});
