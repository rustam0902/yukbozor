import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useMyOffers, useWithdrawOffer } from '../hooks/useOffers';
import { formatPrice, formatDate, getRegionName, getTransportTypeName } from '../constants/regions';
import { localizeLoadingTime } from '../utils/loadingTimeUtils';

interface MyOffersScreenProps {
  navigation: any;
}

const getOfferStatusName = (status: string, language: 'ru' | 'uz'): string => {
  const statuses: Record<string, { ru: string; uz: string }> = {
    active: { ru: 'На рассмотрении', uz: 'Ko\'rib chiqilmoqda' },
    pending: { ru: 'На рассмотрении', uz: 'Ko\'rib chiqilmoqda' },
    accepted: { ru: 'Принято', uz: 'Qabul qilindi' },
    rejected: { ru: 'Отклонено', uz: 'Rad etildi' },
    cancelled: { ru: 'Отменено', uz: 'Bekor qilindi' },
    withdrawn: { ru: 'Отозвано', uz: 'Qaytarib olindi' },
  };
  return statuses[status]?.[language] || status;
};

const getOfferStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    active: '#F59E0B',
    pending: '#F59E0B',
    accepted: '#10B981',
    rejected: '#EF4444',
    cancelled: '#6B7280',
    withdrawn: '#6B7280',
  };
  return colors[status] || '#6B7280';
};

