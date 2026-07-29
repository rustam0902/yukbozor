import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { trackEvent } from '../services/analytics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { PhotoGallery } from '../components/PhotoGallery';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useOrder } from '../hooks/useOrders';
import { useOrderOffers, useCreateOffer, useAcceptOffer, useRejectOffer, Offer } from '../hooks/useOffers';
import { formatPrice, formatDate, getRegionName, getOrderStatusName, getOrderStatusColor, getTransportTypeName, getDistrictName } from '../constants/regions';
import { localizeLoadingTime } from '../utils/loadingTimeUtils';

interface OrderDetailScreenProps {
  navigation: any;
  route: {
    params: {
      orderId: number;
    };
  };
}

const getOfferStatusName = (status: string, language: 'ru' | 'uz'): string => {
  const statuses: Record<string, { ru: string; uz: string }> = {
    active: { ru: 'На рассмотрении', uz: 'Ko\'rib chiqilmoqda' },
    accepted: { ru: 'Принято', uz: 'Qabul qilindi' },
    rejected: { ru: 'Отклонено', uz: 'Rad etildi' },
    withdrawn: { ru: 'Отозвано', uz: 'Qaytarib olindi' },
  };
  return statuses[status]?.[language] || status;
};

const getOfferStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    active: '#F59E0B',
    accepted: '#10B981',
    rejected: '#EF4444',
    withdrawn: '#6B7280',
  };
  return colors[status] || '#6B7280';
};

