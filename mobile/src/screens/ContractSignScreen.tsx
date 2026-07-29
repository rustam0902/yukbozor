import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { formatPrice, formatDate, getRegionName, getContractStatusName } from '../constants/regions';

interface ContractSignScreenProps {
  navigation: any;
  route: {
    params: {
      contractId: number;
    };
  };
}

interface Contract {
  id: number;
  orderId: number;
  customerId: number;
  carrierId: number;
  customerName?: string;
  carrierName?: string;
  status: string;
  price: number;
  customerSignature?: string;
  carrierSignature?: string;
  customerSignatureMethod?: string;
  carrierSignatureMethod?: string;
  order?: {
    id: number;
    title: string;
    originRegion: string;
    destinationRegion: string;
    loadingDate: string;
  };
}

export function ContractSignScreen({ navigation, route }: ContractSignScreenProps) {
  const { contractId } = route.params;
  const { language } = useLanguage();
  const { user } = useAuth();
  const colors = Colors.light;
  
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    loadContract();
  }, [contractId]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const loadContract = async () => {
    try {
      const response = await api.get(`/api/contracts/${contractId}`);
      setContract(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load contract');
    } finally {
      setLoading(false);
    }
  };

  const sendSmsCode = async () => {
    setSendingCode(true);
    setError('');
    
    try {
      await api.post(`/api/contracts/${contractId}/sms-sign/send`, { language });
      setCodeSent(true);
      setCountdown(60);
    } catch (err: any) {
      setError(err.response?.data?.error || (language === 'ru' ? 'Ошибка отправки SMS' : 'SMS yuborishda xato'));
    } finally {
      setSendingCode(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyAndSign = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError(language === 'ru' ? 'Введите полный код' : 'To\'liq kodni kiriting');
      return;
    }
    
    setVerifying(true);
    setError('');
    
    try {
      await api.post(`/api/contracts/${contractId}/sms-sign/verify`, { 
        code: fullCode,
        language 
      });
      
      Alert.alert(
        language === 'ru' ? 'Успешно!' : 'Muvaffaqiyatli!',
        language === 'ru' ? 'Договор успешно подписан' : 'Shartnoma muvaffaqiyatli imzolandi',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      setError(err.response?.data?.error || (language === 'ru' ? 'Ошибка подписания' : 'Imzolashda xato'));
    } finally {
      setVerifying(false);
    }
  };

  const isCustomer = contract?.customerId === user?.id;
  const isCarrier = contract?.carrierId === user?.id;
  
  const alreadySigned = isCustomer 
    ? !!contract?.customerSignature && !contract.customerSignature.startsWith('AUTO_SIGNED_')
    : !!contract?.carrierSignature && !contract.carrierSignature.startsWith('AUTO_SIGNED_');

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            {language === 'ru' ? 'Загрузка...' : 'Yuklanmoqda...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!contract) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          <Button 
            title={language === 'ru' ? 'Назад' : 'Orqaga'} 
            onPress={() => navigation.goBack()} 
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: colors.primary }]}>
            ← {language === 'ru' ? 'Назад' : 'Orqaga'}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {language === 'ru' ? 'Подписание договора' : 'Shartnomani imzolash'}
        </Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.contractCard}>
          <Text style={[styles.contractNumber, { color: colors.foreground }]}>
            {language === 'ru' ? 'Договор' : 'Shartnoma'} #{contract.id}
          </Text>
          
          {contract.order && (
            <>
              <Text style={[styles.orderTitle, { color: colors.foreground }]}>
                {contract.order.title}
              </Text>
              <Text style={[styles.route, { color: colors.mutedForeground }]}>
                {getRegionName(contract.order.originRegion, language)} → {getRegionName(contract.order.destinationRegion, language)}
              </Text>
            </>
          )}
          
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>
              {language === 'ru' ? 'Сумма договора:' : 'Shartnoma summasi:'}
            </Text>
            <Text style={[styles.priceValue, { color: colors.primary }]}>
              {formatPrice(contract.price, language)}
            </Text>
          </View>
          
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.mutedForeground }]}>
              {language === 'ru' ? 'Статус:' : 'Holati:'}
            </Text>
            <Text style={[styles.statusValue, { color: colors.foreground }]}>
              {getContractStatusName(contract.status, language)}
            </Text>
          </View>
        </Card>
        
        {alreadySigned ? (
          <Card style={styles.signedCard}>
            <Text style={[styles.signedIcon]}>✓</Text>
            <Text style={[styles.signedText, { color: colors.success }]}>
              {language === 'ru' ? 'Вы уже подписали этот договор' : 'Siz bu shartnomani allaqachon imzolagansiz'}
            </Text>
          </Card>
        ) : (
          <Card style={styles.signCard}>
            <Text style={[styles.signTitle, { color: colors.foreground }]}>
              {language === 'ru' ? 'Подпись через SMS' : 'SMS orqali imzolash'}
            </Text>
            
            <Text style={[styles.signDescription, { color: colors.mutedForeground }]}>
              {language === 'ru' 
                ? 'Для подписания договора на ваш номер телефона будет отправлен код подтверждения.'
                : 'Shartnomani imzolash uchun telefon raqamingizga tasdiqlash kodi yuboriladi.'
              }
            </Text>
            
            {error ? (
              <View style={[styles.errorBox, { backgroundColor: colors.destructive + '20' }]}>
                <Text style={[styles.errorBoxText, { color: colors.destructive }]}>{error}</Text>
              </View>
            ) : null}
            
            {!codeSent ? (
              <Button
                title={language === 'ru' ? 'Получить код' : 'Kodni olish'}
                onPress={sendSmsCode}
                loading={sendingCode}
                style={styles.sendButton}
              />
            ) : (
              <>
                <Text style={[styles.codeLabel, { color: colors.foreground }]}>
                  {language === 'ru' ? 'Введите код из SMS:' : 'SMS dan kodni kiriting:'}
                </Text>
                
                <View style={styles.codeInputContainer}>
                  {code.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => { inputRefs.current[index] = ref; }}
                      style={[
                        styles.codeInput,
                        { 
                          borderColor: digit ? colors.primary : colors.border,
                          color: colors.foreground
                        }
                      ]}
                      value={digit}
                      onChangeText={(value) => handleCodeChange(index, value)}
                      onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                      keyboardType="number-pad"
                      maxLength={1}
                      selectTextOnFocus
                    />
                  ))}
                </View>
                
                <Button
                  title={language === 'ru' ? 'Подписать договор' : 'Shartnomani imzolash'}
                  onPress={verifyAndSign}
                  loading={verifying}
                  disabled={code.join('').length !== 6}
                  style={styles.signButton}
                />
                
                {countdown > 0 ? (
                  <Text style={[styles.countdownText, { color: colors.mutedForeground }]}>
                    {language === 'ru' ? `Повторная отправка через ${countdown} сек` : `Qayta yuborish ${countdown} soniyadan so'ng`}
                  </Text>
                ) : (
                  <TouchableOpacity onPress={sendSmsCode} disabled={sendingCode}>
                    <Text style={[styles.resendText, { color: colors.primary }]}>
                      {language === 'ru' ? 'Отправить код повторно' : 'Kodni qayta yuborish'}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </Card>
        )}
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
    fontSize: 16,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
  },
  contractCard: {
    marginBottom: 16,
  },
  contractNumber: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  orderTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  route: {
    fontSize: 14,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  signedCard: {
    alignItems: 'center',
    padding: 24,
  },
  signedIcon: {
    fontSize: 48,
    color: '#22c55e',
    marginBottom: 12,
  },
  signedText: {
    fontSize: 16,
    textAlign: 'center',
  },
  signCard: {
    padding: 16,
  },
  signTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  signDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorBoxText: {
    fontSize: 14,
  },
  sendButton: {
    marginTop: 8,
  },
  codeLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  codeInputContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
  },
  signButton: {
    marginBottom: 16,
  },
  countdownText: {
    textAlign: 'center',
    fontSize: 14,
  },
  resendText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
});
