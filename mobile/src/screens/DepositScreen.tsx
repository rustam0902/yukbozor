import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, ActivityIndicator, Modal, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useDepositAccounts, useDepositTransactions, DepositAccount, DepositTransaction } from '../hooks/useDeposits';
import { formatPrice, formatDate } from '../constants/regions';

interface DepositScreenProps {
  navigation: any;
}

const accountTypeInfo = {
  main: { 
    iconName: 'wallet-outline' as const, 
    colorKey: 'primary' as const,
    descRu: 'Свободные средства',
    descUz: 'Erkin mablag\'lar'
  },
  blocked: { 
    iconName: 'lock-closed-outline' as const, 
    colorKey: 'warning' as const,
    descRu: 'Заблокировано для обеспечения',
    descUz: 'Ta\'minot uchun bloklangan'
  },
  in_transit: { 
    iconName: 'time-outline' as const, 
    colorKey: 'mutedForeground' as const,
    descRu: 'В процессе вывода',
    descUz: 'Chiqarish jarayonida'
  },
  partner_reward: { 
    iconName: 'gift-outline' as const, 
    colorKey: 'success' as const,
    descRu: 'Партнерское вознаграждение',
    descUz: 'Hamkorlik mukofoti'
  },
  registration_bonus: { 
    iconName: 'star-outline' as const, 
    colorKey: 'accent' as const,
    descRu: 'Бонус регистрации',
    descUz: 'Ro\'yxatdan o\'tish bonusi'
  },
};

