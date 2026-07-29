import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useDepositAccounts } from '../hooks/useDeposits';
import { formatPrice } from '../constants/regions';

interface PartnerHomeScreenProps {
  navigation: any;
}

export function PartnerHomeScreen({ navigation }: PartnerHomeScreenProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const colors = Colors.light;
  
  const { 
    data: accountsData,
    refetch,
    isRefetching 
  } = useDepositAccounts();
  
  const accounts = Array.isArray(accountsData) ? accountsData : [];
  const partnerRewardBalance = accounts.find(a => a.accountType === 'partner_reward')?.balance || 0;

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            {language === 'ru' ? 'Режим партнёра' : 'Hamkor rejimi'}
          </Text>
          <Text style={[styles.userName, { color: colors.foreground }]}>
            {user?.profile?.companyName || user?.phone}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.notificationButton}
          onPress={() => navigation.navigate('Notifications')}
          testID="button-notifications"
        >
          <Ionicons name="notifications-outline" size={24} color={colors.foreground} />
        </TouchableOpacity>
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
        <Card style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Ionicons name="gift" size={32} color={colors.warning} />
            <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
              {language === 'ru' ? 'Накопленные бонусы' : 'To\'plangan bonuslar'}
            </Text>
          </View>
          <Text style={[styles.balanceValue, { color: colors.warning }]}>
            {formatPrice(partnerRewardBalance, language)}
          </Text>
          <TouchableOpacity 
            style={[styles.withdrawButton, { borderColor: colors.warning }]}
            onPress={() => navigation.navigate('Rewards')}
            testID="button-withdraw"
          >
            <Text style={[styles.withdrawButtonText, { color: colors.warning }]}>
              {language === 'ru' ? 'Вывести средства' : 'Mablag\'larni yechish'}
            </Text>
          </TouchableOpacity>
        </Card>

        <Card style={styles.referralCard}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {language === 'ru' ? 'Ваш реферальный код' : 'Sizning referal kodingiz'}
          </Text>
          <View style={[styles.codeContainer, { backgroundColor: colors.primary + '10' }]}>
            <Text style={[styles.referralCode, { color: colors.primary }]}>
              {user?.referralCode || 'REF-XXXXX'}
            </Text>
            <TouchableOpacity testID="button-copy-code">
              <Ionicons name="copy-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.referralHint, { color: colors.mutedForeground }]}>
            {language === 'ru' 
              ? 'Поделитесь этим кодом с заказчиками. Вы получите 0.6% комиссии с каждой их сделки.'
              : 'Ushbu kodni buyurtmachilar bilan ulashing. Ularning har bir bitimidan 0.6% komissiya olasiz.'}
          </Text>
        </Card>

        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Ionicons name="people" size={28} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>0</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {language === 'ru' ? 'Приглашённых' : 'Taklif qilinganlar'}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <Ionicons name="briefcase" size={28} color={colors.success} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>0</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {language === 'ru' ? 'Их сделок' : 'Ularning bitimlari'}
            </Text>
          </Card>
        </View>

        <TouchableOpacity
          style={[styles.referralButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('Referral')}
          testID="button-view-referrals"
        >
          <Ionicons name="people-outline" size={20} color="#fff" />
          <Text style={styles.referralButtonText}>
            {language === 'ru' ? 'Посмотреть приглашённых' : 'Taklif qilinganlarni ko\'rish'}
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>
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
    paddingTop: 8,
  },
  greeting: {
    fontSize: 14,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  notificationButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  balanceCard: {
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 14,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  withdrawButton: {
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  withdrawButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  referralCard: {
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  referralCode: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  referralHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  referralButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  referralButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
});
