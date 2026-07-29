import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useQueryClient } from '@tanstack/react-query';
import { api, registerLogoutCallback } from '../services/api';
import { secureStorage } from '../services/secureStorage';
import { biometrics } from '../services/biometrics';
import { trackEvent } from '../services/analytics';

const AUTH_TOKEN_KEY = 'auth_token';
const USER_DATA_KEY = 'user_data';
const ACTIVE_ROLE_KEY = 'active_role';
const LAST_ACTIVITY_KEY = 'last_activity';
const LAST_UNLOCK_KEY = 'last_unlock_time';
const REPRESENTATIVE_MODE_ENABLED_KEY = 'representative_mode_enabled';
const ACTIVE_PRINCIPAL_KEY = 'active_principal';

const FIVE_MINUTES = 5 * 60 * 1000;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export type UserRole = 'customer' | 'carrier' | 'partner';

export interface User {
  id: number;
  phone: string;
  entityType: string;
  userType: 'legal' | 'ip' | 'individual';
  displayName?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  roles: UserRole[];
  defaultRole: UserRole;
  referralCode?: string;
  ndsPayer?: boolean;
  profile?: {
    companyName?: string;
    displayName?: string;
    inn?: string;
    pinfl?: string;
    passportSeries?: string;
    passportNumber?: string;
    bankName?: string;
    bankAccount?: string;
    bankCode?: string;
    ndsPayer?: boolean;
    registrationCodeNds?: string;
    eimzoVerified?: boolean;
    eimzoCertSerial?: string;
    eimzoCertValidTo?: string;
  };
}

export interface ActivePrincipal {
  customerId: number;
  customerName: string;
  customerInn: string;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPinSetup: boolean;
  isUnlocked: boolean;
  hasBiometrics: boolean;
  biometricsEnabled: boolean;
  
  activeRole: UserRole | null;
  isRoleSelected: boolean;
  
  representativeModeEnabled: boolean;
  setRepresentativeModeEnabled: (enabled: boolean) => Promise<void>;
  activePrincipal: ActivePrincipal | null;
  setActivePrincipal: (principal: ActivePrincipal | null) => Promise<void>;
  
  login: (phone: string, password: string) => Promise<void>;
  loginWithSms: (phone: string, code: string) => Promise<void>;
  sendLoginSms: (phone: string) => Promise<void>;
  loginWithTelegramToken: (token: string, userData: any) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  
  setActiveRole: (role: UserRole) => Promise<void>;
  
  completePinSetup: () => void;
  unlockApp: () => void;
  lockApp: () => void;
  
