import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { apiRequest, queryClient } from "../lib/queryClient";

interface User {
  id: number;
  phone: string;
  displayName: string;
  roles: Array<'customer' | 'carrier' | 'partner' | 'admin'>;
  defaultRole: 'customer' | 'carrier' | 'partner' | 'admin';
  userType?: string;
  email?: string;
  ndsPayer?: boolean;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  companyName?: string;
  inn?: string;
  pinfl?: string;
  passportSeries?: string;
  passportNumber?: string;
  bankAccount?: string;
  bankName?: string;
  bankCode?: string;
  registrationCodeNds?: string;
  eimzoCertExpired?: boolean;
  eimzoCertValidTo?: string;
}

interface RepresentativeMode {
  active: boolean;
  customerId?: number;
  customerName?: string;
  companyName?: string;
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
  representativeMode: RepresentativeMode | null;
  activateRepresentativeMode: (customerId: number) => Promise<void>;
  deactivateRepresentativeMode: () => Promise<void>;
  effectiveCustomerId: number | null;
  representativeModeEnabled: boolean;
  setRepresentativeModeEnabled: (enabled: boolean) => void;
  representativeModeInitialized: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const INACTIVITY_TIMEOUT = 30 * 60 * 1000;
const REPRESENTATIVE_MODE_KEY = 'yukbozor_representative_mode';
const REPRESENTATIVE_MODE_ENABLED_KEY = 'yukbozor_representative_mode_enabled';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [representativeMode, setRepresentativeMode] = useState<RepresentativeMode | null>(null);
  const [representativeModeEnabled, setRepresentativeModeEnabledState] = useState<boolean>(false);
  const [representativeModeInitialized, setRepresentativeModeInitialized] = useState<boolean>(false);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load representative mode and enabled state from localStorage on mount
  useEffect(() => {
    try {
      // Load representative mode
      const storedMode = localStorage.getItem(REPRESENTATIVE_MODE_KEY);
      if (storedMode) {
        const parsed = JSON.parse(storedMode);
        if (parsed && parsed.active) {
          setRepresentativeMode(parsed);
        }
      }
      
      // Load representativeModeEnabled
      const storedEnabled = localStorage.getItem(REPRESENTATIVE_MODE_ENABLED_KEY);
      if (storedEnabled === 'true') {
        setRepresentativeModeEnabledState(true);
      }
    } catch (e) {
      console.error('Failed to load representative mode from localStorage:', e);
    }
    
    // Mark as initialized after loading from localStorage
    setRepresentativeModeInitialized(true);
  }, []);

  // Save representative mode to localStorage when it changes
  useEffect(() => {
    if (representativeMode) {
      localStorage.setItem(REPRESENTATIVE_MODE_KEY, JSON.stringify(representativeMode));
    } else {
      localStorage.removeItem(REPRESENTATIVE_MODE_KEY);
    }
  }, [representativeMode]);

