import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';

interface WelcomeScreenProps {
  navigation: any;
  onViewOrders: () => void;
  onWorkInApp: () => void;
}

export function WelcomeScreen({ navigation, onViewOrders, onWorkInApp }: WelcomeScreenProps) {
  const { t, language, setLanguage } = useLanguage();
  const colors = Colors.light;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.languageToggle}>
        <TouchableOpacity
          style={[
            styles.langButton,
            language === 'ru' && { backgroundColor: colors.primary }
          ]}
          onPress={() => setLanguage('ru')}
        >
          <Text style={[
            styles.langText,
            { color: language === 'ru' ? colors.primaryForeground : colors.foreground }
          ]}>
            RU
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.langButton,
            language === 'uz' && { backgroundColor: colors.primary }
          ]}
          onPress={() => setLanguage('uz')}
        >
          <Text style={[
            styles.langText,
            { color: language === 'uz' ? colors.primaryForeground : colors.foreground }
          ]}>
            UZ
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Ionicons name="cube" size={80} color={colors.primary} />
          <Text style={[styles.logo, { color: colors.primary }]}>
            {t.appName}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {t.welcomeSubtitle}
          </Text>
        </View>

        <View style={styles.features}>
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="search" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.featureText, { color: colors.foreground }]}>
              {language === 'ru' ? 'Найдите грузы для перевозки' : 'Tashish uchun yuklarni toping'}
            </Text>
          </View>
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="document-text" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.featureText, { color: colors.foreground }]}>
              {language === 'ru' ? 'Заключайте договоры онлайн' : 'Shartnomalarni onlayn tuzing'}
            </Text>
          </View>
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.featureText, { color: colors.foreground }]}>
              {language === 'ru' ? 'Безопасные сделки с гарантией' : 'Kafolatli xavfsiz bitimlar'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.buttons}>
        <Button
          title={t.viewOrders}
          onPress={onViewOrders}
          variant="outline"
          style={styles.button}
        />
        <Button
          title={t.workInApp}
          onPress={onWorkInApp}
          style={styles.button}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  languageToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 16,
    paddingHorizontal: 24,
  },
  langButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginHorizontal: 8,
  },
  langText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 42,
    fontWeight: 'bold',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  features: {
    gap: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: 16,
    flex: 1,
  },
  buttons: {
    padding: 24,
    gap: 12,
  },
  button: {
    width: '100%',
  },
});
