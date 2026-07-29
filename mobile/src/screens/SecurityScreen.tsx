import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { secureStorage } from '../services/secureStorage';
import { biometrics, BiometricStatus } from '../services/biometrics';

interface SecurityScreenProps {
  navigation: any;
}

export function SecurityScreen({ navigation }: SecurityScreenProps) {
  const { language } = useLanguage();
  const { hasBiometrics, checkBiometricsStatus } = useAuth();
  const colors = Colors.light;
  
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [isPinSetup, setIsPinSetup] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const bioStatus = await biometrics.checkAvailability();
    setBiometricStatus(bioStatus);
    
    const bioEnabled = await secureStorage.isBiometricsEnabled();
    setBiometricsEnabled(bioEnabled);
    
    const pinSetup = await secureStorage.isPinSetup();
    setIsPinSetup(pinSetup);
  };

  const handleChangePinPress = () => {
    Alert.alert(
      language === 'ru' ? 'Изменить PIN-код' : 'PIN-kodni o\'zgartirish',
      language === 'ru' 
        ? 'Для смены PIN-кода потребуется ввести текущий PIN' 
        : 'PIN-kodni o\'zgartirish uchun joriy PIN kiritish kerak',
      [
        { text: language === 'ru' ? 'Отмена' : 'Bekor qilish', style: 'cancel' },
        { 
          text: language === 'ru' ? 'Продолжить' : 'Davom etish', 
          onPress: () => navigation.navigate('ChangePinScreen')
        },
      ]
    );
  };

  const handleBiometricsToggle = async (value: boolean) => {
    if (!isPinSetup) {
      Alert.alert(
        language === 'ru' ? 'Требуется PIN-код' : 'PIN-kod kerak',
        language === 'ru' 
          ? 'Сначала установите PIN-код для включения биометрии' 
          : 'Biometriyani yoqish uchun avval PIN-kodni o\'rnating'
      );
      return;
    }
    
    if (value) {
      const biometricLabel = biometrics.getBiometricLabel(
        biometricStatus?.biometricType || 'fingerprint', 
        language
      );
      
      const result = await biometrics.authenticate(
        language === 'ru' 
          ? `Подтвердите включение ${biometricLabel}` 
          : `${biometricLabel}ni yoqishni tasdiqlang`
      );
      
      if (result.success) {
        await secureStorage.setBiometricsEnabled(true);
        setBiometricsEnabled(true);
        await checkBiometricsStatus();
        
        Alert.alert(
          language === 'ru' ? 'Готово' : 'Tayyor',
          language === 'ru' 
            ? `${biometricLabel} успешно включен` 
            : `${biometricLabel} muvaffaqiyatli yoqildi`
        );
      }
    } else {
      await secureStorage.setBiometricsEnabled(false);
      setBiometricsEnabled(false);
      await checkBiometricsStatus();
    }
  };

  const getBiometricLabel = () => {
    if (!biometricStatus) return language === 'ru' ? 'Биометрия' : 'Biometriya';
    return biometrics.getBiometricLabel(biometricStatus.biometricType, language);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backText, { color: colors.primary }]}>
            ← {language === 'ru' ? 'Назад' : 'Orqaga'}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {language === 'ru' ? 'Безопасность' : 'Xavfsizlik'}
        </Text>
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {language === 'ru' ? 'PIN-код' : 'PIN-kod'}
          </Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingIcon}>🔢</Text>
              <View>
                <Text style={[styles.settingLabel, { color: colors.foreground }]}>
                  {language === 'ru' ? '4-значный PIN-код' : '4 raqamli PIN-kod'}
                </Text>
                <Text style={[styles.settingDesc, { color: colors.mutedForeground }]}>
                  {isPinSetup 
                    ? (language === 'ru' ? 'Установлен' : 'O\'rnatilgan')
                    : (language === 'ru' ? 'Не установлен' : 'O\'rnatilmagan')
                  }
                </Text>
              </View>
            </View>
          </View>
          
          <Button
            title={language === 'ru' ? 'Изменить PIN-код' : 'PIN-kodni o\'zgartirish'}
            onPress={handleChangePinPress}
            variant="outline"
            size="sm"
            style={styles.changeButton}
          />
        </Card>

        {biometricStatus?.isAvailable && (
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {getBiometricLabel()}
            </Text>
            
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingIcon}>
                  {biometricStatus.biometricType === 'facial' ? '👤' : '👆'}
                </Text>
                <View style={styles.settingContent}>
                  <Text style={[styles.settingLabel, { color: colors.foreground }]}>
                    {language === 'ru' 
                      ? `Использовать ${getBiometricLabel()}`
                      : `${getBiometricLabel()}dan foydalanish`
                    }
                  </Text>
                  <Text style={[styles.settingDesc, { color: colors.mutedForeground }]}>
                    {language === 'ru' 
                      ? 'Для быстрого входа в приложение'
                      : 'Ilovaga tez kirish uchun'
                    }
                  </Text>
                </View>
              </View>
              
              <Switch
                value={biometricsEnabled}
                onValueChange={handleBiometricsToggle}
                trackColor={{ false: colors.muted, true: colors.primary + '80' }}
                thumbColor={biometricsEnabled ? colors.primary : '#f4f3f4'}
              />
            </View>
          </Card>
        )}

        <Card style={styles.infoCard}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            {language === 'ru' 
              ? 'PIN-код и биометрия хранятся только на вашем устройстве и обеспечивают дополнительную защиту.'
              : 'PIN-kod va biometriya faqat qurilmangizda saqlanadi va qo\'shimcha himoya ta\'minlaydi.'
            }
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    marginBottom: 8,
  },
  backText: {
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingContent: {
    flex: 1,
  },
  settingIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  settingDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  changeButton: {
    marginTop: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
