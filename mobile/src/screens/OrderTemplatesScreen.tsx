import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useTemplates, useDeleteTemplate, type OrderTemplate } from '../hooks/useTemplates';
import { getRegionName, formatPrice, getTransportTypeName } from '../constants/regions';

interface OrderTemplatesScreenProps {
  navigation: any;
}

export function OrderTemplatesScreen({ navigation }: OrderTemplatesScreenProps) {
  const { language } = useLanguage();
  const colors = Colors.light;
  const insets = useSafeAreaInsets();
  const ru = language === 'ru';

  const { data: templates = [], isLoading, refetch, isRefetching } = useTemplates();
  const deleteMutation = useDeleteTemplate();

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  const texts = {
    title: ru ? 'Мои шаблоны' : 'Mening shablonlarim',
    noTemplates: ru ? 'У вас нет шаблонов' : 'Sizda shablonlar yo\'q',
    noTemplatesDesc: ru ? 'Шаблоны сохраняются при создании заказов. Нажмите "Сохранить шаблон" в форме создания заказа.' : 'Shablonlar buyurtma yaratishda saqlanadi.',
    deleteConfirm: ru ? 'Удалить шаблон?' : 'Shablonni o\'chirish?',
    deleteDesc: ru ? 'Это действие нельзя отменить.' : 'Bu amalni bekor qilib bo\'lmaydi.',
    delete: ru ? 'Удалить' : 'O\'chirish',
    cancel: ru ? 'Отмена' : 'Bekor qilish',
    createOrder: ru ? 'Создать заказ' : 'Buyurtma yaratish',
    tons: ru ? 'т' : 't',
  };

  const handleDelete = (id: number) => {
    Alert.alert(texts.deleteConfirm, texts.deleteDesc, [
      { text: texts.cancel, style: 'cancel' },
      {
        text: texts.delete,
        style: 'destructive',
        onPress: () => deleteMutation.mutate(id),
      },
    ]);
  };

  const handleCreateOrder = (template: OrderTemplate) => {
    navigation.navigate('CreateOrder', { templateId: template.id });
  };

  const renderTemplate = ({ item }: { item: OrderTemplate }) => {
    const origin = getRegionName(item.originRegion, language);
    const dest = getRegionName(item.destinationRegion, language);

    return (
      <View
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        data-testid={`card-template-${item.id}`}
      >
        <View style={styles.cardHeader}>
          <View style={styles.routeRow}>
            <Ionicons name="location" size={16} color={colors.primary} />
            <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
              {origin}
            </Text>
            <Ionicons name="arrow-forward" size={14} color={colors.mutedForeground} />
            <Ionicons name="location" size={16} color={colors.success} />
            <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
              {dest}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDelete(item.id)}
            style={styles.deleteBtn}
            data-testid={`button-delete-template-${item.id}`}
          >
            <Ionicons name="trash-outline" size={20} color={colors.destructive} />
          </TouchableOpacity>
        </View>

        <View style={styles.detailsRow}>
          {item.transportType ? (
            <View style={[styles.chip, { backgroundColor: colors.background }]}>
              <Ionicons name="car-outline" size={14} color={colors.mutedForeground} />
              <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{getTransportTypeName(item.transportType, language)}</Text>
            </View>
          ) : null}
          {item.weightTons ? (
            <View style={[styles.chip, { backgroundColor: colors.background }]}>
              <Ionicons name="scale-outline" size={14} color={colors.mutedForeground} />
              <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{item.weightTons} {texts.tons}</Text>
            </View>
          ) : null}
          {item.priceWithVat ? (
            <View style={[styles.chip, { backgroundColor: colors.primary + '15' }]}>
              <Text style={[styles.chipText, { color: colors.primary, fontWeight: '600' }]}>
                {formatPrice(item.priceWithVat, language)}
              </Text>
            </View>
          ) : null}
        </View>

        {item.name ? (
          <Text style={[styles.templateName, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.name}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[styles.useButton, { backgroundColor: colors.primary }]}
          onPress={() => handleCreateOrder(item)}
          data-testid={`button-use-template-${item.id}`}
        >
          <Ionicons name="add-circle-outline" size={18} color="white" />
          <Text style={styles.useButtonText}>{texts.createOrder}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          data-testid="button-back"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{texts.title}</Text>
        <View style={styles.placeholder} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : templates.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="copy-outline" size={64} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{texts.noTemplates}</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>{texts.noTemplatesDesc}</Text>
        </View>
      ) : (
        <FlatList
          data={templates}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTemplate}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  routeRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  routeText: {
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
  deleteBtn: {
    padding: 4,
    marginLeft: 8,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chipText: {
    fontSize: 12,
  },
  templateName: {
    fontSize: 12,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  useButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  useButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});