  // Function to set representativeModeEnabled with localStorage persistence
  const setRepresentativeModeEnabled = useCallback((enabled: boolean) => {
    setRepresentativeModeEnabledState(enabled);
    if (enabled) {
      localStorage.setItem(REPRESENTATIVE_MODE_ENABLED_KEY, 'true');
    } else {
      localStorage.removeItem(REPRESENTATIVE_MODE_ENABLED_KEY);
      // Also deactivate representative mode when disabled
      if (representativeMode?.active) {
        setRepresentativeMode(null);
      }
    }
  }, [representativeMode]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        const userData = data.user;
        if (userData && !Array.isArray(userData.roles)) {
          userData.roles = userData.role ? [userData.role] : ['customer'];
        }
        if (userData && !userData.defaultRole) {
          // Admin role takes priority
          if (userData.roles.includes('admin')) {
            userData.defaultRole = 'admin';
          } else {
            userData.defaultRole = userData.roles[0] || 'customer';
          }
        }
        if (data.profile) {
          userData.ndsPayer = data.profile.ndsPayer;
          userData.firstName = data.profile.firstName;
          userData.lastName = data.profile.lastName;
          userData.middleName = data.profile.middleName;
          userData.companyName = data.profile.companyName;
          userData.inn = data.profile.inn;
          userData.pinfl = data.profile.pinfl;
          userData.passportSeries = data.profile.passportSeries;
          userData.passportNumber = data.profile.passportNumber;
          userData.bankAccount = data.profile.bankAccount;
          userData.bankName = data.profile.bankName;
          userData.bankCode = data.profile.bankCode;
          userData.registrationCodeNds = data.profile.registrationCodeNds;
        }
        // Add E-IMZO certificate expiry info
        userData.eimzoCertExpired = data.eimzoCertExpired;
        userData.eimzoCertValidTo = data.eimzoCertValidTo;
        setUser(userData);
      } else {
        setUser(null);
        // Clear representative mode if user is not authenticated
        setRepresentativeMode(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleInactivityLogout = useCallback(() => {
    console.log('Session expired due to inactivity');
    queryClient.clear();
    setUser(null);
    setRepresentativeMode(null);
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    if (user) {
      inactivityTimerRef.current = setTimeout(() => {
        handleInactivityLogout();
      }, INACTIVITY_TIMEOUT);
    }
  }, [user, handleInactivityLogout]);

  const login = async (phone: string, password: string) => {
    queryClient.clear();
    const res = await apiRequest('POST', '/api/auth/login', { phone, password });
    const data = await res.json();
    setUser(data.user);
  };

  const register = async (registrationData: any) => {
    queryClient.clear();
    const res = await apiRequest('POST', '/api/auth/register', registrationData);
    const data = await res.json();
    setUser(data.user);
  };

  const logout = async () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    await apiRequest('POST', '/api/auth/logout');
    queryClient.clear();
    setUser(null);
    setRepresentativeMode(null);
  };

  const refetch = async () => {
    await checkAuth();
  };

  const activateRepresentativeMode = async (customerId: number) => {
    const res = await apiRequest('POST', `/api/representatives/activate/${customerId}`);
    const data = await res.json();
    
    if (data.success) {
      const mode: RepresentativeMode = {
        active: true,
        customerId: data.customerId,
        customerName: data.customerName,
        companyName: data.companyName,
        permissions: data.permissions,
      };
      setRepresentativeMode(mode);
      // Clear query cache to reload data for new context
      queryClient.clear();
    } else {
      throw new Error(data.error || 'Failed to activate representative mode');
    }
  };

  const deactivateRepresentativeMode = async () => {
    await apiRequest('POST', '/api/representatives/deactivate');
    setRepresentativeMode(null);
    // Clear query cache to reload data for original user
    queryClient.clear();
  };

  // Effective customer ID - either the represented customer or null
  const effectiveCustomerId = representativeMode?.active ? representativeMode.customerId ?? null : null;

  useEffect(() => {
    const handleActivity = () => {
      resetInactivityTimer();
    };

    if (user) {
      window.addEventListener('mousedown', handleActivity);
      window.addEventListener('keydown', handleActivity);
      window.addEventListener('touchstart', handleActivity);
      window.addEventListener('scroll', handleActivity);

      return () => {
        window.removeEventListener('mousedown', handleActivity);
        window.removeEventListener('keydown', handleActivity);
        window.removeEventListener('touchstart', handleActivity);
        window.removeEventListener('scroll', handleActivity);
      };
    }
  }, [user, resetInactivityTimer]);

  useEffect(() => {
    if (user) {
      resetInactivityTimer();
    } else {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    }
  }, [user, resetInactivityTimer]);

  useEffect(() => {
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      register, 
      logout, 
      refetch,
      representativeMode,
      activateRepresentativeMode,
      deactivateRepresentativeMode,
      effectiveCustomerId,
      representativeModeEnabled,
      setRepresentativeModeEnabled,
      representativeModeInitialized,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export type { User, AuthContextType, RepresentativeMode };