export function DepositScreen({ navigation }: DepositScreenProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const colors = Colors.light;
  
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [expandedAccountShowAll, setExpandedAccountShowAll] = useState<Record<string, boolean>>({});
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<'all' | 'week' | 'month' | 'year'>('all');

  const transactionTypes = [
    { value: 'topup', labelRu: 'Пополнение', labelUz: 'To\'ldirish' },
    { value: 'block', labelRu: 'Блокировка', labelUz: 'Bloklash' },
    { value: 'unblock', labelRu: 'Разблокировка', labelUz: 'Blokdan chiqarish' },
    { value: 'charge_for_service', labelRu: 'Списание за услугу', labelUz: 'Xizmat uchun yechish' },
    { value: 'withdrawal_request', labelRu: 'Заявка на вывод', labelUz: 'Yechish so\'rovi' },
    { value: 'withdrawal_completed', labelRu: 'Вывод завершён', labelUz: 'Yechish tugadi' },
    { value: 'escrow_block', labelRu: 'Обеспечение', labelUz: 'Ta\'minot' },
    { value: 'escrow_release', labelRu: 'Освобождение', labelUz: 'Chiqarish' },
    { value: 'escrow_refund', labelRu: 'Возврат', labelUz: 'Qaytarish' },
    { value: 'transfer_out', labelRu: 'Перевод', labelUz: 'O\'tkazma' },
    { value: 'transfer_in', labelRu: 'Получение', labelUz: 'Qabul qilish' },
    { value: 'registration_bonus', labelRu: 'Бонус регистрации', labelUz: 'Ro\'yxatdan o\'tish bonusi' },
  ];

  const dateFilters = [
    { value: 'all' as const, labelRu: 'Все время', labelUz: 'Barcha vaqt' },
    { value: 'week' as const, labelRu: 'Неделя', labelUz: 'Hafta' },
    { value: 'month' as const, labelRu: 'Месяц', labelUz: 'Oy' },
    { value: 'year' as const, labelRu: 'Год', labelUz: 'Yil' },
  ];

  const filterTransactions = (txList: DepositTransaction[]) => {
    let filtered = txList;
    
    if (transactionTypeFilter) {
      filtered = filtered.filter(tx => tx.type === transactionTypeFilter);
    }
    
    if (dateFilter !== 'all') {
      const now = new Date();
      let startDate: Date;
      switch (dateFilter) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0);
      }
      filtered = filtered.filter(tx => new Date(tx.createdAt) >= startDate);
    }
    
    return filtered;
  };

  const hasActiveFilters = transactionTypeFilter !== null || dateFilter !== 'all';
  const activeFilterCount = (transactionTypeFilter ? 1 : 0) + (dateFilter !== 'all' ? 1 : 0);

  const bankDetails = {
    bankName: 'Ipak Yo\'li Bank',
    accountNumber: '20208000305547852001',
    mfo: '01158',
    inn: '310078152',
    companyName: 'YUKBOZOR MCHJ',
  };
  
  const { 
    data: accounts = [], 
    isLoading: loadingAccounts, 
    refetch: refetchAccounts,
    isRefetching: refetchingAccounts 
  } = useDepositAccounts();
  
  const { 
    data: transactions = [], 
    isLoading: loadingTransactions,
    refetch: refetchTransactions 
  } = useDepositTransactions(expandedAccount || undefined);
  
  const toggleAccount = useCallback((accountType: string) => {
    setExpandedAccount(prev => prev === accountType ? null : accountType);
  }, []);

  const onRefresh = useCallback(() => {
    refetchAccounts();
  }, [refetchAccounts]);

  const getTotalBalance = (): number => {
    return accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  };

  const getAccountBalance = (accountType: string): number => {
    const account = accounts.find(a => a.accountType === accountType);
    return account?.balance || 0;
  };

  const getAccountColor = (accountType: string) => {
    const info = accountTypeInfo[accountType as keyof typeof accountTypeInfo];
    return colors[info?.colorKey || 'primary'];
  };

  const getTransactionDescription = (tx: DepositTransaction): string => {
    if (tx.description) return tx.description;
    
    const types: Record<string, { ru: string; uz: string }> = {
      topup: { ru: 'Пополнение', uz: 'To\'ldirish' },
      block: { ru: 'Блокировка', uz: 'Bloklash' },
      unblock: { ru: 'Разблокировка', uz: 'Blokdan chiqarish' },
      charge_for_service: { ru: 'Списание за услугу', uz: 'Xizmat uchun yechish' },
      withdrawal_request: { ru: 'Заявка на вывод', uz: 'Yechish so\'rovi' },
      withdrawal_completed: { ru: 'Вывод завершён', uz: 'Yechish tugadi' },
      escrow_block: { ru: 'Обеспечение', uz: 'Ta\'minot' },
      escrow_release: { ru: 'Освобождение', uz: 'Chiqarish' },
      escrow_refund: { ru: 'Возврат', uz: 'Qaytarish' },
      transfer_out: { ru: 'Перевод', uz: 'O\'tkazma' },
      transfer_in: { ru: 'Получение', uz: 'Qabul qilish' },
      registration_bonus: { ru: 'Бонус регистрации', uz: 'Ro\'yxatdan o\'tish bonusi' },
    };
    
    return types[tx.type]?.[language] || tx.type;
  };

  const accountTypes = ['main', 'blocked', 'in_transit', 'partner_reward', 'registration_bonus'];

  if (loadingAccounts) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            {t.loading}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refetchingAccounts} 
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t.deposit}
          </Text>
        </View>

        <Card style={styles.totalCard}>
          <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>
            {language === 'ru' ? 'Общий баланс' : 'Umumiy balans'}
          </Text>
          <Text style={[styles.totalValue, { color: colors.foreground }]}>
            {formatPrice(getTotalBalance(), language)}
          </Text>
        </Card>

        <View style={styles.actions}>
          <Button
            title={t.topUp}
            onPress={() => setShowTopUpModal(true)}
            style={styles.actionButton}
            testID="button-top-up"
          />
          <Button
            title={t.withdraw}
            onPress={() => setShowWithdrawModal(true)}
            variant="outline"
            style={styles.actionButton}
            testID="button-withdraw"
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {language === 'ru' ? 'Счета' : 'Hisoblar'}
        </Text>

        {accountTypes.map((accountType) => {
          const info = accountTypeInfo[accountType as keyof typeof accountTypeInfo];
          const balance = getAccountBalance(accountType);
          const accountColor = getAccountColor(accountType);
          const isExpanded = expandedAccount === accountType;
          const accountTransactions = Array.isArray(transactions) ? transactions.filter(tx => tx.accountType === accountType) : [];
          
          return (
            <View key={accountType} style={styles.accountItemWrapper}>
              <Pressable 
                onPress={() => toggleAccount(accountType)}
                style={({ pressed }) => [
                  styles.accountTouchable,
                  { opacity: pressed ? 0.7 : 1 }
                ]}
              >
                <View style={[styles.accountCardView, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <View style={styles.accountRow}>
                    <View style={styles.accountInfo}>
                      <View style={[styles.accountIconContainer, { backgroundColor: accountColor + '20' }]}>
                        <Ionicons name={info.iconName} size={20} color={accountColor} />
                      </View>
                      <View style={styles.accountContent}>
                        <Text style={[styles.accountLabel, { color: colors.foreground }]}>
                          {language === 'ru' ? info.descRu : info.descUz}
                        </Text>
                        <Text style={[styles.accountBalance, { color: accountColor }]}>
                          {formatPrice(balance, language)}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.chevron, { color: colors.mutedForeground }]}>
                      {isExpanded ? '▼' : '▶'}
                    </Text>
                  </View>
                </View>
              </Pressable>

              {isExpanded && (
                <Card style={styles.historyCardExpanded}>
                  <View style={styles.historyHeader}>
                    <Text style={[styles.historyTitle, { color: colors.foreground }]}>
                      {language === 'ru' ? 'История операций' : 'Operatsiyalar tarixi'}
                    </Text>
                    <TouchableOpacity
                      style={[styles.filterButton, hasActiveFilters && { backgroundColor: colors.primary + '20' }]}
                      onPress={() => setShowFilterModal(true)}
                      testID="button-filter-transactions"
                    >
                      <Ionicons name="filter-outline" size={18} color={hasActiveFilters ? colors.primary : colors.mutedForeground} />
                      {activeFilterCount > 0 && (
                        <View style={[styles.filterBadge, { backgroundColor: colors.primary }]}>
                          <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                  
                  {loadingTransactions ? (
                    <View style={styles.loadingSmall}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  ) : (() => {
                    const filteredTx = filterTransactions(accountTransactions);
                    return filteredTx.length === 0 ? (
                      <Text style={[styles.emptyText, { color: colors.mutedForeground, marginTop: 8 }]}>
                        {hasActiveFilters 
                          ? (language === 'ru' ? 'Нет операций по фильтру' : 'Filtr bo\'yicha operatsiyalar yo\'q')
                          : (language === 'ru' ? 'Нет операций' : 'Operatsiyalar yo\'q')
                        }
                      </Text>
                    ) : (
                      <>
                        {filteredTx.slice(0, expandedAccountShowAll[accountType] ? undefined : 5).map((tx) => (
                          <View key={tx.id} style={styles.transactionItem}>
                            <View style={styles.transactionInfo}>
                              <Text style={[styles.transactionDesc, { color: colors.foreground }]}>
                                {getTransactionDescription(tx)}
                              </Text>
                              <Text style={[styles.transactionDate, { color: colors.mutedForeground }]}>
                                {formatDate(tx.createdAt, language)}
                              </Text>
                              {tx.relatedContractId && (
                                <Text style={[styles.transactionContract, { color: colors.mutedForeground }]}>
                                  {language === 'ru' ? 'Контракт' : 'Shartnoma'} #{tx.relatedContractId}
                                </Text>
                              )}
                            </View>
                            <Text style={[
                              styles.transactionAmount,
                              { color: tx.amount >= 0 ? colors.success : colors.destructive }
                            ]}>
                              {tx.amount >= 0 ? '+' : ''}{formatPrice(tx.amount, language)}
                            </Text>
                          </View>
                        ))}
                        {filteredTx.length > 5 && !expandedAccountShowAll[accountType] && (
                          <TouchableOpacity
                            style={styles.showMoreButton}
                            onPress={() => setExpandedAccountShowAll(prev => ({ ...prev, [accountType]: true }))}
                          >
                            <Text style={[styles.showMoreText, { color: colors.primary }]}>
                              {language === 'ru' ? `Показать все (${filteredTx.length})` : `Hammasini ko'rsatish (${filteredTx.length})`}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </>
                    );
                  })()}
                </Card>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Top Up Modal */}
      <Modal
        visible={showTopUpModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTopUpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {language === 'ru' ? 'Пополнение депозита' : 'Depozitni to\'ldirish'}
              </Text>
              <TouchableOpacity onPress={() => setShowTopUpModal(false)} testID="button-close-topup">
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalDescription, { color: colors.mutedForeground }]}>
              {language === 'ru' 
                ? 'Для пополнения депозита переведите средства на следующие реквизиты. В назначении платежа укажите ваш номер телефона.'
                : 'Depozitni to\'ldirish uchun quyidagi rekvizitlarga pul o\'tkazing. To\'lov maqsadida telefon raqamingizni ko\'rsating.'}
            </Text>

            <View style={styles.bankDetailsContainer}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
                  {language === 'ru' ? 'Банк' : 'Bank'}
                </Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>
                  {bankDetails.bankName}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
                  {language === 'ru' ? 'Расчётный счёт' : 'Hisob raqami'}
                </Text>
                <TouchableOpacity 
                  style={styles.copyRow}
                  onPress={async () => {
                    await Clipboard.setStringAsync(bankDetails.accountNumber);
                    Alert.alert('', language === 'ru' ? 'Скопировано' : 'Nusxalandi');
                  }}
                  testID="button-copy-account"
                >
                  <Text style={[styles.detailValue, { color: colors.foreground }]}>
                    {bankDetails.accountNumber}
                  </Text>
                  <Ionicons name="copy-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
                  {language === 'ru' ? 'МФО' : 'MFO'}
                </Text>
                <TouchableOpacity 
                  style={styles.copyRow}
                  onPress={async () => {
                    await Clipboard.setStringAsync(bankDetails.mfo);
                    Alert.alert('', language === 'ru' ? 'Скопировано' : 'Nusxalandi');
                  }}
                  testID="button-copy-mfo"
                >
                  <Text style={[styles.detailValue, { color: colors.foreground }]}>
                    {bankDetails.mfo}
                  </Text>
                  <Ionicons name="copy-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
                  {language === 'ru' ? 'ИНН' : 'INN'}
                </Text>
                <TouchableOpacity 
                  style={styles.copyRow}
                  onPress={async () => {
                    await Clipboard.setStringAsync(bankDetails.inn);
                    Alert.alert('', language === 'ru' ? 'Скопировано' : 'Nusxalandi');
                  }}
                  testID="button-copy-inn"
                >
                  <Text style={[styles.detailValue, { color: colors.foreground }]}>
                    {bankDetails.inn}
                  </Text>
                  <Ionicons name="copy-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
                  {language === 'ru' ? 'Получатель' : 'Oluvchi'}
                </Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>
                  {bankDetails.companyName}
                </Text>
              </View>
            </View>

            <View style={[styles.warningBox, { backgroundColor: colors.warning + '20' }]}>
              <Ionicons name="warning-outline" size={20} color={colors.warning} />
              <Text style={[styles.warningText, { color: colors.foreground }]}>
                {language === 'ru'
                  ? `Укажите в назначении: ${user?.phone || 'ваш номер телефона'}`
                  : `To\'lov maqsadida ko\'rsating: ${user?.phone || 'telefon raqamingiz'}`}
              </Text>
            </View>

            <Button
              title={language === 'ru' ? 'Закрыть' : 'Yopish'}
              onPress={() => setShowTopUpModal(false)}
              style={{ marginTop: 16 }}
              testID="button-close-topup-modal"
            />
          </View>
        </View>
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        visible={showWithdrawModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowWithdrawModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {language === 'ru' ? 'Вывод средств' : 'Mablag\' yechish'}
              </Text>
              <TouchableOpacity onPress={() => setShowWithdrawModal(false)} testID="button-close-withdraw">
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalDescription, { color: colors.mutedForeground }]}>
              {language === 'ru' 
                ? 'Для вывода средств свяжитесь с поддержкой или отправьте заявку через личный кабинет на сайте.'
                : 'Mablag\'ni yechish uchun qo\'llab-quvvatlash xizmati bilan bog\'laning yoki saytdagi shaxsiy kabinetingiz orqali ariza yuboring.'}
            </Text>

            <View style={[styles.infoBox, { backgroundColor: colors.primary + '10' }]}>
              <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.foreground }]}>
                {language === 'ru'
                  ? 'Вывод доступен только с основного счёта. Минимальная сумма вывода: 100 000 сум.'
                  : 'Yechish faqat asosiy hisobdan mumkin. Minimal yechish summasi: 100 000 so\'m.'}
              </Text>
            </View>

            <Button
              title={language === 'ru' ? 'Закрыть' : 'Yopish'}
              onPress={() => setShowWithdrawModal(false)}
              style={{ marginTop: 16 }}
              testID="button-close-withdraw-modal"
            />
          </View>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {language === 'ru' ? 'Фильтры' : 'Filtrlar'}
              </Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)} testID="button-close-filter">
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.filterSectionTitle, { color: colors.foreground }]}>
              {language === 'ru' ? 'Тип операции' : 'Operatsiya turi'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChipsContainer}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { borderColor: colors.border },
                  transactionTypeFilter === null && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => setTransactionTypeFilter(null)}
              >
                <Text style={[
                  styles.filterChipText,
                  { color: transactionTypeFilter === null ? colors.primaryForeground : colors.foreground }
                ]}>
                  {language === 'ru' ? 'Все' : 'Hammasi'}
                </Text>
              </TouchableOpacity>
              {transactionTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.filterChip,
                    { borderColor: colors.border },
                    transactionTypeFilter === type.value && { backgroundColor: colors.primary, borderColor: colors.primary }
                  ]}
                  onPress={() => setTransactionTypeFilter(type.value)}
                >
                  <Text style={[
                    styles.filterChipText,
                    { color: transactionTypeFilter === type.value ? colors.primaryForeground : colors.foreground }
                  ]}>
                    {language === 'ru' ? type.labelRu : type.labelUz}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.filterSectionTitle, { color: colors.foreground, marginTop: 16 }]}>
              {language === 'ru' ? 'Период' : 'Davr'}
            </Text>
            <View style={styles.dateFilterRow}>
              {dateFilters.map((filter) => (
                <TouchableOpacity
                  key={filter.value}
                  style={[
                    styles.dateFilterButton,
                    { borderColor: colors.border },
                    dateFilter === filter.value && { backgroundColor: colors.primary, borderColor: colors.primary }
                  ]}
                  onPress={() => setDateFilter(filter.value)}
                >
                  <Text style={[
                    styles.dateFilterText,
                    { color: dateFilter === filter.value ? colors.primaryForeground : colors.foreground }
                  ]}>
                    {language === 'ru' ? filter.labelRu : filter.labelUz}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.filterActions}>
              <Button
                title={language === 'ru' ? 'Сбросить' : 'Tozalash'}
                onPress={() => {
                  setTransactionTypeFilter(null);
                  setDateFilter('all');
                }}
                variant="outline"
                style={styles.filterActionButton}
              />
              <Button
                title={language === 'ru' ? 'Применить' : 'Qo\'llash'}
                onPress={() => setShowFilterModal(false)}
                style={styles.filterActionButton}
                testID="button-apply-filter"
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  totalCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  accountItemWrapper: {
    marginBottom: 12,
  },
  accountTouchable: {
    width: '100%',
  },
  accountCardView: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accountContent: {
    flex: 1,
  },
  accountIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accountLabel: {
    fontSize: 14,
  },
  accountBalance: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  chevron: {
    fontSize: 12,
    marginLeft: 8,
  },
  historyCardExpanded: {
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  transactionInfo: {
    flex: 1,
    marginRight: 12,
  },
  transactionDesc: {
    fontSize: 13,
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 11,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
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
  loadingSmall: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  bankDetailsContainer: {
    marginBottom: 16,
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterButton: {
    padding: 8,
    borderRadius: 8,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  transactionContract: {
    fontSize: 10,
    marginTop: 2,
  },
  showMoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '500',
  },
  filterSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  filterChipsContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  dateFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    alignItems: 'center',
  },
  dateFilterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  filterActionButton: {
    flex: 1,
  },
});
