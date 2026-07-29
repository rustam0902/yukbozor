import React, { Component, ReactNode, useEffect, useState } from 'react';
import { Text, View, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Ionicons } from '@expo/vector-icons';

import { AuthProvider } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { usePushNotifications, usePushNotificationTapListener } from './src/hooks/usePushNotifications';
import { useOtaUpdates } from './src/hooks/useOtaUpdates';
import { useAuth } from './src/context/AuthContext';
import { useLanguage } from './src/context/LanguageContext';
import { isForceUpdateRequired } from './src/hooks/useForceUpdate';
import { ForceUpdateScreen } from './src/components/ForceUpdateScreen';

SplashScreen.preventAutoHideAsync();

interface ErrorBoundaryState {
  hasError: boolean;
  error: string;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error: error.message + '\n\n' + error.stack };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#d32f2f', marginBottom: 12 }}>
            Ошибка запуска приложения
          </Text>
          <ScrollView>
            <Text style={{ fontSize: 12, color: '#333', fontFamily: 'monospace' }}>
              {this.state.error}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function OtaUpdatesSetup() {
  const { language } = useLanguage();
  useOtaUpdates(language);
  return null;
}

function PushNotificationsSetup() {
  const { isAuthenticated, activeRole } = useAuth();

  usePushNotifications();

  usePushNotificationTapListener(() => {
    if (!navigationRef.isReady()) return;

    if (!isAuthenticated) {
      navigationRef.navigate('GuestAnnouncements' as never);
      return;
    }

    if (activeRole === 'carrier') {
      navigationRef.navigate('CarrierAnnouncements' as never);
    } else {
      navigationRef.navigate('CargoList' as never);
    }
  });

  return null;
}

function ForceUpdateGate({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage();
  if (isForceUpdateRequired()) {
    return <ForceUpdateScreen language={language} />;
  }
  return <>{children}</>;
}

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    Font.loadAsync(Ionicons.font)
      .catch(() => {})
      .finally(() => {
        setFontsLoaded(true);
        SplashScreen.hideAsync().catch(() => {});
      });
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <LanguageProvider>
              <ForceUpdateGate>
                <AuthProvider>
                  <OtaUpdatesSetup />
                  <PushNotificationsSetup />
                  <AppNavigator />
                  <StatusBar style="auto" />
                </AuthProvider>
              </ForceUpdateGate>
            </LanguageProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
