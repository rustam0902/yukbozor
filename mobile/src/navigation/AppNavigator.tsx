import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './navigationRef';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useEffect } from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import { setCurrentScreen } from '../services/analytics';

import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { PinSetupScreen } from '../screens/PinSetupScreen';
import { PinLoginScreen } from '../screens/PinLoginScreen';
import { RoleSelectionScreen } from '../screens/RoleSelectionScreen';
import { CustomerHomeScreen } from '../screens/CustomerHomeScreen';
import { CarrierHomeScreen } from '../screens/CarrierHomeScreen';
import { PartnerHomeScreen } from '../screens/PartnerHomeScreen';
import { DealsScreen } from '../screens/DealsScreen';
import { DepositScreen } from '../screens/DepositScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SecurityScreen } from '../screens/SecurityScreen';
import { ChangePinScreen } from '../screens/ChangePinScreen';
import { ContractSignScreen } from '../screens/ContractSignScreen';
import { ContractDetailScreen } from '../screens/ContractDetailScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { CreateOrderScreen } from '../screens/CreateOrderScreen';
import { MyOffersScreen } from '../screens/MyOffersScreen';
import { ReferralScreen } from '../screens/ReferralScreen';
import { OrderDetailScreen } from '../screens/OrderDetailScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { HelpScreen } from '../screens/HelpScreen';
import { RewardsScreen } from '../screens/RewardsScreen';
import { WithdrawScreen } from '../screens/WithdrawScreen';
import { PrincipalsScreen } from '../screens/PrincipalsScreen';
import { RepresentativesScreen } from '../screens/RepresentativesScreen';
import { MyAnnouncementsScreen } from '../screens/MyAnnouncementsScreen';
import { MyTemplatesScreen } from '../screens/MyTemplatesScreen';
import { CargoListScreen } from '../screens/CargoListScreen';
import { ChatRoomsScreen } from '../screens/ChatRoomsScreen';
import { ChatRoomScreen } from '../screens/ChatRoomScreen';
import { PublicOrdersScreen } from '../screens/PublicOrdersScreen';
import { PrincipalOrdersScreen } from '../screens/PrincipalOrdersScreen';
import { PrincipalContractsScreen } from '../screens/PrincipalContractsScreen';
import { OrderTemplatesScreen } from '../screens/OrderTemplatesScreen';
import { RatingPrompt, incrementLaunchCount } from '../components/RatingPrompt';
import { PushNotificationSettingsScreen } from '../screens/PushNotificationSettingsScreen';
import { ForceUpdateScreen } from '../components/ForceUpdateScreen';
import { StoreUpdateBanner } from '../components/StoreUpdateBanner';
import { isForceUpdateRequired } from '../hooks/useForceUpdate';
import { useOtaUpdates } from '../hooks/useOtaUpdates';
import { initAnalytics } from '../services/analytics';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

type TabIconName = 'home' | 'home-outline' | 'add-circle' | 'add-circle-outline' | 
  'briefcase' | 'briefcase-outline' | 'person' | 'person-outline' |
  'search' | 'search-outline' | 'document-text' | 'document-text-outline' |
  'people' | 'people-outline' | 'gift' | 'gift-outline' |
  'megaphone' | 'megaphone-outline' | 'copy' | 'copy-outline' |
  'cube' | 'cube-outline' | 'business' | 'business-outline' |
  'folder' | 'folder-outline' |
  'chatbubbles' | 'chatbubbles-outline';

interface TabBarIconProps {
  focused: boolean;
  color: string;
  size: number;
}

const TAB_BAR_OPTIONS = {
  headerShown: false as const,
  tabBarActiveTintColor: Colors.light.primary,
  tabBarInactiveTintColor: Colors.light.mutedForeground,
};

function useTabBarStyle() {
  const insets = useSafeAreaInsets();
  return {
    backgroundColor: Colors.light.background,
    borderTopColor: Colors.light.border,
    height: 60 + insets.bottom,
    paddingTop: 8,
    paddingBottom: insets.bottom + 8,
  };
}