export function MyOffersScreen({ navigation }: MyOffersScreenProps) {
  const { language } = useLanguage();
  const colors = Colors.light;
  const [expandedOfferId, setExpandedOfferId] = useState<number | null>(null);

  const {
    data: offers = [],
    isLoading,
    refetch,
    isRefetching
  } = useMyOffers();

  const withdrawMutation = useWithdrawOffer();

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const toggleExpand = (id: number) => {
    setExpandedOfferId(prev => prev === id ? null : id);
  };

  const handleWithdraw = (offerId: number) => {
    Alert.alert(
      language === 'ru' ? 'Отозвать предложение' : 'Taklifni qaytarib olish',
      language === 'ru'
        ? 'Вы уверены, что хотите отозвать это предложение? Залог будет возвращён на основной счёт.'
        : 'Ushbu taklifni qaytarib olishni istaysizmi? Garov asosiy hisobga qaytariladi.',
      [
        { text: language === 'ru' ? 'Отмена' : 'Bekor qilish', style: 'cancel' },
        {
          text: language === 'ru' ? 'Отозвать' : 'Qaytarib olish',
          style: 'destructive',
          onPress: () => {
            withdrawMutation.mutate(offerId, {
              onError: (err: any) => {
                Alert.alert(
                  language === 'ru' ? 'Ошибка' : 'Xato',
                  err?.response?.data?.error || (language === 'ru' ? 'Не удалось отозвать предложение' : 'Taklifni qaytarib olishda xato')
                );
              }
            });
          },
        },
      ]
    );
  };

  const pendingOffers = offers.filter(o => o.status === 'active' || o.status === 'pending');
  const acceptedOffers = offers.filter(o => o.status === 'accepted');
  const withdrawnOffers = offers.filter(o => o.status === 'withdrawn');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {language === 'ru' ? 'Мои предложения' : 'Mening takliflarim'}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statBadge, { backgroundColor: '#F59E0B20' }]}>
          <Text style={[styles.statValue, { color: '#F59E0B' }]}>{pendingOffers.length}</Text>
          <Text style={[styles.statLabel, { color: '#F59E0B' }]}>
            {language === 'ru' ? 'Ожидает' : 'Kutilmoqda'}
          </Text>
        </View>
        <View style={[styles.statBadge, { backgroundColor: '#10B98120' }]}>
          <Text style={[styles.statValue, { color: '#10B981' }]}>{acceptedOffers.length}</Text>
          <Text style={[styles.statLabel, { color: '#10B981' }]}>
            {language === 'ru' ? 'Принято' : 'Qabul'}
          </Text>
        </View>
        {withdrawnOffers.length > 0 && (
          <View style={[styles.statBadge, { backgroundColor: '#6B728020' }]}>
            <Text style={[styles.statValue, { color: '#6B7280' }]}>{withdrawnOffers.length}</Text>
            <Text style={[styles.statLabel, { color: '#6B7280' }]}>
              {language === 'ru' ? 'Отозвано' : 'Qaytarildi'}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
      >
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : offers.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {language === 'ru' ? 'У вас пока нет предложений' : 'Sizda hali takliflar yo\'q'}
            </Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              {language === 'ru'
                ? 'Найдите подходящий заказ и отправьте своё предложение'
                : 'Mos buyurtmani toping va taklifingizni yuboring'}
            </Text>
          </Card>
        ) : (
          offers.map((offer) => {
            const isExpanded = expandedOfferId === offer.id;
            return (
              <TouchableOpacity
                key={offer.id}
                activeOpacity={0.85}
                onPress={() => toggleExpand(offer.id)}
                testID={`card-offer-${offer.id}`}
              >
                <Card style={styles.offerCard}>
                  <View style={styles.offerHeader}>
                    <View style={styles.offerHeaderLeft}>
                      <Text style={[styles.orderId, { color: colors.foreground }]}>
                        {language === 'ru' ? 'Заказ' : 'Buyurtma'} #{offer.orderId}
                      </Text>
                      <Text style={[styles.offerDate, { color: colors.mutedForeground }]}>
                        {formatDate(offer.createdAt, language)}
                      </Text>
                    </View>
                    <View style={styles.offerHeaderRight}>
                      <View style={[styles.statusBadge, { backgroundColor: getOfferStatusColor(offer.status) + '20' }]}>
                        <Text style={[styles.statusText, { color: getOfferStatusColor(offer.status) }]}>
                          {getOfferStatusName(offer.status, language)}
                        </Text>
                      </View>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={colors.mutedForeground}
                        style={styles.chevron}
                      />
                    </View>
                  </View>

                  {offer.order && (
                    <View style={[styles.orderRoute, { borderBottomColor: colors.border }]}>
                      <View style={styles.routePoint}>
                        <Ionicons name="location" size={16} color={colors.primary} />
                        <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
                          {getRegionName(offer.order.originRegion, language)}
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={16} color={colors.mutedForeground} />
                      <View style={styles.routePoint}>
                        <Ionicons name="location" size={16} color={colors.success} />
                        <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
                          {getRegionName(offer.order.destinationRegion, language)}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.priceRow}>
                    <View>
                      <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>
                        {language === 'ru' ? 'Ваше предложение' : 'Sizning taklifingiz'}
                      </Text>
                      <Text style={[styles.priceValue, { color: colors.primary }]}>
                        {formatPrice(offer.price, language)}
                      </Text>
                      {offer.priceWithoutVat && offer.priceWithoutVat !== offer.price && (
                        <Text style={[styles.priceWithoutVat, { color: colors.mutedForeground }]}>
                          {language === 'ru' ? 'Без НДС:' : 'QQSsiz:'} {formatPrice(offer.priceWithoutVat, language)}
                        </Text>
                      )}
                    </View>
                  </View>

                  {isExpanded && (
                    <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
                      {offer.order && (offer.order.transportType || offer.order.loadDate || offer.order.loadingDate) && (
                        <View style={styles.detailsRow}>
                          {offer.order.transportType && (
                            <View style={[styles.detailChip, { backgroundColor: colors.card }]}>
                              <Ionicons name="car-outline" size={13} color={colors.mutedForeground} />
                              <Text style={[styles.detailChipText, { color: colors.mutedForeground }]}>
                                {getTransportTypeName(offer.order.transportType, language)}
                              </Text>
                            </View>
                          )}
                          {(offer.order.loadDate || offer.order.loadingDate) && (
                            <View style={[styles.detailChip, { backgroundColor: colors.card }]}>
                              <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
                              <Text style={[styles.detailChipText, { color: colors.mutedForeground }]}>
                                {formatDate(offer.order.loadDate || offer.order.loadingDate, language)}{(offer.order as any).loadingTime ? `, ${localizeLoadingTime((offer.order as any).loadingTime, language)}` : ''}
                              </Text>
                            </View>
                          )}
                          {offer.blockedAmount > 0 && (
                            <View style={[styles.detailChip, { backgroundColor: colors.card }]}>
                              <Ionicons name="lock-closed-outline" size={13} color={colors.mutedForeground} />
                              <Text style={[styles.detailChipText, { color: colors.mutedForeground }]}>
                                {formatPrice(offer.blockedAmount, language)}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      {offer.comment && (
                        <View style={[styles.commentBox, { backgroundColor: colors.card }]}>
                          <Text style={[styles.commentLabel, { color: colors.mutedForeground }]}>
                            {language === 'ru' ? 'Комментарий' : 'Izoh'}
                          </Text>
                          <Text style={[styles.commentText, { color: colors.foreground }]}>
                            {offer.comment}
                          </Text>
                        </View>
                      )}

                      {offer.status === 'active' && (
                        <TouchableOpacity
                          style={[styles.withdrawButton, { borderColor: '#EF4444' }]}
                          onPress={() => handleWithdraw(offer.id)}
                          disabled={withdrawMutation.isPending}
                          testID={`button-withdraw-offer-${offer.id}`}
                        >
                          {withdrawMutation.isPending ? (
                            <ActivityIndicator size="small" color="#EF4444" />
                          ) : (
                            <Text style={[styles.withdrawButtonText, { color: '#EF4444' }]}>
                              {language === 'ru' ? 'Отозвать предложение' : 'Taklifni qaytarib olish'}
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </Card>
              </TouchableOpacity>
            );
          })
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
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
  },
  loader: {
    marginVertical: 40,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptyHint: {
    fontSize: 14,
    textAlign: 'center',
  },
  offerCard: {
    padding: 16,
    marginBottom: 12,
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  offerHeaderLeft: {
    flex: 1,
  },
  offerHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chevron: {
    marginLeft: 4,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '600',
  },
  offerDate: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  orderRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  routePoint: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  routeText: {
    fontSize: 13,
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 12,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  priceWithoutVat: {
    fontSize: 12,
    marginTop: 2,
  },
  expandedSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  detailChipText: {
    fontSize: 12,
  },
  commentBox: {
    padding: 10,
    borderRadius: 8,
    gap: 4,
  },
  commentLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  commentText: {
    fontSize: 13,
    lineHeight: 18,
  },
  withdrawButton: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  withdrawButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
