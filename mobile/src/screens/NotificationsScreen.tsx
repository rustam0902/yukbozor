import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { Card } from '../components/Card';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications, useNotificationSettings, useMarkAsRead, useMarkAllAsRead, useUpdateNotificationSetting } from '../hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ru, uz } from 'date-fns/locale';

interface NotificationsScreenProps {
  navigation: any;
}

export function NotificationsScreen({ navigation }: NotificationsScreenProps) {
  const { t, language } = useLanguage();
  const colors = Colors.light;
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'notifications' | 'settings'>('notifications');

  const { data: notificationsData, isLoading: loadingNotifications, refetch } = useNotifications();
  const { data: settings = [], isLoading: loadingSettings } = useNotificationSettings();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const updateSetting = useUpdateNotificationSetting();

  const notifications = notificationsData?.notifications || [];
  const unreadCount = notificationsData?.unreadCount || 0;

  const texts = {
    ru: {
      title: 'Уведомления',
      notifications: 'Уведомления',
      settings: 'Настройки',
      noNotifications: 'Нет уведомлений',
      markAllRead: 'Прочитать все',
      notificationType: 'Тип уведомления',
      sms: 'SMS',
      inApp: 'В приложении',
    },
    uz: {
      title: 'Bildirishnomalar',
      notifications: 'Bildirishnomalar',
      settings: 'Sozlamalar',
      noNotifications: 'Bildirishnomalar yo\'q',
      markAllRead: 'Barchasini o\'qish',
      notificationType: 'Bildirishnoma turi',
      sms: 'SMS',
      inApp: 'Ilovada',
    }
  };

  const tx = texts[language];
  const dateLocale = language === 'ru' ? ru : uz;

  const handleNotificationPress = (notification: any) => {
    if (!notification.isRead) {
      markAsRead.mutate(notification.id);
    }
    if (notification.orderId) {
      navigation.navigate('OrderDetail', { orderId: notification.orderId });
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { 
        addSuffix: true,
        locale: dateLocale 
      });
    } catch {
      return '';
    }
  };

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleToggle = (setting: any, field: 'smsEnabled' | 'inAppEnabled') => {
    updateSetting.mutate({
      type: setting.notificationType,
      smsEnabled: field === 'smsEnabled' ? !setting.smsEnabled : setting.smsEnabled,
      inAppEnabled: field === 'inAppEnabled' ? !setting.inAppEnabled : setting.inAppEnabled,
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom', 'left', 'right']}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.primary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>{tx.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'notifications' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
          ]}
          onPress={() => setActiveTab('notifications')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'notifications' ? colors.primary : colors.mutedForeground }
          ]}>
            {tx.notifications}
            {unreadCount > 0 && (
              <Text style={[styles.badge, { backgroundColor: colors.destructive }]}> {unreadCount}</Text>
            )}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'settings' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
          ]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'settings' ? colors.primary : colors.mutedForeground }
          ]}>
            {tx.settings}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'notifications' ? (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={loadingNotifications} onRefresh={onRefresh} />
          }
        >
          {unreadCount > 0 && (
            <TouchableOpacity
              style={[styles.markAllButton, { backgroundColor: colors.muted }]}
              onPress={() => markAllAsRead.mutate()}
            >
              <Text style={[styles.markAllText, { color: colors.foreground }]}>
                {tx.markAllRead}
              </Text>
            </TouchableOpacity>
          )}

          {loadingNotifications ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {tx.noNotifications}
              </Text>
            </View>
          ) : (
            notifications.map((notification: any) => (
              <TouchableOpacity
                key={notification.id}
                onPress={() => handleNotificationPress(notification)}
              >
                <Card
                  style={[
                    styles.notificationCard,
                    !notification.isRead && { backgroundColor: colors.muted }
                  ]}
                >
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationHeader}>
                      <Text style={[styles.notificationTitle, { color: colors.foreground }]}>
                        {notification.title}
                      </Text>
                      {!notification.isRead && (
                        <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                      )}
                    </View>
                    <Text style={[styles.notificationMessage, { color: colors.mutedForeground }]}>
                      {notification.message}
                    </Text>
                    <Text style={[styles.notificationTime, { color: colors.mutedForeground }]}>
                      {formatTime(notification.createdAt)}
                    </Text>
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView style={styles.scrollView}>
          {loadingSettings ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : (
            <Card style={styles.settingsCard}>
              <View style={styles.settingsHeader}>
                <Text style={[styles.settingsHeaderText, { color: colors.foreground, flex: 1 }]}>
                  {tx.notificationType}
                </Text>
                <Text style={[styles.settingsHeaderText, { color: colors.foreground, width: 60, textAlign: 'center' }]}>
                  {tx.sms}
                </Text>
                <Text style={[styles.settingsHeaderText, { color: colors.foreground, width: 80, textAlign: 'center' }]}>
                  {tx.inApp}
                </Text>
              </View>
              
              {settings?.map((setting: any) => (
                <View key={setting.notificationType} style={styles.settingRow}>
                  <Text style={[styles.settingLabel, { color: colors.foreground }]}>
                    {language === 'ru' ? setting.labelRu : setting.labelUz}
                  </Text>
                  <Switch
                    value={setting.smsEnabled}
                    onValueChange={() => handleToggle(setting, 'smsEnabled')}
                    trackColor={{ false: colors.muted, true: colors.primary + '60' }}
                    thumbColor={setting.smsEnabled ? colors.primary : colors.mutedForeground}
                    style={{ width: 60 }}
                  />
                  <Switch
                    value={setting.inAppEnabled}
                    onValueChange={() => handleToggle(setting, 'inAppEnabled')}
                    trackColor={{ false: colors.muted, true: colors.primary + '60' }}
                    thumbColor={setting.inAppEnabled ? colors.primary : colors.mutedForeground}
                    style={{ width: 80 }}
                  />
                </View>
              ))}
            </Card>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    width: 40,
  },
  backText: {
    fontSize: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  badge: {
    color: '#fff',
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  markAllButton: {
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loader: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 16,
  },
  notificationCard: {
    marginBottom: 8,
    padding: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 13,
    marginTop: 4,
  },
  notificationTime: {
    fontSize: 12,
    marginTop: 6,
  },
  settingsCard: {
    padding: 16,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  settingsHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    flex: 1,
    fontSize: 14,
  },
});