function GuestTabs({ navigation }: { navigation?: any }) {
  const { language, setLanguage } = useLanguage();
  const colors = Colors.light;
  const ru = language === 'ru';
  const tabBarStyle = useTabBarStyle();

  return (
    <Tab.Navigator
      screenOptions={{
        ...TAB_BAR_OPTIONS,
        tabBarStyle,
        headerShown: true,
        headerStyle: { backgroundColor: colors.background, height: 60 },
        headerShadowVisible: false,
        headerTitle: () => <Logo size="md" />,
        headerRight: () => (
          <View style={{ flexDirection: 'row', marginRight: 12 }}>
            <TouchableOpacity
              onPress={() => setLanguage('ru')}
              style={[
                guestStyles.langBtn,
                language === 'ru' && { backgroundColor: colors.primary }
              ]}
            >
              <Text style={{ color: language === 'ru' ? '#fff' : colors.foreground, fontSize: 12, fontWeight: '600' }}>RU</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setLanguage('uz')}
              style={[
                guestStyles.langBtn,
                language === 'uz' && { backgroundColor: colors.primary },
                { marginLeft: 4 }
              ]}
            >
              <Text style={{ color: language === 'uz' ? '#fff' : colors.foreground, fontSize: 12, fontWeight: '600' }}>UZ</Text>
            </TouchableOpacity>
          </View>
        ),
      }}
    >
      <Tab.Screen
        name="GuestAnnouncements"
        component={CargoListScreen}
        initialParams={{ hideTopInset: true }}
        options={{
          tabBarLabel: ru ? 'Объявления' : 'E\'lonlar',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'megaphone' : 'megaphone-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="GuestOrders"
        component={PublicOrdersScreen}
        options={{
          tabBarLabel: ru ? 'Заказы' : 'Buyurtmalar',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'cube' : 'cube-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="GuestChat"
        component={ChatRoomsScreen}
        options={{
          tabBarLabel: ru ? 'Чат' : 'Chat',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={24} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="GuestLogin"
        component={LoginScreen}
        options={{
          tabBarLabel: ru ? 'Войти' : 'Kirish',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
}

const guestStyles = StyleSheet.create({
  langBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
});

function CustomerTabsLegalIP() {
  const { language } = useLanguage();
  const tabBarStyle = useTabBarStyle();

  return (
    <Tab.Navigator screenOptions={{ ...TAB_BAR_OPTIONS, tabBarStyle }}>
      <Tab.Screen
        name="CustomerHome"
        component={CustomerHomeScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Мои заказы' : 'Buyurtmalarim',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Deals"
        component={DealsScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Сделки' : 'Bitimlar',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'briefcase' : 'briefcase-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="OrderTemplates"
        component={OrderTemplatesScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Шаблоны' : 'Shablonlar',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'copy' : 'copy-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ChatLegalIP"
        component={ChatRoomsScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Чат' : 'Chat',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={24} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Профиль' : 'Profil',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function CustomerTabsIndividualNormal() {
  const { language } = useLanguage();
  const tabBarStyle = useTabBarStyle();

  return (
    <Tab.Navigator screenOptions={{ ...TAB_BAR_OPTIONS, tabBarStyle }}>
      <Tab.Screen
        name="MyAnnouncements"
        component={MyAnnouncementsScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Объявления' : 'E\'lonlarim',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'megaphone' : 'megaphone-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MyTemplates"
        component={MyTemplatesScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Шаблоны' : 'Shablonlar',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'copy' : 'copy-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CargoList"
        component={CargoListScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Грузы' : 'Yuklar',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'cube' : 'cube-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ChatIndividualNormal"
        component={ChatRoomsScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Чат' : 'Chat',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={24} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Профиль' : 'Profil',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function CustomerTabsIndividualRepresentative() {
  const { language } = useLanguage();
  const tabBarStyle = useTabBarStyle();

  return (
    <Tab.Navigator screenOptions={{ ...TAB_BAR_OPTIONS, tabBarStyle }}>
      <Tab.Screen
        name="Principals"
        component={PrincipalsScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Доверители' : 'Ishonch beruvchilar',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'business' : 'business-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="PrincipalOrders"
        component={PrincipalOrdersScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Заказы' : 'Buyurtmalar',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'folder' : 'folder-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="PrincipalContracts"
        component={PrincipalContractsScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Договоры' : 'Shartnomalar',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ChatRepresentative"
        component={ChatRoomsScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Чат' : 'Chat',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={24} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Профиль' : 'Profil',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function CustomerTabs() {
  const { user, representativeModeEnabled } = useAuth();
  const isIndividual = user?.userType === 'individual';

  if (isIndividual && representativeModeEnabled) {
    return <CustomerTabsIndividualRepresentative />;
  }
  if (isIndividual) {
    return <CustomerTabsIndividualNormal />;
  }
  return <CustomerTabsLegalIP />;
}

function CarrierTabs() {
  const { language } = useLanguage();
  const tabBarStyle = useTabBarStyle();

  return (
    <Tab.Navigator screenOptions={{ ...TAB_BAR_OPTIONS, tabBarStyle }}>
      <Tab.Screen
        name="CarrierAnnouncements"
        component={CargoListScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Объявления' : "E'lonlar",
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'megaphone' : 'megaphone-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CarrierHome"
        component={CarrierHomeScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Заказы' : 'Buyurtmalar',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MyOffers"
        component={MyOffersScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Мои предложения' : 'Takliflarim',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Deals"
        component={DealsScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Сделки' : 'Bitimlar',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'briefcase' : 'briefcase-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Профиль' : 'Profil',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function PartnerTabs() {
  const { language } = useLanguage();
  const tabBarStyle = useTabBarStyle();

  return (
    <Tab.Navigator screenOptions={{ ...TAB_BAR_OPTIONS, tabBarStyle }}>
      <Tab.Screen
        name="PartnerHome"
        component={PartnerHomeScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Главная' : 'Bosh sahifa',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Referral"
        component={ReferralScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Рефералы' : 'Referallar',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Rewards"
        component={RewardsScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Бонусы' : 'Bonuslar',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'gift' : 'gift-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="PartnerChat"
        component={ChatRoomsScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Чат' : 'Chat',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={24} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: language === 'ru' ? 'Профиль' : 'Profil',
          tabBarIcon: ({ focused, color }: TabBarIconProps) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function MainStack() {
  const { activeRole } = useAuth();
  
  const TabsComponent = activeRole === 'carrier' 
    ? CarrierTabs 
    : activeRole === 'partner' 
      ? PartnerTabs 
      : CustomerTabs;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeTabs" component={TabsComponent} />
      <Stack.Screen name="Security" component={SecurityScreen} />
      <Stack.Screen name="ChangePinScreen" component={ChangePinScreen} />
      <Stack.Screen name="ContractSign" component={ContractSignScreen} />
      <Stack.Screen name="ContractDetail" component={ContractDetailScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Deposit" component={DepositScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="Withdraw" component={WithdrawScreen} />
      <Stack.Screen name="Principals" component={PrincipalsScreen} />
      <Stack.Screen name="Representatives" component={RepresentativesScreen} />
      <Stack.Screen name="Referral" component={ReferralScreen} />
      <Stack.Screen name="CreateOrder" component={CreateOrderScreen} />
      <Stack.Screen name="PushNotificationSettings" component={PushNotificationSettingsScreen} />
      <Stack.Screen name="ChatRoom" component={ChatRoomScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function GuestStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GuestTabs" component={GuestTabs} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="PushNotificationSettings" component={PushNotificationSettingsScreen} />
      <Stack.Screen name="ChatRoom" component={ChatRoomScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function PinSetupWithAuth(props: any) {
  const { completePinSetup } = useAuth();
  
  return (
    <PinSetupScreen 
      {...props}
      route={{ 
        ...props.route,
        params: { 
          ...props.route?.params,
          onComplete: completePinSetup 
        } 
      }}
    />
  );
}

function PinLoginWithAuth(props: any) {
  const { unlockApp, logout } = useAuth();
  
  return (
    <PinLoginScreen 
      {...props}
      route={{ 
        ...props.route,
        params: { 
          ...props.route?.params,
          onSuccess: unlockApp,
          onLogout: logout 
        } 
      }}
    />
  );
}

export function AppNavigator() {
  const { isAuthenticated, isLoading, isPinSetup, isUnlocked, isRoleSelected } = useAuth();
  const { language } = useLanguage();

  useOtaUpdates(language);

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (isAuthenticated && isUnlocked && isRoleSelected) {
      incrementLaunchCount();
    }
  }, [isAuthenticated, isUnlocked, isRoleSelected]);

  if (isForceUpdateRequired()) {
    return <ForceUpdateScreen language={language} />;
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Logo size="lg" />
      </View>
    );
  }

  function handleNavigationStateChange() {
    const routeName = navigationRef.getCurrentRoute()?.name ?? 'unknown';
    setCurrentScreen(routeName);
  }

  return (
    <NavigationContainer ref={navigationRef} onStateChange={handleNavigationStateChange}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Guest" component={GuestStack} />
        ) : !isPinSetup ? (
          <Stack.Screen name="PinSetup" component={PinSetupWithAuth} />
        ) : !isUnlocked ? (
          <Stack.Screen name="PinLogin" component={PinLoginWithAuth} />
        ) : !isRoleSelected ? (
          <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainStack} />
        )}
      </Stack.Navigator>
      {isAuthenticated && isUnlocked && isRoleSelected && <RatingPrompt />}
      <StoreUpdateBanner language={language} />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2563eb',
  },
});
