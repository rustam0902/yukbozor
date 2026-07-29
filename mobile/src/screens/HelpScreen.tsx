import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';

interface FAQItem {
  question: string;
  answer: string;
}

export function HelpScreen() {
  const navigation = useNavigation();
  const { language } = useLanguage();
  const colors = Colors.light;
  const insets = useSafeAreaInsets();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const t = {
    title: language === 'ru' ? 'Помощь' : 'Yordam',
    faq: language === 'ru' ? 'Часто задаваемые вопросы' : 'Tez-tez beriladigan savollar',
    contact: language === 'ru' ? 'Связаться с нами' : 'Biz bilan bog\'lanish',
    phone: language === 'ru' ? 'Телефон' : 'Telefon',
    telegram: language === 'ru' ? 'Telegram' : 'Telegram',
    workingHours: language === 'ru' ? 'Режим работы' : 'Ish vaqti',
    workingHoursValue: '24/7',
  };

  const faqItems: FAQItem[] = language === 'ru' ? [
    {
      question: 'Как создать заказ?',
      answer: 'Перейдите в раздел "Создать заказ", заполните все необходимые поля (маршрут, груз, цена) и нажмите кнопку "Создать".',
    },
    {
      question: 'Как принять предложение перевозчика?',
      answer: 'В списке заказов нажмите на заказ, просмотрите предложения перевозчиков и выберите подходящее. Нажмите "Принять предложение" для заключения договора.',
    },
    {
      question: 'Как работает система залога?',
      answer: 'При создании заказа заказчик блокирует 2% от стоимости заказа в качестве залога. Перевозчик также блокирует 2% при подаче предложения. Залог возвращается после успешного завершения перевозки.',
    },
    {
      question: 'Как вывести средства?',
      answer: 'Перейдите в раздел "Депозит" и нажмите "Вывести средства". Заполните реквизиты и сумму. Вывод обрабатывается в течение 1-3 рабочих дней.',
    },
    {
      question: 'Что такое партнерская программа?',
      answer: 'Партнеры получают 0.6% от суммы сделок привлеченных пользователей. Поделитесь своим реферальным кодом с новыми пользователями.',
    },
  ] : [
    {
      question: 'Buyurtma qanday yaratiladi?',
      answer: '"Buyurtma yaratish" bo\'limiga o\'ting, barcha zarur maydonlarni (yo\'nalish, yuk, narx) to\'ldiring va "Yaratish" tugmasini bosing.',
    },
    {
      question: 'Tashuvchining taklifini qanday qabul qilish mumkin?',
      answer: 'Buyurtmalar ro\'yxatida buyurtmani bosing, tashuvchilarning takliflarini ko\'rib chiqing va mosini tanlang. Shartnoma tuzish uchun "Taklifni qabul qilish" tugmasini bosing.',
    },
    {
      question: 'Garov tizimi qanday ishlaydi?',
      answer: 'Buyurtma yaratishda buyurtmachi buyurtma qiymatining 2% ni garov sifatida bloklaydi. Tashuvchi ham taklif berishda 2% bloklaydi. Garov tashish muvaffaqiyatli yakunlangandan so\'ng qaytariladi.',
    },
    {
      question: 'Mablag\'larni qanday yechib olish mumkin?',
      answer: '"Depozit" bo\'limiga o\'ting va "Mablag\' yechish" tugmasini bosing. Rekvizitlar va summani to\'ldiring. Yechish 1-3 ish kuni ichida amalga oshiriladi.',
    },
    {
      question: 'Hamkorlik dasturi nima?',
      answer: 'Hamkorlar jalb qilingan foydalanuvchilar bitimlaridan 0.6% olishadi. O\'z referal kodingizni yangi foydalanuvchilar bilan baham ko\'ring.',
    },
  ];

  const contactInfo = [
    { icon: 'call-outline', label: t.phone, value: '+998 93 969 88 99', action: () => Linking.openURL('tel:+998939698899') },
    { icon: 'paper-plane-outline', label: t.telegram, value: '@Yukbozor_Murojaat_Bot', action: () => Linking.openURL('https://t.me/Yukbozor_Murojaat_Bot') },
  ];

  const toggleFAQ = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
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
        <Text style={styles.headerTitle}>{t.title}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.faq}</Text>

        {faqItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.faqItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => toggleFAQ(index)}
            data-testid={`faq-item-${index}`}
          >
            <View style={styles.faqHeader}>
              <Text style={[styles.faqQuestion, { color: colors.foreground }]}>{item.question}</Text>
              <Ionicons 
                name={expandedIndex === index ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color={colors.mutedForeground} 
              />
            </View>
            {expandedIndex === index && (
              <Text style={[styles.faqAnswer, { color: colors.mutedForeground }]}>{item.answer}</Text>
            )}
          </TouchableOpacity>
        ))}

        <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>{t.contact}</Text>

        {contactInfo.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.contactItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={item.action}
            data-testid={`contact-item-${index}`}
          >
            <View style={[styles.contactIcon, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name={item.icon as any} size={24} color={colors.primary} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={[styles.contactLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
              <Text style={[styles.contactValue, { color: colors.foreground }]}>{item.value}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}

        <View style={[styles.workingHours, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="time-outline" size={24} color={colors.primary} />
          <View style={styles.workingHoursText}>
            <Text style={[styles.workingHoursLabel, { color: colors.mutedForeground }]}>{t.workingHours}</Text>
            <Text style={[styles.workingHoursValue, { color: colors.foreground }]}>{t.workingHoursValue}</Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  faqItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactLabel: {
    fontSize: 12,
  },
  contactValue: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 2,
  },
  workingHours: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginTop: 8,
  },
  workingHoursText: {
    marginLeft: 12,
  },
  workingHoursLabel: {
    fontSize: 12,
  },
  workingHoursValue: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 2,
  },
  bottomSpacer: {
    height: 32,
  },
});