  checkPinStatus: () => Promise<boolean>;
  checkBiometricsStatus: () => Promise<{ available: boolean; enabled: boolean }>;
  updateReferralCode: (code: string) => void;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  phone: string;
  password: string;
  userType: 'legal' | 'ip' | 'individual';
  defaultRole: 'customer' | 'carrier' | 'partner';
  displayName?: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
  companyName?: string;
  inn?: string;
  pinfl?: string;
  referralCode?: string;
  language?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPinSetup, setIsPinSetup] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [activeRole, setActiveRoleState] = useState<UserRole | null>(null);
  const [representativeModeEnabled, setRepresentativeModeEnabledState] = useState(false);
  const [activePrincipal, setActivePrincipalState] = useState<ActivePrincipal | null>(null);

  useEffect(() => {
    registerLogoutCallback(() => {
      SecureStore.deleteItemAsync(USER_DATA_KEY).catch(() => {});
      SecureStore.deleteItemAsync(AUTH_TOKEN_KEY).catch(() => {});
      setUser(null);
      setActiveRoleState(null);
      setRepresentativeModeEnabledState(false);
      setActivePrincipalState(null);
    });
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      const biometricStatus = await biometrics.checkAvailability();
      setHasBiometrics(biometricStatus.isAvailable);

      const storedUserData = await SecureStore.getItemAsync(USER_DATA_KEY);
      const storedRole = await SecureStore.getItemAsync(ACTIVE_ROLE_KEY);
      
      const storedRepMode = await SecureStore.getItemAsync(REPRESENTATIVE_MODE_ENABLED_KEY);
      if (storedRepMode === 'true') {
        setRepresentativeModeEnabledState(true);
      }
      const storedPrincipal = await SecureStore.getItemAsync(ACTIVE_PRINCIPAL_KEY);
      if (storedPrincipal) {
        try {
          setActivePrincipalState(JSON.parse(storedPrincipal));
        } catch (e) {}
      }
      
      if (storedUserData) {
        const userData = JSON.parse(storedUserData);
        
        try {
          const response = await api.get('/api/auth/me');
          const { user: freshUser, token, profile } = response.data;
          const enrichedUser = { ...freshUser, ndsPayer: freshUser.ndsPayer ?? profile?.ndsPayer ?? false, profile };
          setUser(enrichedUser);
          await SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(enrichedUser));
          if (token) {
            await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
          }
          await SecureStore.setItemAsync(LAST_ACTIVITY_KEY, Date.now().toString());
        } catch (error) {
          setUser(userData);
        }
        
        if (storedRole && (storedRole === 'customer' || storedRole === 'carrier' || storedRole === 'partner')) {
          setActiveRoleState(storedRole as UserRole);
        }
        
        const pinSetup = await secureStorage.isPinSetup();
        setIsPinSetup(pinSetup);
        
        const bioEnabled = await secureStorage.isBiometricsEnabled();
        setBiometricsEnabled(bioEnabled);

        const lastUnlock = await SecureStore.getItemAsync(LAST_UNLOCK_KEY);
        if (lastUnlock) {
          const elapsed = Date.now() - parseInt(lastUnlock);
          if (elapsed < FIVE_MINUTES) {
            setIsUnlocked(true);
          } else if (elapsed > THIRTY_DAYS) {
            await SecureStore.deleteItemAsync(USER_DATA_KEY);
            await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
            await SecureStore.deleteItemAsync(ACTIVE_ROLE_KEY);
            await SecureStore.deleteItemAsync(LAST_UNLOCK_KEY);
            setUser(null);
            return;
          } else {
            setIsUnlocked(false);
          }
        } else {
          setIsUnlocked(false);
        }
      }
    } catch (error) {
      console.error('Auth init error:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const setActiveRole = async (role: UserRole) => {
    setActiveRoleState(role);
    await SecureStore.setItemAsync(ACTIVE_ROLE_KEY, role);
    
    try {
      await api.post('/api/auth/switch-role', { role });
    } catch (error) {
      console.error('Failed to sync role with server:', error);
    }
  };
  
  const isRoleSelected = activeRole !== null;

  const loginWithTelegramToken = async (jwtToken: string, userData: any) => {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, jwtToken);
    const enrichedUser = {
      ...userData,
      ndsPayer: userData.ndsPayer ?? userData.profile?.ndsPayer ?? false,
    };
    await SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(enrichedUser));
    await SecureStore.setItemAsync(LAST_ACTIVITY_KEY, Date.now().toString());
    setUser(enrichedUser);
    const pinSetup = await secureStorage.isPinSetup();
    setIsPinSetup(pinSetup);
    if (pinSetup) {
      setIsUnlocked(false);
    }
  };

  const login = async (phone: string, password: string) => {
    try {
      const response = await api.post('/api/auth/login', { phone, password });
      const { user: userData, token } = response.data;
      
      await SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(userData));
      await SecureStore.setItemAsync(LAST_ACTIVITY_KEY, Date.now().toString());
      if (token) {
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
      }
      
      setUser(userData);
      trackEvent('login', 'LoginScreen', { method: 'password' });
      
      const pinSetup = await secureStorage.isPinSetup();
      setIsPinSetup(pinSetup);
      
      if (pinSetup) {
        setIsUnlocked(false);
      }
      
      const bioEnabled = await secureStorage.isBiometricsEnabled();
      setBiometricsEnabled(bioEnabled);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  };
  
  const sendLoginSms = async (phone: string) => {
    try {
      await api.post('/api/sms/send-otp', { phone, purpose: 'login' });
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to send SMS');
    }
  };
  
  const loginWithSms = async (phone: string, code: string) => {
    try {
      const response = await api.post('/api/auth/login-sms', { phone, code });
      const { user: userData, token } = response.data;
      
      await SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(userData));
      await SecureStore.setItemAsync(LAST_ACTIVITY_KEY, Date.now().toString());
      if (token) {
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
      }
      
      setUser(userData);
      trackEvent('login', 'LoginScreen', { method: 'sms' });
      
      const pinSetup = await secureStorage.isPinSetup();
      setIsPinSetup(pinSetup);
      
      if (pinSetup) {
        setIsUnlocked(false);
      }
      
      const bioEnabled = await secureStorage.isBiometricsEnabled();
      setBiometricsEnabled(bioEnabled);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await api.post('/api/auth/register', data);
      const { user: userData, token } = response.data;
      
      await SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(userData));
      await SecureStore.setItemAsync(LAST_ACTIVITY_KEY, Date.now().toString());
      if (token) {
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
      }
      
      setUser(userData);
      setIsPinSetup(false);
      setIsUnlocked(false);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  };

  const setRepresentativeModeEnabled = async (enabled: boolean) => {
    setRepresentativeModeEnabledState(enabled);
    if (enabled) {
      await SecureStore.setItemAsync(REPRESENTATIVE_MODE_ENABLED_KEY, 'true');
    } else {
      await SecureStore.deleteItemAsync(REPRESENTATIVE_MODE_ENABLED_KEY);
      setActivePrincipalState(null);
      await SecureStore.deleteItemAsync(ACTIVE_PRINCIPAL_KEY);
      try {
        await api.post('/api/representatives/deactivate');
      } catch (e) {}
    }
  };

  const setActivePrincipal = async (principal: ActivePrincipal | null) => {
    setActivePrincipalState(principal);
    if (principal) {
      await SecureStore.setItemAsync(ACTIVE_PRINCIPAL_KEY, JSON.stringify(principal));
      try {
        await api.post(`/api/representatives/activate/${principal.customerId}`);
      } catch (e) {
        console.error('Failed to activate principal on server:', e);
      }
    } else {
      await SecureStore.deleteItemAsync(ACTIVE_PRINCIPAL_KEY);
      try {
        await api.post('/api/representatives/deactivate');
      } catch (e) {}
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    trackEvent('logout');
    await SecureStore.deleteItemAsync(USER_DATA_KEY);
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(ACTIVE_ROLE_KEY);
    await SecureStore.deleteItemAsync(REPRESENTATIVE_MODE_ENABLED_KEY);
    await SecureStore.deleteItemAsync(ACTIVE_PRINCIPAL_KEY);
    await SecureStore.deleteItemAsync(LAST_UNLOCK_KEY);
    await secureStorage.clearAll();

    // Clear all cached query data so new user sees fresh data
    queryClient.clear();
    
    setUser(null);
    setActiveRoleState(null);
    setIsPinSetup(false);
    setIsUnlocked(false);
    setBiometricsEnabled(false);
    setRepresentativeModeEnabledState(false);
    setActivePrincipalState(null);
  };

  const completePinSetup = () => {
    setIsPinSetup(true);
    setIsUnlocked(true);
    SecureStore.setItemAsync(LAST_UNLOCK_KEY, Date.now().toString()).catch(() => {});
  };

  const unlockApp = () => {
    setIsUnlocked(true);
    SecureStore.setItemAsync(LAST_UNLOCK_KEY, Date.now().toString()).catch(() => {});
  };

  const lockApp = () => {
    setIsUnlocked(false);
  };

  const checkPinStatus = async (): Promise<boolean> => {
    const status = await secureStorage.isPinSetup();
    setIsPinSetup(status);
    return status;
  };

  const checkBiometricsStatus = async () => {
    const biometricStatus = await biometrics.checkAvailability();
    setHasBiometrics(biometricStatus.isAvailable);
    
    const enabled = await secureStorage.isBiometricsEnabled();
    setBiometricsEnabled(enabled);
    
    return { available: biometricStatus.isAvailable, enabled };
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const response = await api.get('/api/auth/me');
      const { user: freshUser, token, profile } = response.data;
      const enrichedUser = { ...freshUser, ndsPayer: freshUser.ndsPayer ?? profile?.ndsPayer ?? false, profile };
      setUser(enrichedUser);
      await SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(enrichedUser));
      if (token) {
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
      }
    } catch (error) {
      console.error('refreshUser error:', error);
    }
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated,
      isPinSetup,
      isUnlocked,
      hasBiometrics,
      biometricsEnabled,
      activeRole,
      isRoleSelected,
      representativeModeEnabled,
      setRepresentativeModeEnabled,
      activePrincipal,
      setActivePrincipal,
      login,
      loginWithSms,
      sendLoginSms,
      loginWithTelegramToken,
      register,
      logout,
      setActiveRole,
      completePinSetup,
      unlockApp,
      lockApp,
      checkPinStatus,
      checkBiometricsStatus,
      updateReferralCode: (code: string) => {
        setUser(prev => prev ? { ...prev, referralCode: code } : prev);
      },
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
