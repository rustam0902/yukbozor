import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import { api } from '../services/api';

export function WithdrawScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { language } = useLanguage();
  const colors = Colors.light;
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [formData, setFormData] = useState({
    amount: '',
    cardNumber: '',
    cardHolder: '',
  });

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const response = await api.get('/api/partner/stats');
        setAvailableBalance(response.data?.pendingEarnings || 0);
      } catch (error) {
        console.error('Error fetching balance:', error);
      } finally {
        setLoadingBalance(false);
      }
    };
    fetchBalance();
  }, []);

  const t = {
    title: language === 'ru' ? 'Вывод средств' : 'Mablag\' yechish',
    availableBalance: language === 'ru' ? 'Доступно для вывода' : 'Yechish uchun mavjud',
    amount: language === 'ru' ? 'Сумма вывода' : 'Yechish summasi',
    cardNumber: language === 'ru' ? 'Номер карты' : 'Karta raqami',
    cardHolder: language === 'ru' ? 'Имя владельца карты' : 'Karta egasining ismi',
    withdraw: language === 'ru' ? 'Вывести' : 'Yechish',
    processing: language === 'ru' ? 'Обработка...' : 'Jarayon...',
    success: language === 'ru' ? 'Заявка на вывод создана' : 'Yechish so\'rovi yaratildi',
    error: language === 'ru' ? 'Ошибка при создании заявки' : 'So\'rov yaratishda xatolik',
    minAmount: language === 'ru' ? 'Минимальная сумма: 50 000 сум' : 'Minimal summa: 50 000 so\'m',
    insufficientFunds: language === 'ru' ? 'Недостаточно средств' : 'Mablag\' yetarli emas',
    invalidCard: language === 'ru' ? 'Введите корректный номер карты' : 'To\'g\'ri karta raqamini kiriting',
    sum: language === 'ru' ? 'сум' : 'so\'m',
    note: language === 'ru' 
      ? 'Вывод средств обрабатывается в течение 1-3 рабочих дней. Комиссия за вывод не взимается.'
      : 'Mablag\' yechish 1-3 ish kuni ichida amalga oshiriladi. Yechish uchun komissiya olinmaydi.',
  };

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    const formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
    return formatted.substring(0, 19);
  };

  const handleSubmit = async () => {
    const amount = parseFloat(formData.amount.replace(/\s/g, ''));
    const cardNumber = formData.cardNumber.replace(/\s/g, '');

    if (!amount || amount < 50000) {
      Alert.alert('', t.minAmount);
      return;
    }

    if (amount > availableBalance) {
      Alert.alert('', t.insufficientFunds);
      return;
    }

    if (cardNumber.length !== 16) {
      Alert.alert('', t.invalidCard);
      return;
    }

    try {
      setLoading(true);
      await api.post('/api/partner/withdraw', {
        amount,
        cardNumber,
        cardHolder: formData.cardHolder,
      });
      Alert.alert('', t.success, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error creating withdrawal:', error);
      Alert.alert('', t.error);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (num: number) => {
    return num.toLocaleString('ru-RU');
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
          data-testid="button-back"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.title}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.balanceLabel}>{t.availableBalance}</Text>
          {loadingBalance ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.balanceValue}>{formatAmount(availableBalance)} {t.sum}</Text>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>{t.amount}</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: colors.card, 
              borderColor: colors.border,
              color: colors.foreground 
            }]}
            value={formData.amount}
            onChangeText={(text) => setFormData(prev => ({ ...prev, amount: text.replace(/[^0-9]/g, '') }))}
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            data-testid="input-amount"
          />
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>{t.minAmount}</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>{t.cardNumber}</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: colors.card, 
              borderColor: colors.border,
              color: colors.foreground 
            }]}
            value={formData.cardNumber}
            onChangeText={(text) => setFormData(prev => ({ ...prev, cardNumber: formatCardNumber(text) }))}
            placeholder="0000 0000 0000 0000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            maxLength={19}
            data-testid="input-card-number"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>{t.cardHolder}</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: colors.card, 
              borderColor: colors.border,
              color: colors.foreground 
            }]}
            value={formData.cardHolder}
            onChangeText={(text) => setFormData(prev => ({ ...prev, cardHolder: text.toUpperCase() }))}
            placeholder="IVAN IVANOV"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            data-testid="input-card-holder"
          />
        </View>

        {!loadingBalance && availableBalance === 0 && (
          <View style={[styles.emptyBalanceCard, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
            <Ionicons name="alert-circle-outline" size={20} color="#f59e0b" />
            <Text style={[styles.noteText, { color: '#92400e' }]}>
              {language === 'ru' 
                ? 'На вашем балансе нет средств для вывода. Привлекайте рефералов, чтобы заработать комиссию.'
                : 'Hisobingizda yechish uchun mablag\' yo\'q. Komissiya olish uchun referallarni jalb qiling.'}
            </Text>
          </View>
        )}

        <View style={[styles.noteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={[styles.noteText, { color: colors.mutedForeground }]}>{t.note}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton, 
            { backgroundColor: colors.primary },
            (loading || loadingBalance || availableBalance === 0) && styles.disabledButton
          ]}
          onPress={handleSubmit}
          disabled={loading || loadingBalance || availableBalance === 0}
          data-testid="button-submit"
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitButtonText}>{t.withdraw}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  balanceCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginTop: 8,
    gap: 12,
  },
  emptyBalanceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginTop: 16,
    gap: 12,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  submitButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 32,
  },
});
