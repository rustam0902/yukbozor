import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, Alert, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useMyContracts, usePublicContracts, useInitiateTermination, useConfirmTermination, useCancelTermination, Contract } from '../hooks/useContracts';
import { getRegionName, getContractStatusName, getContractStatusColor, formatPrice, formatDate } from '../constants/regions';
import { localizeLoadingTime } from '../utils/loadingTimeUtils';

interface DealsScreenProps {
  navigation: any;
}

type TabType = 'my' | 'public';

export function DealsScreen({ navigation }: DealsScreenProps) {
  const { t, language } = useLanguage();
  const { user, activeRole } = useAuth();
  const colors = Colors.light;
  
  const [activeTab, setActiveTab] = useState<TabType>('my');
  const [terminationModalVisible, setTerminationModalVisible] = useState(false);
  const [terminationContractId, setTerminationContractId] = useState<number | null>(null);
  
  const { 
    data: myContracts = [], 
    isLoading: loadingMy, 
    refetch: refetchMy,
    isRefetching: refetchingMy,
    isError: errorMy
  } = useMyContracts(activeRole || undefined);
  
  const { 
    data: publicContracts = [], 
    isLoading: loadingPublic, 
    refetch: refetchPublic,
    isRefetching: refetchingPublic,
    isError: errorPublic
  } = usePublicContracts();

  const initiateTermination = useInitiateTermination();
  const confirmTermination = useConfirmTermination();
  const cancelTermination = useCancelTermination();

  const onRefresh = useCallback(() => {
    if (activeTab === 'my') {
      refetchMy();
    } else {
      refetchPublic();
    }
  }, [activeTab, refetchMy, refetchPublic]);

  const handleInitiateTermination = (contractId: number) => {
    setTerminationContractId(contractId);
    setTerminationModalVisible(true);
  };

  const handleSelectPenalty = (penaltyType: string) => {
    if (!terminationContractId) return;
    const contractId = terminationContractId;
    setTerminationModalVisible(false);
    setTerminationContractId(null);
    initiateTermination.mutate({ contractId, penaltyType }, {
      onError: (err: any) => {
        Alert.alert(
          language === 'ru' ? 'Ошибка' : 'Xato',
          err?.response?.data?.error || (language === 'ru' ? 'Не удалось инициировать расторжение' : 'Xato yuz berdi')
        );
      }
    });
  };

  const handleConfirmTermination = (contractId: number) => {
    Alert.alert(
      language === 'ru' ? 'Принять расторжение' : 'Bekor qilishni tasdiqlash',
      language === 'ru' ? 'Вы уверены, что хотите подтвердить расторжение договора?' : 'Shartnomani bekor qilishni tasdiqlaysizmi?',
      [
        { text: language === 'ru' ? 'Отмена' : 'Bekor qilish', style: 'cancel' },
        {
          text: language === 'ru' ? 'Принять' : 'Tasdiqlash',
          onPress: () => {
            confirmTermination.mutate(contractId, {
              onError: (err: any) => {
                Alert.alert(
                  language === 'ru' ? 'Ошибка' : 'Xato',
                  err?.response?.data?.error || (language === 'ru' ? 'Не удалось подтвердить расторжение' : 'Xato yuz berdi')
                );
              }
            });
          },
        },
      ]
    );
  };

  const handleCancelTermination = (contractId: number) => {
    Alert.alert(
      language === 'ru' ? 'Отменить расторжение' : 'Bekor qilishni rad etish',
      language === 'ru' ? 'Отменить инициированное расторжение договора?' : 'Bekor qilishni rad etasizmi?',
      [
        { text: language === 'ru' ? 'Нет' : 'Yo\'q', style: 'cancel' },
        {
          text: language === 'ru' ? 'Да, отменить' : 'Ha, rad etish',
          onPress: () => {
            cancelTermination.mutate(contractId, {
              onError: (err: any) => {
                Alert.alert(
                  language === 'ru' ? 'Ошибка' : 'Xato',
                  err?.response?.data?.error || (language === 'ru' ? 'Не удалось отменить расторжение' : 'Xato yuz berdi')
                );
              }
            });
          },
        },
      ]
    );
  };

  const getRouteDisplay = (contract: Contract): string => {
    if (!contract.order) return '';
    return `${getRegionName(contract.order.originRegion, language)} → ${getRegionName(contract.order.destinationRegion, language)}`;
  };

  const getPartyLabel = (contract: Contract, isPublicView: boolean): string => {
    if (isPublicView) {
      return language === 'ru' ? 'Перевозчик' : 'Tashuvchi';
    }
    if (contract.customerId === user?.id) {
      return language === 'ru' ? 'Перевозчик' : 'Tashuvchi';
    }
    return language === 'ru' ? 'Заказчик' : 'Buyurtmachi';
  };

  const getPartyName = (contract: Contract, isPublicView: boolean): string => {
    if (isPublicView) {
      return contract.carrierName || '';
    }
    if (contract.customerId === user?.id) {
      return contract.carrierName || '';
    }
    return contract.customerName || '';
  };

  const canSign = (contract: Contract): boolean => {
    if (!user) return false;
    const isCustomer = contract.customerId === user.id;
    const isCarrier = contract.carrierId === user.id;
    
    if (!isCustomer && !isCarrier) return false;
    
    const signature = isCustomer ? contract.customerSignature : contract.carrierSignature;
    if (signature && !signature.startsWith('AUTO_SIGNED_')) return false;
    
    return ['pending', 'awaiting_prepayment', 'fully_signed'].includes(contract.status);
  };

  const isPublicView = activeTab === 'public';

  const renderDealItem = ({ item }: { item: Contract }) => {
    const statusColor = getContractStatusColor(item.status);
    const showSignButton = !isPublicView && canSign(item);
    
    return (
      <TouchableOpacity 
        activeOpacity={0.7}
        onPress={() => {
          if (!isPublicView) {
            navigation.navigate('ContractDetail', { contractId: item.id });
          }
        }}
        testID={`deal-card-${item.id}`}
      >
        <Card style={styles.dealCard}>
          <View style={styles.dealHeader}>
            <Text style={[styles.dealNumber, { color: colors.foreground }]}>
              {language === 'ru' ? 'Договор' : 'Shartnoma'} #{item.id}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {getContractStatusName(item.status, language)}
              </Text>
            </View>
          </View>
          
          {item.order && (
            <>
              <Text style={[styles.orderTitle, { color: colors.foreground }]} numberOfLines={2}>
                {item.order.title}
              </Text>
              
              <Text style={[styles.dealRoute, { color: colors.mutedForeground }]} numberOfLines={1}>
                {getRouteDisplay(item)}
              </Text>
            </>
          )}
          
          <View style={styles.dealDetails}>
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
                {getPartyLabel(item, isPublicView)}
              </Text>
              <Text style={[styles.detailValue, { color: colors.foreground }]} numberOfLines={1}>
                {getPartyName(item, isPublicView)}
              </Text>
            </View>
            
            {item.order?.loadingDate && (
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
                  {language === 'ru' ? 'Дата погрузки' : 'Yuklash sanasi'}
                </Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>
                  {formatDate(item.order.loadingDate, language)}{item.order.loadingTime ? `, ${localizeLoadingTime(item.order.loadingTime, language)}` : ''}
                </Text>
              </View>
            )}
            
            {item.signedAt && (
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
                  {language === 'ru' ? 'Подписан' : 'Imzolangan'}
                </Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>
                  {formatDate(item.signedAt, language)}
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.dealFooter}>
            <Text style={[styles.dealPrice, { color: colors.primary }]}>
              {formatPrice(item.price, language)}
            </Text>
            
            {showSignButton ? (
              <View style={[styles.signBadge, { backgroundColor: colors.warning + '20' }]}>
                <Text style={[styles.signBadgeText, { color: colors.warning }]}>
                  {language === 'ru' ? 'Требует подписи' : 'Imzo kerak'}
                </Text>
              </View>
            ) : (
              <Text style={[styles.orderRef, { color: colors.mutedForeground }]}>
                {language === 'ru' ? 'Заказ' : 'Buyurtma'} #{item.orderId}
              </Text>
            )}
          </View>

          {!isPublicView && user && (() => {
            const isTerminationPending = item.status === 'termination_pending';
            const isInitiator = item.terminationInitiatedBy === user.id;
            const canInitiate = !['terminated', 'cancelled', 'termination_pending', 'completed'].includes(item.status);
            const isTermMutating = initiateTermination.isPending || confirmTermination.isPending || cancelTermination.isPending;

            if (!isTerminationPending && !canInitiate) return null;

            return (
              <View style={styles.terminationRow}>
                {canInitiate && (
                  <TouchableOpacity
                    style={[styles.terminationButton, { borderColor: '#EF4444' }]}
                    onPress={() => handleInitiateTermination(item.id)}
                    disabled={isTermMutating}
                    testID={`button-terminate-contract-${item.id}`}
                  >
                    {isTermMutating && initiateTermination.isPending ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <Text style={[styles.terminationButtonText, { color: '#EF4444' }]}>
                        {language === 'ru' ? 'Расторгнуть договор' : 'Shartnomani bekor qilish'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
                {isTerminationPending && !isInitiator && (
                  <TouchableOpacity
                    style={[styles.terminationButton, { borderColor: '#EF4444' }]}
                    onPress={() => handleConfirmTermination(item.id)}
                    disabled={isTermMutating}
                    testID={`button-confirm-termination-${item.id}`}
                  >
                    {confirmTermination.isPending ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <Text style={[styles.terminationButtonText, { color: '#EF4444' }]}>
                        {language === 'ru' ? 'Принять расторжение' : 'Bekor qilishni tasdiqlash'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
                {isTerminationPending && isInitiator && (
                  <TouchableOpacity
                    style={[styles.terminationButton, { borderColor: '#6B7280' }]}
                    onPress={() => handleCancelTermination(item.id)}
                    disabled={isTermMutating}
                    testID={`button-cancel-termination-${item.id}`}
                  >
                    {cancelTermination.isPending ? (
                      <ActivityIndicator size="small" color="#6B7280" />
                    ) : (
                      <Text style={[styles.terminationButtonText, { color: '#6B7280' }]}>
                        {language === 'ru' ? 'Отменить расторжение' : 'Bekor qilishni rad etish'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}
        </Card>
      </TouchableOpacity>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={48} color={colors.mutedForeground} />
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
        {activeTab === 'my' 
          ? (language === 'ru' ? 'У вас нет сделок' : 'Sizda bitimlar yo\'q')
          : (language === 'ru' ? 'Нет публичных сделок' : 'Ommaviy bitimlar yo\'q')
        }
      </Text>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="alert-circle-outline" size={48} color="#f59e0b" />
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
        {language === 'ru' 
          ? 'Не удалось загрузить данные. Проверьте подключение к интернету.'
          : 'Ma\'lumotlarni yuklashda xatolik. Internet ulanishini tekshiring.'}
      </Text>
      <TouchableOpacity
        style={[styles.retryButton, { backgroundColor: colors.primary }]}
        onPress={onRefresh}
      >
        <Text style={styles.retryButtonText}>
          {language === 'ru' ? 'Повторить' : 'Qayta urinish'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const isLoading = activeTab === 'my' ? loadingMy : loadingPublic;
  const hasError = activeTab === 'my' ? errorMy : errorPublic;
  const isRefetching = activeTab === 'my' ? refetchingMy : refetchingPublic;
  const contracts = activeTab === 'my' ? myContracts : publicContracts;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {t.deals}
        </Text>
      </View>
      
      {/* Tabs */}
      <View style={[styles.tabContainer, { borderColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'my' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
          ]}
          onPress={() => setActiveTab('my')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'my' ? colors.primary : colors.mutedForeground }
          ]}>
            {language === 'ru' ? 'Мои сделки' : 'Mening bitimlarim'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'public' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
          ]}
          onPress={() => setActiveTab('public')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'public' ? colors.primary : colors.mutedForeground }
          ]}>
            {language === 'ru' ? 'Публичные' : 'Ommaviy'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            {t.loading}
          </Text>
        </View>
      ) : hasError ? (
        renderErrorState()
      ) : (
        <FlatList
          data={contracts}
          keyExtractor={(item) => String(item.id || Math.random())}
          renderItem={renderDealItem}
          ListEmptyComponent={renderEmptyList}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl 
              refreshing={isRefetching} 
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
        />
      )}
      <Modal
        visible={terminationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTerminationModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setTerminationModalVisible(false)}
        >
          <Pressable style={[styles.terminationModal, { backgroundColor: colors.card }]}>
            <Text style={[styles.terminationModalTitle, { color: colors.foreground }]}>
              {language === 'ru' ? 'Расторжение договора' : 'Shartnomani bekor qilish'}
            </Text>
            <Text style={[styles.terminationModalSubtitle, { color: colors.mutedForeground }]}>
              {language === 'ru' ? 'Выберите условие расторжения:' : 'Bekor qilish shartini tanlang:'}
            </Text>

            <TouchableOpacity
              style={[styles.penaltyOption, { borderColor: colors.border }]}
              onPress={() => handleSelectPenalty('no_penalty')}
              disabled={initiateTermination.isPending}
            >
              <Text style={[styles.penaltyOptionText, { color: colors.foreground }]}>
                {language === 'ru' ? 'Без штрафных санкций' : 'Jarimasiz'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.penaltyOption, { borderColor: colors.border }]}
              onPress={() => handleSelectPenalty('penalty_customer')}
              disabled={initiateTermination.isPending}
            >
              <Text style={[styles.penaltyOptionText, { color: '#EF4444' }]}>
                {language === 'ru' ? 'Штраф заказчику' : 'Buyurtmachiga jarima'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.penaltyOption, { borderColor: colors.border }]}
              onPress={() => handleSelectPenalty('penalty_carrier')}
              disabled={initiateTermination.isPending}
            >
              <Text style={[styles.penaltyOptionText, { color: '#EF4444' }]}>
                {language === 'ru' ? 'Штраф перевозчику' : 'Tashuvchiga jarima'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.terminationCloseBtn, { borderColor: colors.border }]}
              onPress={() => setTerminationModalVisible(false)}
            >
              <Text style={[styles.terminationCloseBtnText, { color: colors.mutedForeground }]}>
                {language === 'ru' ? 'Закрыть' : 'Yopish'}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  dealCard: {
    marginBottom: 12,
  },
  dealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dealNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  dealRoute: {
    fontSize: 14,
    marginBottom: 12,
  },
  dealDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  detailItem: {
    marginRight: 16,
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  dealFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  dealPrice: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  orderRef: {
    fontSize: 12,
  },
  signBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  signBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
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
  terminationRow: {
    marginTop: 10,
    gap: 8,
  },
  terminationButton: {
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  terminationButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  terminationModal: {
    width: '100%',
    borderRadius: 12,
    padding: 20,
    gap: 10,
  },
  terminationModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  terminationModalSubtitle: {
    fontSize: 13,
    marginBottom: 6,
  },
  penaltyOption: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  penaltyOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  terminationCloseBtn: {
    marginTop: 4,
    paddingVertical: 13,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  terminationCloseBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
