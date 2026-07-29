import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import { api } from '../services/api';

interface RewardTransaction {
  id: number;
  amount: string;
  description: string;
  createdAt: string;
  referralCode?: string;
}

interface PartnerStats {
  totalEarnings: number;
  pendingEarnings: number;
  referralCount: number;
  activeReferrals: number;
}

export function RewardsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { language } = useLanguage();
  const colors = Colors.light;
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);

  const t = {
    title: language === 'ru' ? 'Бонусы' : 'Bonuslar',
    totalEarnings: language === 'ru' ? 'Всего заработано' : 'Jami daromad',
    pendingEarnings: language === 'ru' ? 'Ожидает вывода' : 'Yechishni kutmoqda',
    referrals: language === 'ru' ? 'Рефералов' : 'Referallar',
    activeReferrals: language === 'ru' ? 'Активных' : 'Faol',
    recentTransactions: language === 'ru' ? 'Последние начисления' : 'Oxirgi hisob-kitoblar',
    noTransactions: language === 'ru' ? 'Нет начислений' : 'Hisob-kitoblar yo\'q',
    withdraw: language === 'ru' ? 'Вывести средства' : 'Mablag\' yechish',
    sum: language === 'ru' ? 'сум' : 'so\'m',
  };

  const fetchData = async () => {
    try {
      const [statsResult, commissionsResult] = await Promise.allSettled([
        api.get('/api/partners/me'),
        api.get('/api/partners/me/commissions'),
      ]);

      if (statsResult.status === 'fulfilled') {
        const d = statsResult.value.data || {};
        setStats({
          totalEarnings: parseFloat(d.totalCommissions || d.totalEarnings || '0') || 0,
          pendingEarnings: parseFloat(d.pendingCommissions || d.pendingEarnings || '0') || 0,
          referralCount: d.clientCount || d.referralCount || 0,
          activeReferrals: d.activeClientCount || d.activeReferrals || 0,
        });
      } else {
        setStats({ totalEarnings: 0, pendingEarnings: 0, referralCount: 0, activeReferrals: 0 });
      }

      if (commissionsResult.status === 'fulfilled') {
        const raw = commissionsResult.value.data;
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.commissions) ? raw.commissions : []);
        setTransactions(list);
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.error('Error fetching rewards data:', error);
      setStats({ totalEarnings: 0, pendingEarnings: 0, referralCount: 0, activeReferrals: 0 });
      setTransactions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatAmount = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return num.toLocaleString('ru-RU');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'uz-UZ', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>{t.title}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        <View style={styles.statsContainer}>
          <View style={[styles.mainStatCard, { backgroundColor: colors.primary }]}>
            <Text style={styles.mainStatLabel}>{t.totalEarnings}</Text>
            <Text style={styles.mainStatValue}>
              {formatAmount(stats?.totalEarnings || 0)} {t.sum}
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="wallet-outline" size={24} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {formatAmount(stats?.pendingEarnings || 0)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t.pendingEarnings}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.smallStatCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.smallStatValue, { color: colors.foreground }]}>
                {stats?.referralCount || 0}
              </Text>
              <Text style={[styles.smallStatLabel, { color: colors.mutedForeground }]}>{t.referrals}</Text>
            </View>
            <View style={[styles.smallStatCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.smallStatValue, { color: colors.foreground }]}>
                {stats?.activeReferrals || 0}
              </Text>
              <Text style={[styles.smallStatLabel, { color: colors.mutedForeground }]}>{t.activeReferrals}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.withdrawButton, { backgroundColor: colors.primary }]}
          onPress={() => (navigation as any).navigate('Withdraw')}
          data-testid="button-withdraw"
        >
          <Ionicons name="arrow-up-circle-outline" size={24} color="white" />
          <Text style={styles.withdrawButtonText}>{t.withdraw}</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.recentTransactions}</Text>

        {transactions.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="receipt-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t.noTransactions}</Text>
          </View>
        ) : (
          transactions.map((transaction) => (
            <View 
              key={transaction.id} 
              style={[styles.transactionItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.transactionIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
              </View>
              <View style={styles.transactionInfo}>
                <Text style={[styles.transactionDescription, { color: colors.foreground }]}>
                  {transaction.description}
                </Text>
                <Text style={[styles.transactionDate, { color: colors.mutedForeground }]}>
                  {formatDate(transaction.createdAt)}
                </Text>
              </View>
              <Text style={[styles.transactionAmount, { color: colors.primary }]}>
                +{formatAmount(transaction.amount)} {t.sum}
              </Text>
            </View>
          ))
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsContainer: {
    gap: 12,
  },
  mainStatCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  mainStatLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  mainStatValue: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
  },
  statCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  smallStatCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  smallStatValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  smallStatLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  withdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    gap: 8,
  },
  withdrawButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 16,
  },
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '500',
  },
  transactionDate: {
    fontSize: 12,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 32,
  },
});
