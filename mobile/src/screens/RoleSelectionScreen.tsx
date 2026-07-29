import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth, UserRole } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

interface RoleSelectionScreenProps {
  navigation?: any;
}

interface RoleOption {
  role: UserRole;
  titleRu: string;
  titleUz: string;
  descriptionRu: string;
  descriptionUz: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const roleOptions: RoleOption[] = [
  {
    role: 'customer',
    titleRu: 'Заказчик',
    titleUz: 'Buyurtmachi',
    descriptionRu: 'Размещайте заказы на перевозку грузов и выбирайте лучшие предложения от перевозчиков',
    descriptionUz: 'Yuk tashish buyurtmalarini joylashtiring va tashuvchilarning eng yaxshi takliflarini tanlang',
    icon: 'cube-outline',
    color: '#3B82F6',
  },
  {
    role: 'carrier',
    titleRu: 'Перевозчик',
    titleUz: 'Tashuvchi',
    descriptionRu: 'Находите заказы на перевозку и отправляйте свои предложения заказчикам',
    descriptionUz: 'Yuk tashish buyurtmalarini toping va buyurtmachilarga takliflaringizni yuboring',
    icon: 'car-outline',
    color: '#10B981',
  },
  {
    role: 'partner',
    titleRu: 'Партнёр',
    titleUz: 'Hamkor',
    descriptionRu: 'Приглашайте новых заказчиков и получайте комиссию с каждой их сделки',
    descriptionUz: 'Yangi buyurtmachilarni taklif qiling va ularning har bir bitimidan komissiya oling',
    icon: 'people-outline',
    color: '#F59E0B',
  },
];

export function RoleSelectionScreen({ navigation }: RoleSelectionScreenProps) {
  const { language } = useLanguage();
  const { user, setActiveRole } = useAuth();
  const colors = Colors.light;

  const userRoles = user?.roles || [];
  const hasRoles = userRoles.length > 0;
  const isIndividual = user?.userType === 'individual' || user?.entityType === 'physical_person';
  
  const filteredRoles = hasRoles 
    ? roleOptions.filter(option => userRoles.includes(option.role))
    : user?.defaultRole 
      ? roleOptions.filter(option => option.role === user.defaultRole)
      : roleOptions;

  const availableRoles = isIndividual 
    ? filteredRoles.filter(option => option.role !== 'carrier')
    : filteredRoles;

  const handleSelectRole = async (role: UserRole) => {
    const allowedRoles = user?.roles || [user?.defaultRole];
    if (!allowedRoles.includes(role)) {
      return;
    }
    await setActiveRole(role);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {language === 'ru' ? 'Выберите режим работы' : 'Ish rejimini tanlang'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {language === 'ru' 
              ? 'Вы можете переключаться между режимами в любое время в настройках профиля'
              : 'Profil sozlamalarida istalgan vaqtda rejimlarni almashtirishingiz mumkin'}
          </Text>
        </View>

        <View style={styles.rolesContainer}>
          {availableRoles.map((option) => (
            <TouchableOpacity
              key={option.role}
              style={[styles.roleCard, { borderColor: option.color }]}
              onPress={() => handleSelectRole(option.role)}
              activeOpacity={0.7}
              testID={`button-select-role-${option.role}`}
            >
              <View style={[styles.iconContainer, { backgroundColor: option.color + '20' }]}>
                <Ionicons name={option.icon} size={32} color={option.color} />
              </View>
              <Text style={[styles.roleTitle, { color: colors.foreground }]}>
                {language === 'ru' ? option.titleRu : option.titleUz}
              </Text>
              <Text style={[styles.roleDescription, { color: colors.mutedForeground }]}>
                {language === 'ru' ? option.descriptionRu : option.descriptionUz}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {availableRoles.length === 0 && (
          <View style={styles.noRolesContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.noRolesText, { color: colors.mutedForeground }]}>
              {language === 'ru' 
                ? 'Нет доступных ролей. Обратитесь в поддержку.'
                : 'Mavjud rollar yo\'q. Qo\'llab-quvvatlash xizmatiga murojaat qiling.'}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  rolesContainer: {
    flex: 1,
    gap: 16,
  },
  roleCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  roleDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  noRolesContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  noRolesText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
