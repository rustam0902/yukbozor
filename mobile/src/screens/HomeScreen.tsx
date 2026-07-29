import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useMyOrders, usePublicOrders } from '../hooks/useOrders';
import { useMyContracts } from '../hooks/useContracts';
import { useDepositAccounts } from '../hooks/useDeposits';
import { getRegionName, getContractStatusName, getContractStatusColor, formatPrice } from '../constants/regions';

interface HomeScreenProps {
  navigation: any;
}

export function HomeScreen({ navigation }: HomeScreenProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const colors = Colors.light;
  
  const { 
    data: publicOrders = [], 
    isLoading: loadingOrders,
    refetch: refetchOrders,
    isRefetching: refetchingOrders 
  } = usePublicOrders();
  
  const { 
    data: myOrders = [],
    refetch: refetchMyOrders 
  } = useMyOrders();
  
  const { 
    data: myContracts = [],
    isLoading: loadingContracts,
    refetch: refetchContracts 
  } = useMyContracts();
  
  const { 
    data: accountsData,
    refetch: refetchAccounts 
  } = useDepositAccounts();
  
  const accounts = Array.isArray(accountsData) ? accountsData : [];

  const onRefresh = useCallback(() => {
    refetchOrders();
    refetchMyOrders();
    refetchContracts();
    refetchAccounts();
  }, [refetchOrders, refetchMyOrders, refetchContracts, refetchAccounts]);

  const getRoleName = (role: string) => {
    switch (role) {
      case 'customer': return t.customer;
      case 'carrier': return t.carrier;
      case 'partner': return t.partner;
      default: return role;
    }
  };

  const getQuickActions = () => {
    const actions = [];
    
    if (user?.roles?.includes('customer')) {
      actions.push({
        title: t.createOrder,
        icon: '📦',
        onPress: () => navigation.navigate('Orders'),
        color: colors.primary,
      });
    }
    
    if (user?.roles?.includes('carrier')) {
      actions.push({
        title: t.availableOrders,
        icon: '🚚',
        onPress: () => navigation.navigate('Orders'),
        color: colors.success,
      });
    }
    
    if (user?.roles?.includes('partner')) {
      actions.push({
        title: t.referralProgram,
        icon: '🎁',
        onPress: () => navigation.navigate('Profile'),
        color: colors.warning,
      });
    }
    
    return actions;
  };

  // Calculate statistics
  const activeOrders = myOrders.filter(o => o.status === 'new' || o.status === 'active').length;
  const completedContracts = myContracts.filter(c => c.status === 'completed').length;
  const activeContracts = myContracts.filter(c => 
    c.status === 'pending' || 
    c.status === 'awaiting_prepayment' || 
    c.status === 'prepayment_made' ||
    c.status === 'in_progress'
  ).length;
  
  const mainBalance = Array.isArray(accounts) 
    ? (accounts.find(a => a.accountType === 'main')?.balance || 0) 
    : 0;

  // Get recent contracts (last 3)
  const recentContracts = [...myContracts]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  const isLoading = loadingOrders || loadingContracts;
  const isRefreshing = refetchingOrders;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={isRefreshing} 
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
              {language === 'ru' ? 'Добро пожаловать,' : 'Xush kelibsiz,'}
            </Text>
            <Text style={[styles.userName, { color: colors.foreground }]}>
              {user?.displayName || user?.profile?.companyName || user?.phone}
            </Text>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.roleText, { color: colors.primary }]}>
              {getRoleName(user?.defaultRole || 'customer')}
            </Text>
          </View>
        </View>

        {/* Balance Card */}
        <Card style={styles.balanceCard}>
          <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
            {language === 'ru' ? 'Баланс' : 'Balans'}
          </Text>
          <Text style={[styles.balanceValue, { color: colors.primary }]}>
            {formatPrice(mainBalance, language)}
          </Text>
          <TouchableOpacity 
            style={[styles.depositButton, { backgroundColor: colors.primary + '20' }]}
            onPress={() => navigation.navigate('Deposit')}
          >
            <Text style={[styles.depositButtonText, { color: colors.primary }]}>
              {t.topUp}
            </Text>
          </TouchableOpacity>
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {language === 'ru' ? 'Быстрые действия' : 'Tezkor harakatlar'}
        </Text>

        <View style={styles.quickActions}>
          {getQuickActions().map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.actionCard, { borderColor: colors.border }]}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <Text style={styles.actionIcon}>{action.icon}</Text>
              <Text style={[styles.actionTitle, { color: colors.foreground }]}>
                {action.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {language === 'ru' ? 'Статистика' : 'Statistika'}
        </Text>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {activeOrders}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {language === 'ru' ? 'Активные заказы' : 'Faol buyurtmalar'}
            </Text>
          </Card>
          
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.warning }]}>
              {activeContracts}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {language === 'ru' ? 'В работе' : 'Jarayonda'}
            </Text>
          </Card>
          
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.success }]}>
              {completedContracts}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {language === 'ru' ? 'Завершенные' : 'Yakunlangan'}
            </Text>
          </Card>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {language === 'ru' ? 'Последние сделки' : 'So\'nggi bitimlar'}
          </Text>
          {recentContracts.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('Deals')}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>
                {language === 'ru' ? 'Все' : 'Barchasi'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <Card style={styles.loadingCard}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              {t.loading}
            </Text>
          </Card>
        ) : recentContracts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {language === 'ru' ? 'Нет активных сделок' : 'Faol bitimlar yo\'q'}
            </Text>
            <Button
              title={language === 'ru' ? 'Посмотреть заказы' : 'Buyurtmalarni ko\'rish'}
              onPress={() => navigation.navigate('Orders')}
              variant="outline"
              size="sm"
              style={styles.emptyButton}
            />
          </Card>
        ) : (
          recentContracts.map((contract) => {
            const statusColor = getContractStatusColor(contract.status);
            return (
              <TouchableOpacity 
                key={contract.id}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Deals')}
              >
                <Card style={styles.contractCard}>
                  <View style={styles.contractHeader}>
                    <Text style={[styles.contractNumber, { color: colors.foreground }]}>
                      {language === 'ru' ? 'Договор' : 'Shartnoma'} #{contract.id}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                      <Text style={[styles.statusText, { color: statusColor }]}>
                        {getContractStatusName(contract.status, language)}
                      </Text>
                    </View>
                  </View>
                  
                  {contract.order && (
                    <Text style={[styles.contractRoute, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {getRegionName(contract.order.originRegion, language)} → {getRegionName(contract.order.destinationRegion, language)}
                    </Text>
                  )}
                  
                  <Text style={[styles.contractPrice, { color: colors.primary }]}>
                    {formatPrice(contract.price, language)}
                  </Text>
                </Card>
              </TouchableOpacity>
            );
          })
        )}

        {/* Available orders count */}
        <Card style={styles.ordersInfoCard}>
          <View style={styles.ordersInfoContent}>
            <View>
              <Text style={[styles.ordersInfoValue, { color: colors.primary }]}>
                {publicOrders.length}
              </Text>
              <Text style={[styles.ordersInfoLabel, { color: colors.mutedForeground }]}>
                {language === 'ru' ? 'Доступных заказов' : 'Mavjud buyurtmalar'}
              </Text>
            </View>
            <Button
              title={language === 'ru' ? 'Смотреть' : 'Ko\'rish'}
              onPress={() => navigation.navigate('Orders')}
              size="sm"
            />
          </View>
        </Card>
      </ScrollView>
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
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 14,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  roleBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  balanceCard: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 12,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  depositButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 8,
  },
  depositButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 16,
  },
  actionCard: {
    flex: 1,
    minWidth: '45%',
    margin: 6,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: -6,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 6,
    alignItems: 'center',
    paddingVertical: 16,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  contractCard: {
    marginBottom: 8,
  },
  contractHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  contractNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
  },
  contractRoute: {
    fontSize: 13,
    marginBottom: 4,
  },
  contractPrice: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  ordersInfoCard: {
    marginTop: 16,
  },
  ordersInfoContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ordersInfoValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  ordersInfoLabel: {
    fontSize: 12,
  },
  loadingCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    marginBottom: 16,
  },
  emptyButton: {
    minWidth: 160,
  },
});
