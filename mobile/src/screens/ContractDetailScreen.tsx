import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useContractDetail, ContractDetail } from '../hooks/useContracts';
import { formatPrice, formatDate, getRegionName, getContractStatusName, getContractStatusColor, getTransportTypeName } from '../constants/regions';
import { localizeLoadingTime } from '../utils/loadingTimeUtils';
import { API_BASE_URL } from '../constants/api';

interface ContractDetailScreenProps {
  navigation: any;
  route: {
    params: {
      contractId: number;
    };
  };
}

export function ContractDetailScreen({ navigation, route }: ContractDetailScreenProps) {
  const { contractId } = route.params;
  const { language } = useLanguage();
  const { user } = useAuth();
  const colors = Colors.light;

  const { data: contract, isLoading, error } = useContractDetail(contractId);

  const isCustomer = contract?.customerId === user?.id;
  const isCarrier = contract?.carrierId === user?.id;

  const handleDownloadContract = async (lang: 'ru' | 'uz') => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      const url = `${API_BASE_URL}/api/contracts/${contractId}/download/${lang}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(
        language === 'ru' ? 'Ошибка' : 'Xato',
        language === 'ru' ? 'Не удалось скачать договор. Проверьте подключение к интернету.' : 'Shartnomani yuklab bo\'lmadi. Internet ulanishini tekshiring.'
      );
    }
  };

  const getSignatureStatus = (signature: string | undefined): { label: string; color: string } => {
    if (!signature) {
      return { 
        label: language === 'ru' ? 'Не подписан' : 'Imzolanmagan', 
        color: '#EF4444' 
      };
    }
    if (signature.startsWith('AUTO_SIGNED_')) {
      return { 
        label: language === 'ru' ? 'Авто-подпись' : 'Avto-imzo', 
        color: '#F59E0B' 
      };
    }
    return { 
      label: language === 'ru' ? 'Подписан (ЭЦП)' : 'Imzolangan (ERI)', 
      color: '#10B981' 
    };
  };

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} testID="button-back">
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {language === 'ru' ? 'Ошибка' : 'Xato'}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.foreground }]}>
            {language === 'ru' ? 'Не удалось загрузить договор' : 'Shartnomani yuklab bo\'lmadi'}
          </Text>
          <TouchableOpacity 
            style={[styles.retryButton, { borderColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.retryText, { color: colors.primary }]}>
              {language === 'ru' ? 'Назад' : 'Orqaga'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading || !contract) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} testID="button-back">
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {language === 'ru' ? 'Загрузка...' : 'Yuklanmoqda...'}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      </SafeAreaView>
    );
  }

  const customerSigStatus = getSignatureStatus(contract.customerSignature);
  const carrierSigStatus = getSignatureStatus(contract.carrierSignature);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} testID="button-back">
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {language === 'ru' ? 'Договор' : 'Shartnoma'} #{contractId}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: getContractStatusColor(contract.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getContractStatusColor(contract.status) }]}>
              {getContractStatusName(contract.status, language)}
            </Text>
          </View>
          <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
            {formatDate(contract.createdAt, language)}
          </Text>
        </View>

        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {language === 'ru' ? 'Стороны договора' : 'Shartnoma tomonlari'}
          </Text>
          
          <View style={styles.partyRow}>
            <View style={styles.partyItem}>
              <Text style={[styles.partyLabel, { color: colors.mutedForeground }]}>
                {language === 'ru' ? 'Заказчик' : 'Buyurtmachi'}
              </Text>
              <Text style={[styles.partyName, { color: colors.foreground }]}>
                {contract.customerName || `#${contract.customerId}`}
              </Text>
              <View style={[styles.signatureStatus, { backgroundColor: customerSigStatus.color + '20' }]}>
                <Ionicons 
                  name={contract.customerSignature ? "checkmark-circle" : "close-circle"} 
                  size={14} 
                  color={customerSigStatus.color} 
                />
                <Text style={[styles.signatureText, { color: customerSigStatus.color }]}>
                  {customerSigStatus.label}
                </Text>
              </View>
            </View>
            
            <View style={styles.partyItem}>
              <Text style={[styles.partyLabel, { color: colors.mutedForeground }]}>
                {language === 'ru' ? 'Перевозчик' : 'Tashuvchi'}
              </Text>
              <Text style={[styles.partyName, { color: colors.foreground }]}>
                {contract.carrierName || `#${contract.carrierId}`}
              </Text>
              <View style={[styles.signatureStatus, { backgroundColor: carrierSigStatus.color + '20' }]}>
                <Ionicons 
                  name={contract.carrierSignature ? "checkmark-circle" : "close-circle"} 
                  size={14} 
                  color={carrierSigStatus.color} 
                />
                <Text style={[styles.signatureText, { color: carrierSigStatus.color }]}>
                  {carrierSigStatus.label}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {contract.order && (
          <Card style={styles.section}>
            <View style={styles.orderSectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>
                {language === 'ru' ? 'Заказ' : 'Buyurtma'} #{contract.orderId}
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('OrderDetail', { orderId: contract.orderId })}
                style={styles.orderLinkButton}
                testID="button-view-order"
              >
                <Ionicons name="open-outline" size={16} color={colors.primary} />
                <Text style={[styles.orderLinkText, { color: colors.primary }]}>
                  {language === 'ru' ? 'Открыть' : 'Ochish'}
                </Text>
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.orderTitle, { color: colors.foreground }]}>
              {contract.order.title}
            </Text>
            
            <View style={styles.routeRow}>
              <View style={styles.routePoint}>
                <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.routeText, { color: colors.foreground }]}>
                  {getRegionName(contract.order.originRegion, language)}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={colors.mutedForeground} />
              <View style={styles.routePoint}>
                <View style={[styles.routeDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.routeText, { color: colors.foreground }]}>
                  {getRegionName(contract.order.destinationRegion, language)}
                </Text>
              </View>
            </View>
            
            <View style={styles.orderInfoGrid}>
              <View style={styles.orderInfoRow}>
                <Text style={[styles.orderInfoLabel, { color: colors.mutedForeground }]}>
                  {language === 'ru' ? 'Тип транспорта' : 'Transport turi'}
                </Text>
                <Text style={[styles.orderInfoValue, { color: colors.foreground }]}>
                  {getTransportTypeName(contract.order.transportType, language)}
                </Text>
              </View>
              <View style={styles.orderInfoRow}>
                <Text style={[styles.orderInfoLabel, { color: colors.mutedForeground }]}>
                  {language === 'ru' ? 'Дата и время погрузки' : 'Yuklash sanasi va vaqti'}
                </Text>
                <Text style={[styles.orderInfoValue, { color: colors.foreground }]}>
                  {formatDate(contract.order.loadingDate, language)}{contract.order.loadingTime ? `, ${localizeLoadingTime(contract.order.loadingTime, language)}` : ''}
                </Text>
              </View>
            </View>
          </Card>
        )}

        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {language === 'ru' ? 'Финансы' : 'Moliyaviy ma\'lumotlar'}
          </Text>
          
          <View style={styles.financeRow}>
            <Text style={[styles.financeLabel, { color: colors.mutedForeground }]}>
              {language === 'ru' ? 'Сумма договора' : 'Shartnoma summasi'}
            </Text>
            <Text style={[styles.financeValue, { color: colors.primary }]}>
              {formatPrice(contract.price, language)}
            </Text>
          </View>
          
          {contract.priceWithoutVat && (
            <View style={styles.financeRow}>
              <Text style={[styles.financeLabel, { color: colors.mutedForeground }]}>
                {language === 'ru' ? 'Без НДС' : 'QQSsiz'}
              </Text>
              <Text style={[styles.financeValueSmall, { color: colors.foreground }]}>
                {formatPrice(contract.priceWithoutVat, language)}
              </Text>
            </View>
          )}
          
          {contract.commission && (
            <View style={styles.financeRow}>
              <Text style={[styles.financeLabel, { color: colors.mutedForeground }]}>
                {language === 'ru' ? 'Комиссия платформы' : 'Platforma komissiyasi'}
              </Text>
              <Text style={[styles.financeValueSmall, { color: colors.foreground }]}>
                {formatPrice(contract.commission, language)}
              </Text>
            </View>
          )}
          
          {(contract.blockedAmountCustomer || contract.blockedAmountCarrier) && (
            <>
              {isCustomer && contract.blockedAmountCustomer && (
                <View style={styles.financeRow}>
                  <Text style={[styles.financeLabel, { color: colors.mutedForeground }]}>
                    {language === 'ru' ? 'Заблокировано (залог)' : 'Bloklangan (garov)'}
                  </Text>
                  <Text style={[styles.financeValueSmall, { color: '#F59E0B' }]}>
                    {formatPrice(contract.blockedAmountCustomer, language)}
                  </Text>
                </View>
              )}
              {isCarrier && contract.blockedAmountCarrier && (
                <View style={styles.financeRow}>
                  <Text style={[styles.financeLabel, { color: colors.mutedForeground }]}>
                    {language === 'ru' ? 'Заблокировано (залог)' : 'Bloklangan (garov)'}
                  </Text>
                  <Text style={[styles.financeValueSmall, { color: '#F59E0B' }]}>
                    {formatPrice(contract.blockedAmountCarrier, language)}
                  </Text>
                </View>
              )}
            </>
          )}
        </Card>

        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {language === 'ru' ? 'Скачать договор' : 'Shartnomani yuklab olish'}
          </Text>
          
          <View style={styles.downloadButtons}>
            <TouchableOpacity 
              style={[styles.downloadButton, { borderColor: colors.primary }]}
              onPress={() => handleDownloadContract('ru')}
              testID="button-download-ru"
            >
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              <Text style={[styles.downloadButtonText, { color: colors.primary }]}>
                На русском
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.downloadButton, { borderColor: colors.primary }]}
              onPress={() => handleDownloadContract('uz')}
              testID="button-download-uz"
            >
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              <Text style={[styles.downloadButtonText, { color: colors.primary }]}>
                O'zbekcha
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {(contract.status === 'pending' || contract.status === 'awaiting_prepayment') && 
         ((isCustomer && !contract.customerSignature) || (isCarrier && !contract.carrierSignature)) && (
          <Button
            title={language === 'ru' ? 'Подписать договор' : 'Shartnomani imzolash'}
            onPress={() => navigation.navigate('ContractSign', { contractId })}
            style={styles.signButton}
            testID="button-sign-contract"
          />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  loader: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 32,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 14,
  },
  section: {
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  partyRow: {
    flexDirection: 'row',
    gap: 16,
  },
  partyItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  partyLabel: {
    fontSize: 12,
  },
  partyName: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  signatureStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 4,
    marginTop: 4,
  },
  signatureText: {
    fontSize: 11,
    fontWeight: '500',
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeText: {
    fontSize: 14,
  },
  orderSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orderLinkText: {
    fontSize: 14,
    fontWeight: '500',
  },
  orderDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
  },
  orderInfoGrid: {
    marginTop: 12,
    gap: 10,
  },
  orderInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  orderInfoLabel: {
    fontSize: 13,
  },
  orderInfoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  financeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  financeLabel: {
    fontSize: 14,
  },
  financeValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  financeValueSmall: {
    fontSize: 15,
    fontWeight: '500',
  },
  downloadButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  downloadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  signButton: {
    marginBottom: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
