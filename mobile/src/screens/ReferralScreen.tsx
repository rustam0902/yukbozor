import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Clipboard, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { formatPrice, formatDate } from '../constants/regions';
import { api } from '../services/api';

interface ReferralScreenProps {
  navigation: any;
}

export function ReferralScreen({ navigation }: ReferralScreenProps) {
  const { language } = useLanguage();
  const { user, updateReferralCode } = useAuth();
  const colors = Colors.light;
  const [enrolling, setEnrolling] = useState(false);

  const referralCode = user?.referralCode || null;
  const referralLink = referralCode ? `https://yukbozor.uz/register?ref=${referralCode}` : '';

  useEffect(() => {
    if (!referralCode) {
      setEnrolling(true);
      api.post('/api/partners/enroll')
        .then(() => api.get('/api/partners/me'))
        .then(res => {
          if (res.data?.referralCode) {
            updateReferralCode(res.data.referralCode);
          }
        })
        .catch(err => console.log('Partner enroll error:', err?.response?.status))
        .finally(() => setEnrolling(false));
    }
  }, []);

  const handleCopyCode = () => {
    if (!referralCode) return;
    Clipboard.setString(referralCode);
    Alert.alert(
      language === 'ru' ? 'Скопировано' : 'Nusxalandi',
      language === 'ru' ? 'Код скопирован в буфер обмена' : 'Kod vaqtinchalik xotiraga nusxalandi'
    );
  };

  const handleCopyLink = () => {
    if (!referralLink) return;
    Clipboard.setString(referralLink);
    Alert.alert(
      language === 'ru' ? 'Скопировано' : 'Nusxalandi',
      language === 'ru' ? 'Ссылка скопирована в буфер обмена' : 'Havola vaqtinchalik xotiraga nusxalandi'
    );
  };

  const handleShare = async () => {
    if (!referralCode) return;
    try {
      await Share.share({
        message: language === 'ru' 
          ? `Присоединяйтесь к Yukbozor.uz! Используйте мой код: ${referralCode}\n${referralLink}`
          : `Yukbozor.uz ga qo'shiling! Mening kodimni ishlating: ${referralCode}\n${referralLink}`,
        title: 'Yukbozor.uz',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const referrals: any[] = [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {language === 'ru' ? 'Реферальная программа' : 'Referal dasturi'}
        </Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.infoCard}>
          <Ionicons name="gift" size={40} color={colors.warning} />
          <Text style={[styles.infoTitle, { color: colors.foreground }]}>
            {language === 'ru' ? 'Получайте 0.6% комиссии' : '0.6% komissiya oling'}
          </Text>
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            {language === 'ru' 
              ? 'С каждой сделки приглашённых вами заказчиков вы получаете комиссию на свой бонусный счёт.'
              : 'Siz taklif qilgan buyurtmachilarning har bir bitimidan bonus hisobingizga komissiya olasiz.'}
          </Text>
        </Card>

        {referralCode ? (
          <Card style={styles.codeCard}>
            <Text style={[styles.codeLabel, { color: colors.mutedForeground }]}>
              {language === 'ru' ? 'Ваш реферальный код' : 'Sizning referal kodingiz'}
            </Text>
            <View style={styles.codeRow}>
              <Text style={[styles.codeValue, { color: colors.primary }]}>
                {referralCode}
              </Text>
              <TouchableOpacity
                style={[styles.copyButton, { backgroundColor: colors.primary + '20' }]}
                onPress={handleCopyCode}
                testID="button-copy-code"
              >
                <Ionicons name="copy-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <Text style={[styles.codeLabel, { color: colors.mutedForeground }]}>
              {language === 'ru' ? 'Ссылка для приглашения' : 'Taklif havolasi'}
            </Text>
            <View style={styles.linkRow}>
              <Text style={[styles.linkText, { color: colors.foreground }]} numberOfLines={1}>
                {referralLink}
              </Text>
              <TouchableOpacity
                style={[styles.copyButton, { backgroundColor: colors.primary + '20' }]}
                onPress={handleCopyLink}
                testID="button-copy-link"
              >
                <Ionicons name="copy-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: colors.primary }]}
              onPress={handleShare}
              testID="button-share"
            >
              <Ionicons name="share-social" size={20} color="#fff" />
              <Text style={styles.shareButtonText}>
                {language === 'ru' ? 'Поделиться' : 'Ulashish'}
              </Text>
            </TouchableOpacity>
          </Card>
        ) : (
          <Card style={[styles.codeCard, styles.noCodeCard]}>
            {enrolling ? (
              <>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.noCodeText, { color: colors.mutedForeground, marginTop: 12 }]}>
                  {language === 'ru' ? 'Создаём ваш реферальный код...' : 'Referal kodingiz yaratilmoqda...'}
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="time-outline" size={36} color={colors.mutedForeground} />
                <Text style={[styles.noCodeText, { color: colors.foreground }]}>
                  {language === 'ru' ? 'Реферальный код не получен' : 'Referal kod olinmadi'}
                </Text>
                <Text style={[styles.noCodeHint, { color: colors.mutedForeground }]}>
                  {language === 'ru'
                    ? 'Попробуйте перезайти в раздел'
                    : 'Bo\'limni qayta oching'}
                </Text>
              </>
            )}
          </Card>
        )}

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {language === 'ru' ? 'Приглашённые заказчики' : 'Taklif qilingan buyurtmachilar'}
        </Text>

        {referrals.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="people-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {language === 'ru' 
                ? 'У вас пока нет приглашённых' 
                : 'Sizda hali taklif qilinganlar yo\'q'}
            </Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              {language === 'ru' 
                ? 'Поделитесь своим кодом с заказчиками'
                : 'Kodingizni buyurtmachilar bilan ulashing'}
            </Text>
          </Card>
        ) : (
          referrals.map((referral, index) => (
            <Card key={index} style={styles.referralCard}>
              <View style={styles.referralInfo}>
                <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>
                    {(referral.companyName || referral.phone)?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={styles.referralDetails}>
                  <Text style={[styles.referralName, { color: colors.foreground }]}>
                    {referral.companyName || referral.phone}
                  </Text>
                  <Text style={[styles.referralDate, { color: colors.mutedForeground }]}>
                    {formatDate(referral.createdAt, language)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.referralEarnings, { color: colors.success }]}>
                +{formatPrice(referral.totalEarnings || 0, language)}
              </Text>
            </Card>
          ))
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
  },
  infoCard: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  codeCard: {
    padding: 20,
    marginBottom: 24,
  },
  codeLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeValue: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  copyButton: {
    padding: 10,
    borderRadius: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkText: {
    flex: 1,
    fontSize: 14,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 8,
    marginTop: 16,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
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
  noCodeCard: {
    alignItems: 'center',
    gap: 10,
  },
  noCodeText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  noCodeHint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  referralCard: {
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  referralInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  referralDetails: {
    gap: 2,
  },
  referralName: {
    fontSize: 15,
    fontWeight: '500',
  },
  referralDate: {
    fontSize: 12,
  },
  referralEarnings: {
    fontSize: 14,
    fontWeight: '600',
  },
});