export function OrderDetailScreen({ navigation, route }: OrderDetailScreenProps) {
  const { orderId } = route.params;
  const { language } = useLanguage();
  const { user } = useAuth();
  const colors = Colors.light;

  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerComment, setOfferComment] = useState('');

  const parsePrice = (price: string): number => {
    const normalized = price.replace(/,/g, '.').replace(/\s/g, '');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
  };

  const handlePriceInput = (value: string): string => {
    let v = value.replace(/,/g, '.');
    v = v.replace(/[^\d.]/g, '');
    const parts = v.split('.');
    if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
    if (v.includes('.')) {
      const [int, dec] = v.split('.');
      v = int + '.' + dec.slice(0, 2);
    }
    return v;
  };

  const { data: order, isLoading, error, refetch } = useOrder(orderId);
  const { data: offers = [], isLoading: loadingOffers, refetch: refetchOffers } = useOrderOffers(orderId);
  
  const createOfferMutation = useCreateOffer();
  const acceptOfferMutation = useAcceptOffer();
  const rejectOfferMutation = useRejectOffer();

  const isCustomer = user?.roles?.includes('customer');
  const isCarrier = user?.roles?.includes('carrier');
  const isOwner = order?.customerId === user?.id;
  const canMakeOffer = isCarrier && !isOwner && (order?.status === 'new' || order?.status === 'active');
  const hasMyOffer = offers.some(o => o.carrierId === user?.id);

  const handleSubmitOffer = async () => {
    if (!offerPrice) {
      Alert.alert(
        language === 'ru' ? 'Ошибка' : 'Xato',
        language === 'ru' ? 'Укажите цену' : 'Narxni kiriting'
      );
      return;
    }

    try {
      const priceNum = parsePrice(offerPrice);
      if (priceNum <= 0) {
        Alert.alert(
          language === 'ru' ? 'Ошибка' : 'Xato',
          language === 'ru' ? 'Укажите корректную цену' : 'To\'g\'ri narx kiriting'
        );
        return;
      }
      const priceWithoutVat = user?.ndsPayer
        ? parseFloat((priceNum / 1.12).toFixed(2))
        : priceNum;
      await createOfferMutation.mutateAsync({
        orderId,
        carrierId: user!.id,
        price: priceNum,
        priceWithoutVat,
      });
      trackEvent('submit_offer', 'OrderDetailScreen', { orderId });
      
      Alert.alert(
        language === 'ru' ? 'Успешно' : 'Muvaffaqiyatli',
        language === 'ru' ? 'Ваше предложение отправлено' : 'Taklifingiz yuborildi'
      );
      
      setShowOfferModal(false);
      setOfferPrice('');
      setOfferComment('');
      refetchOffers();
    } catch (error: any) {
      const serverError = error.response?.data?.error || error.response?.data?.message;
      const details = error.response?.data?.details;
      let errorMsg = serverError || error.message || (language === 'ru' ? 'Не удалось отправить предложение' : 'Taklif yuborib bo\'lmadi');
      if (details && Array.isArray(details)) {
        errorMsg += '\n' + details.map((d: any) => `${d.path?.join('.') || ''}: ${d.message}`).join('\n');
      }
      if (serverError === 'Insufficient deposit balance') {
        const required = error.response?.data?.required;
        const available = error.response?.data?.available;
        errorMsg = language === 'ru'
          ? `Недостаточно средств на депозите. Требуется: ${formatPrice(required, language)} сум, Доступно: ${formatPrice(available, language)} сум`
          : `Depozitda mablag' yetarli emas. Kerak: ${formatPrice(required, language)} so'm, Mavjud: ${formatPrice(available, language)} so'm`;
      }
      Alert.alert(language === 'ru' ? 'Ошибка' : 'Xato', errorMsg);
    }
  };

  const handleAcceptOffer = async (offerId: number) => {
    Alert.alert(
      language === 'ru' ? 'Принять предложение?' : 'Taklifni qabul qilasizmi?',
      language === 'ru' ? 'Будет создан договор с перевозчиком' : 'Tashuvchi bilan shartnoma tuziladi',
      [
        { text: language === 'ru' ? 'Отмена' : 'Bekor qilish', style: 'cancel' },
        {
          text: language === 'ru' ? 'Принять' : 'Qabul qilish',
          onPress: async () => {
            try {
              await acceptOfferMutation.mutateAsync(offerId);
              Alert.alert(
                language === 'ru' ? 'Успешно' : 'Muvaffaqiyatli',
                language === 'ru' ? 'Договор создан' : 'Shartnoma tuzildi'
              );
              refetch();
              refetchOffers();
            } catch (error: any) {
              Alert.alert(
                language === 'ru' ? 'Ошибка' : 'Xato',
                error.message || (language === 'ru' ? 'Не удалось принять предложение' : 'Taklifni qabul qilib bo\'lmadi')
              );
            }
          }
        }
      ]
    );
  };

  const handleRejectOffer = async (offerId: number) => {
    Alert.alert(
      language === 'ru' ? 'Отклонить предложение?' : 'Taklifni rad etasizmi?',
      language === 'ru' ? 'Это действие нельзя отменить' : 'Bu amalni bekor qilib bo\'lmaydi',
      [
        { text: language === 'ru' ? 'Отмена' : 'Bekor qilish', style: 'cancel' },
        {
          text: language === 'ru' ? 'Отклонить' : 'Rad etish',
          style: 'destructive',
          onPress: async () => {
            try {
              await rejectOfferMutation.mutateAsync(offerId);
              refetchOffers();
            } catch (error: any) {
              Alert.alert(
                language === 'ru' ? 'Ошибка' : 'Xato',
                error.message
              );
            }
          }
        }
      ]
    );
  };

  const calculateCollateral = (price: number) => {
    return price * 0.02;
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
            {language === 'ru' ? 'Не удалось загрузить заказ' : 'Buyurtmani yuklab bo\'lmadi'}
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

  if (isLoading || !order) {
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

  const renderRoutePoints = () => {
    const originPoints = order.originPoints?.length ? order.originPoints : [{ region: order.originRegion, districts: order.originDistrict || [] }];
    const destPoints = order.destinationPoints?.length ? order.destinationPoints : [{ region: order.destinationRegion, districts: order.destinationDistrict || [] }];

    return (
      <Card style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {language === 'ru' ? 'Маршрут' : 'Yo\'nalish'}
        </Text>
        
        <View style={styles.routeContainer}>
          <Text style={[styles.routeSubtitle, { color: colors.mutedForeground }]}>
            {language === 'ru' ? 'Откуда' : 'Qayerdan'}
          </Text>
          {originPoints.map((point, idx) => (
            <View key={`origin-${idx}`} style={styles.routePoint}>
              <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
              <View style={styles.routeInfo}>
                <Text style={[styles.routeValue, { color: colors.foreground }]}>
                  {getRegionName(point.region, language)}
                </Text>
                {point.districts?.length > 0 && (
                  <Text style={[styles.routeDistricts, { color: colors.mutedForeground }]}>
                    {point.districts.map(d => getDistrictName(point.region, d, language)).filter(Boolean).join(', ')}
                  </Text>
                )}
              </View>
            </View>
          ))}
          
          <View style={styles.routeLine} />
          
          <Text style={[styles.routeSubtitle, { color: colors.mutedForeground }]}>
            {language === 'ru' ? 'Куда' : 'Qayerga'}
          </Text>
          {destPoints.map((point, idx) => (
            <View key={`dest-${idx}`} style={styles.routePoint}>
              <View style={[styles.routeDot, { backgroundColor: colors.success }]} />
              <View style={styles.routeInfo}>
                <Text style={[styles.routeValue, { color: colors.foreground }]}>
                  {getRegionName(point.region, language)}
                </Text>
                {point.districts?.length > 0 && (
                  <Text style={[styles.routeDistricts, { color: colors.mutedForeground }]}>
                    {point.districts.map(d => getDistrictName(point.region, d, language)).filter(Boolean).join(', ')}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      </Card>
    );
  };

  const renderOfferItem = (offer: Offer) => {
    const statusColor = getOfferStatusColor(offer.status);
    const canAction = isOwner && offer.status === 'active';

    return (
      <View key={offer.id} style={styles.offerItem}>
        <View style={styles.offerHeader}>
          <Text style={[styles.offerCarrier, { color: colors.foreground }]}>
            {offer.carrierName || `#${offer.carrierId}`}
          </Text>
          <View style={[styles.offerStatusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.offerStatusText, { color: statusColor }]}>
              {getOfferStatusName(offer.status, language)}
            </Text>
          </View>
        </View>
        
        <View style={styles.offerDetails}>
          <Text style={[styles.offerPrice, { color: colors.primary }]}>
            {formatPrice(offer.price, language)}
          </Text>
          <Text style={[styles.offerDate, { color: colors.mutedForeground }]}>
            {formatDate(offer.createdAt, language)}
          </Text>
        </View>
        
        {offer.comment && (
          <Text style={[styles.offerComment, { color: colors.mutedForeground }]}>
            {offer.comment}
          </Text>
        )}
        
        {canAction && (
          <View style={styles.offerActions}>
            <TouchableOpacity 
              style={[styles.rejectButton, { borderColor: '#EF4444' }]}
              onPress={() => handleRejectOffer(offer.id)}
              testID={`button-reject-offer-${offer.id}`}
            >
              <Text style={[styles.rejectButtonText, { color: '#EF4444' }]}>
                {language === 'ru' ? 'Отклонить' : 'Rad etish'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.acceptButton, { backgroundColor: colors.success }]}
              onPress={() => handleAcceptOffer(offer.id)}
              testID={`button-accept-offer-${offer.id}`}
            >
              <Text style={styles.acceptButtonText}>
                {language === 'ru' ? 'Принять' : 'Qabul qilish'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} testID="button-back">
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {language === 'ru' ? 'Заказ' : 'Buyurtma'} #{orderId}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: getOrderStatusColor(order.status, order.deletedAt) + '20' }]}>
            <Text style={[styles.statusText, { color: getOrderStatusColor(order.status, order.deletedAt) }]}>
              {getOrderStatusName(order.status, language, order.deletedAt)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
              {language === 'ru' ? 'Дата и время загрузки' : 'Yuklash sanasi va vaqti'}
            </Text>
            <Text style={[styles.dateText, { color: colors.foreground }]}>
              {formatDate(order.loadDate || order.loadingDate, language)}
              {order.loadingTime && ` ${localizeLoadingTime(order.loadingTime, language)}`}
            </Text>
          </View>
        </View>

        {order.title && (
          <Text style={[styles.orderTitle, { color: colors.foreground }]}>
            {order.title}
          </Text>
        )}

        {(order.isDangerous || order.isNonstandard || order.isPartialLoad || order.requiresCollateral) && (
          <View style={styles.flagsRow}>
            {order.isDangerous && (
              <View style={[styles.flagBadge, { backgroundColor: '#EF444420' }]}>
                <Ionicons name="warning" size={14} color="#EF4444" />
                <Text style={[styles.flagText, { color: '#EF4444' }]}>
                  {language === 'ru' ? 'Опасный груз' : 'Xavfli yuk'}
                </Text>
              </View>
            )}
            {order.isNonstandard && (
              <View style={[styles.flagBadge, { backgroundColor: '#8B5CF620' }]}>
                <Ionicons name="resize" size={14} color="#8B5CF6" />
                <Text style={[styles.flagText, { color: '#8B5CF6' }]}>
                  {language === 'ru' ? 'Негабаритный' : 'Nostandart'}
                </Text>
              </View>
            )}
            {order.isPartialLoad && (
              <View style={[styles.flagBadge, { backgroundColor: '#06B6D420' }]}>
                <Ionicons name="cube-outline" size={14} color="#06B6D4" />
                <Text style={[styles.flagText, { color: '#06B6D4' }]}>
                  {language === 'ru' ? 'Частичная загрузка' : 'Qisman yuklash'}
                </Text>
              </View>
            )}
            {order.requiresCollateral && (
              <View style={[styles.flagBadge, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="shield-checkmark" size={14} color="#F59E0B" />
                <Text style={[styles.flagText, { color: '#F59E0B' }]}>
                  {language === 'ru' ? 'Залог 2%' : '2% garov'}
                </Text>
              </View>
            )}
          </View>
        )}

        {renderRoutePoints()}

        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {language === 'ru' ? 'Детали груза' : 'Yuk tafsilotlari'}
          </Text>
          
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Ionicons name="cube-outline" size={20} color={colors.mutedForeground} />
              <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
                {language === 'ru' ? 'Вес' : 'Og\'irligi'}
              </Text>
              <Text style={[styles.detailValue, { color: colors.foreground }]}>
                {order.weightTons || order.cargoWeight || '-'} {language === 'ru' ? 'т' : 't'}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="car-outline" size={20} color={colors.mutedForeground} />
              <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
                {language === 'ru' ? 'Транспорт' : 'Transport'}
              </Text>
              <Text style={[styles.detailValue, { color: colors.foreground }]}>
                {getTransportTypeName(order.transportType, language)}
              </Text>
            </View>
          </View>

          {order.notes && (
            <View style={styles.descriptionBox}>
              <Text style={[styles.descriptionLabel, { color: colors.mutedForeground }]}>
                {language === 'ru' ? 'Примечания' : 'Izohlar'}
              </Text>
              <Text style={[styles.descriptionText, { color: colors.foreground }]}>
                {order.notes}
              </Text>
            </View>
          )}

          {order.photoUrls && order.photoUrls.length > 0 && (
            <View style={styles.photosSection}>
              <Text style={[styles.descriptionLabel, { color: colors.mutedForeground }]}>
                {language === 'ru' ? 'Фото груза' : 'Yuk rasmlari'}
              </Text>
              <PhotoGallery photoUrls={order.photoUrls} language={language} />
            </View>
          )}
        </Card>

        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {language === 'ru' ? 'Цена' : 'Narx'}
          </Text>
          <Text style={[styles.priceValue, { color: colors.primary }]}>
            {formatPrice(order.priceWithVat, language)}
          </Text>
          <Text style={[styles.priceNote, { color: colors.mutedForeground }]}>
            {language === 'ru' ? 'с НДС' : 'QQS bilan'}
          </Text>
          {order.priceWithoutVat && (
            <Text style={[styles.priceWithoutVat, { color: colors.mutedForeground }]}>
              {language === 'ru' ? 'Без НДС:' : 'QQSsiz:'} {formatPrice(order.priceWithoutVat, language)}
            </Text>
          )}
        </Card>

        {isOwner && offers.length > 0 && (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {language === 'ru' ? 'Предложения' : 'Takliflar'} ({offers.length})
            </Text>
            {loadingOffers ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              offers.map(renderOfferItem)
            )}
          </Card>
        )}

        {canMakeOffer && !hasMyOffer && (
          <Button
            title={language === 'ru' ? 'Подать предложение' : 'Taklif berish'}
            onPress={() => {
              setOfferPrice(order.priceWithVat?.toString() || '');
              setShowOfferModal(true);
            }}
            style={styles.offerButton}
            testID="button-make-offer"
          />
        )}

        {hasMyOffer && (
          <View style={[styles.alreadyOfferedBadge, { backgroundColor: colors.success + '20' }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={[styles.alreadyOfferedText, { color: colors.success }]}>
              {language === 'ru' ? 'Вы уже подали предложение' : 'Siz allaqachon taklif bergansiz'}
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showOfferModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOfferModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {language === 'ru' ? 'Подать предложение' : 'Taklif berish'}
              </Text>
              <TouchableOpacity onPress={() => setShowOfferModal(false)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>
                {language === 'ru' ? 'Ваша цена (сум)' : 'Sizning narxingiz (so\'m)'}
              </Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
                value={offerPrice}
                onChangeText={(v) => setOfferPrice(handlePriceInput(v))}
                keyboardType="decimal-pad"
                placeholder={language === 'ru' ? 'Введите цену' : 'Narxni kiriting'}
                placeholderTextColor={colors.mutedForeground}
                testID="input-offer-price"
              />
              
              {offerPrice && order.requiresCollateral && (
                <View style={[styles.collateralInfo, { backgroundColor: '#F59E0B10' }]}>
                  <Text style={[styles.collateralText, { color: '#F59E0B' }]}>
                    {language === 'ru' ? 'Залог (2%):' : 'Garov (2%):'} {formatPrice(calculateCollateral(parseFloat(offerPrice) || 0), language)}
                  </Text>
                </View>
              )}

              <Text style={[styles.inputLabel, { color: colors.foreground, marginTop: 16 }]}>
                {language === 'ru' ? 'Комментарий (необязательно)' : 'Izoh (ixtiyoriy)'}
              </Text>
              <TextInput
                style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]}
                value={offerComment}
                onChangeText={setOfferComment}
                placeholder={language === 'ru' ? 'Дополнительная информация' : 'Qo\'shimcha ma\'lumot'}
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
                testID="input-offer-comment"
              />

              <Button
                title={language === 'ru' ? 'Отправить предложение' : 'Taklif yuborish'}
                onPress={handleSubmitOffer}
                loading={createOfferMutation.isPending}
                style={{ marginTop: 24 }}
                testID="button-submit-offer"
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
    marginBottom: 12,
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
  dateLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  dateText: {
    fontSize: 14,
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  flagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  flagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 6,
  },
  flagText: {
    fontSize: 12,
    fontWeight: '500',
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
  routeContainer: {
    gap: 8,
  },
  routeSubtitle: {
    fontSize: 12,
    marginBottom: 4,
    marginTop: 8,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  routeInfo: {
    flex: 1,
  },
  routeValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  routeDistricts: {
    fontSize: 13,
    marginTop: 2,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#e5e7eb',
    marginLeft: 5,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 16,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  descriptionBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  photosSection: {
    marginTop: 16,
  },
  descriptionLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  priceValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  priceNote: {
    fontSize: 12,
    marginTop: 4,
  },
  priceWithoutVat: {
    fontSize: 14,
    marginTop: 8,
  },
  offerItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  offerCarrier: {
    fontSize: 15,
    fontWeight: '500',
  },
  offerStatusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  offerStatusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  offerDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  offerPrice: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  offerDate: {
    fontSize: 12,
  },
  offerComment: {
    fontSize: 13,
    marginTop: 4,
    fontStyle: 'italic',
  },
  offerActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  rejectButtonText: {
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  offerButton: {
    marginBottom: 16,
  },
  alreadyOfferedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
  },
  alreadyOfferedText: {
    fontSize: 14,
    fontWeight: '500',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalBody: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  collateralInfo: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
  },
  collateralText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
