import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Edit, Lock, MessageSquare, Eye, EyeOff, Loader2, KeyRound, RefreshCw, AlertCircle, CheckCircle, Building2, UserCheck, LogOut, Users } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import { usePhoneInput } from '@/hooks/use-phone-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { eimzoService, type EImzoKey } from '@/lib/e-imzo';
import { NotificationSettings } from './NotificationSettings';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PERMISSION_LABELS, type RepresentativePermission } from '@shared/schema';

interface ProfileViewProps {
  language: 'ru' | 'uz';
}

interface Principal {
  id: number;
  customerId: number;
  permissions: RepresentativePermission[];
  isActive: boolean;
  customer: {
    id: number;
    displayName: string;
    phone: string;
    userType: string;
    companyName?: string;
    inn?: string;
  } | null;
}

export function ProfileView({ language }: ProfileViewProps) {
  const { user: authUser, refetch: refetchUser, representativeMode, activateRepresentativeMode, deactivateRepresentativeMode } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingUpdates, setPendingUpdates] = useState<any>(null);
  
  // Fetch fresh profile data directly from API
  const { data: profileData, isLoading: isLoadingProfile } = useQuery<{ user: any; profile: any }>({
    queryKey: ['/api/auth/me'],
    staleTime: 0,
  });

  // Merge auth user with fresh profile data
  const user = profileData ? {
    ...profileData.user,
    ...(profileData.profile || {}),
  } : authUser;
  
  // Password change state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [smsCode, setSmsCode] = useState('');
  
  // SMS password change state
  const [newPasswordSms, setNewPasswordSms] = useState('');
  const [confirmPasswordSms, setConfirmPasswordSms] = useState('');
  const [showNewPasswordSms, setShowNewPasswordSms] = useState(false);
  const [showConfirmPasswordSms, setShowConfirmPasswordSms] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [smsCooldown, setSmsCooldown] = useState(0);
  const [smsSending, setSmsSending] = useState(false);
  const [smsPasswordChanging, setSmsPasswordChanging] = useState(false);
  
  // Profile edit SMS verification state
  const [profileSmsSent, setProfileSmsSent] = useState(false);
  const [profileSmsCooldown, setProfileSmsCooldown] = useState(0);
  const [profileSmsSending, setProfileSmsSending] = useState(false);
  const [profileSmsVerifying, setProfileSmsVerifying] = useState(false);

  // Phone change state
  const [phoneChangeDialogOpen, setPhoneChangeDialogOpen] = useState(false);
  const [phoneChangeStep, setPhoneChangeStep] = useState<'select' | 'verify_old' | 'verify_password' | 'verify_new' | 'cooldown'>('select');
  const newPhoneInput = usePhoneInput();
  const [hasOldPhoneAccess, setHasOldPhoneAccess] = useState(true);
  const [phoneChangeRequestId, setPhoneChangeRequestId] = useState<number | null>(null);
  const [phoneChangePassword, setPhoneChangePassword] = useState('');
  const [showPhoneChangePassword, setShowPhoneChangePassword] = useState(false);
  const [phoneOldOtp, setPhoneOldOtp] = useState('');
  const [phoneNewOtp, setPhoneNewOtp] = useState('');
  const [phoneOldSmsCooldown, setPhoneOldSmsCooldown] = useState(0);
  const [phoneNewSmsCooldown, setPhoneNewSmsCooldown] = useState(0);
  const [phoneOldSmsSending, setPhoneOldSmsSending] = useState(false);
  const [phoneNewSmsSending, setPhoneNewSmsSending] = useState(false);
  const [phoneVerifying, setPhoneVerifying] = useState(false);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<Date | null>(null);

  // E-IMZO state for profile verification
  const [eimzoKeys, setEimzoKeys] = useState<EImzoKey[]>([]);
  const [selectedEimzoKey, setSelectedEimzoKey] = useState<EImzoKey | null>(null);
  const [eimzoLoading, setEimzoLoading] = useState(false);
  const [eimzoError, setEimzoError] = useState<string | null>(null);
  const [eimzoSigning, setEimzoSigning] = useState(false);

  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    firstName: '',
    lastName: '',
    middleName: '',
    companyName: '',
    inn: '',
    pinfl: '',
    passportSeries: '',
    passportNumber: '',
    bankAccount: '',
    bankName: '',
    bankCode: '',
    ndsPayer: false,
    registrationCodeNds: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        displayName: user.displayName || '',
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        middleName: user.middleName || '',
        companyName: user.companyName || '',
        inn: user.inn || '',
        pinfl: user.pinfl || '',
        passportSeries: user.passportSeries || '',
        passportNumber: user.passportNumber || '',
        bankAccount: user.bankAccount || '',
        bankName: user.bankName || '',
        bankCode: user.bankCode || '',
        ndsPayer: user.ndsPayer || false,
        registrationCodeNds: user.registrationCodeNds || '',
      });
    }
  }, [user?.id, user?.ndsPayer, user?.firstName, user?.lastName, user?.companyName, user?.inn, user?.bankAccount, profileData]);

  const texts = {
    ru: {
      profile: 'Профиль',
      displayName: 'Отображаемое имя',
      email: 'Email',
      phone: 'Телефон',
      firstName: 'Имя',
      lastName: 'Фамилия',
      middleName: 'Отчество',
      companyName: 'Название компании',
      inn: 'ИНН',
      pinfl: 'ПИНФЛ',
      passportSeries: 'Серия паспорта',
      passportNumber: 'Номер паспорта',
      bankAccount: 'Расчетный счет',
      bankName: 'Банк',
      bankCode: 'Код банка',
      role: 'Основная роль',
      userType: 'Тип пользователя',
      vatPayer: 'Плательщик НДС',
      vatYes: 'Да',
      vatNo: 'Нет',
      registrationCodeNds: 'Регистрационный код плательщика НДС',
      edit: 'Редактировать',
      save: 'Сохранить',
      cancel: 'Отмена',
      verifyChanges: 'Подтвердить изменения',
      smsVerification: 'SMS подтверждение',
      sendSms: 'Отправить код через SMS',
      enterCode: 'Введите код подтверждения',
      edsVerification: 'Подтверждение ЭЦП',
      eimzo: 'Электронная цифровая подпись',
      eimzoSelect: 'Выберите ключ ЭЦП',
      eimzoLoading: 'Загрузка ключей ЭЦП...',
      eimzoError: 'Ошибка загрузки ключей ЭЦП',
      eimzoRefresh: 'Обновить',
      eimzoSign: 'Подписать изменения',
      eimzoSigning: 'Подписание...',
      eimzoRequired: 'Для изменения данных требуется подпись ЭЦП',
      eimzoNotInstalled: 'E-IMZO не установлен или не запущен',
      eimzoSignSuccess: 'Данные успешно подписаны',
      eimzoSignError: 'Ошибка подписания',
      successMessage: 'Профиль успешно обновлен',
      errorMessage: 'Ошибка при обновлении профиля',
      userTypeLegal: 'Юридическое лицо',
      userTypeIp: 'Индивидуальный предприниматель',
      userTypeIndividual: 'Физическое лицо',
      roleCustomer: 'Заказчик',
      roleCarrier: 'Перевозчик',
      rolePartner: 'Партнер',
      roleAdmin: 'Администратор',
      changePassword: 'Изменить пароль',
      currentPassword: 'Текущий пароль',
      newPassword: 'Новый пароль',
      confirmNewPassword: 'Подтвердите новый пароль',
      passwordChangeSuccess: 'Пароль успешно изменён',
      passwordChangeError: 'Ошибка при изменении пароля',
      passwordMismatch: 'Пароли не совпадают',
      passwordTooShort: 'Пароль должен быть не менее 6 символов',
      incorrectCurrentPassword: 'Неверный текущий пароль',
      withCurrentPassword: 'По паролю',
      withSmsCode: 'По СМС',
      smsCodeDescription: 'Введите новый пароль и подтвердите изменение СМС-кодом',
      sendSmsCode: 'Отправить СМС-код',
      smsCodePlaceholder: 'Код из СМС',
      smsIntegrationInProgress: 'Интеграция с СМС-провайдером в разработке. Пожалуйста, используйте смену пароля по текущему паролю.',
      changePhone: 'Изменить номер телефона',
      newPhoneNumber: 'Новый номер телефона',
      hasAccessToOldPhone: 'У меня есть доступ к старому номеру',
      lostAccessToOldPhone: 'У меня нет доступа к старому номеру',
      selectScenario: 'Выберите способ подтверждения',
      scenario1Description: 'Если у вас есть доступ к текущему номеру, мы отправим SMS-код на старый и новый номер.',
      scenario2Description: 'Если вы потеряли доступ к старому номеру, подтвердите изменение паролем. Изменение вступит в силу через 48 часов.',
      continue: 'Продолжить',
      verifyOldPhone: 'Подтвердите старый номер',
      enterOldPhoneCode: 'Введите код, отправленный на ваш текущий номер',
      verifyPassword: 'Подтвердите пароль',
      enterPassword: 'Введите ваш пароль для подтверждения',
      verifyNewPhone: 'Подтвердите новый номер',
      enterNewPhoneCode: 'Введите код, отправленный на новый номер',
      phoneChangeSuccess: 'Номер телефона успешно изменён!',
      phoneChangePending: 'Запрос на смену номера принят',
      phoneChangeCooldownInfo: 'В целях безопасности ваш номер телефона будет изменён через 48 часов. Вы можете отменить это в любой момент.',
      cancelPhoneChange: 'Отменить смену номера',
      phoneChangeCancelled: 'Запрос на смену номера отменён',
      timeRemaining: 'Осталось времени',
      hours: 'ч',
      minutes: 'мин',
      pendingPhoneChangeBanner: 'Ожидается смена номера телефона. Новый номер:',
      changeScheduledFor: 'Изменение запланировано на:',
    },
    uz: {
      profile: 'Profil',
      displayName: 'Ko\'rsatiladigan ism',
      email: 'Email',
      phone: 'Telefon',
      firstName: 'Ism',
      lastName: 'Familiya',
      middleName: 'Otasining ismi',
      companyName: 'Kompaniya nomi',
      inn: 'STIR',
      pinfl: 'JSHSHIR',
      passportSeries: 'Pasport seriyasi',
      passportNumber: 'Pasport raqami',
      bankAccount: 'Hisob raqami',
      bankName: 'Bank',
      bankCode: 'Bank kodi',
      role: 'Asosiy rol',
      userType: 'Foydalanuvchi turi',
      vatPayer: 'QQS to\'lovchi',
      vatYes: 'Ha',
      vatNo: 'Yo\'q',
      registrationCodeNds: 'QQS to\'lovchining ro\'yxatdan o\'tish kodi',
      edit: 'Tahrirlash',
      save: 'Saqlash',
      cancel: 'Bekor qilish',
      verifyChanges: 'Oʻzgartirishlarni tasdiqlash',
      smsVerification: 'SMS tasdiqlash',
      sendSms: 'SMS orqali kod yuborish',
      enterCode: 'Tasdiqlovchi kodni kiriting',
      edsVerification: 'EDS tasdiqlash',
      eimzo: 'Elektron raqamli imzo',
      eimzoSelect: 'ERI kalitini tanlang',
      eimzoLoading: 'ERI kalitlari yuklanmoqda...',
      eimzoError: 'ERI kalitlarini yuklashda xato',
      eimzoRefresh: 'Yangilash',
      eimzoSign: 'O\'zgarishlarni imzolash',
      eimzoSigning: 'Imzolanmoqda...',
      eimzoRequired: 'Ma\'lumotlarni o\'zgartirish uchun ERI imzosi talab qilinadi',
      eimzoNotInstalled: 'E-IMZO o\'rnatilmagan yoki ishlamayapti',
      eimzoSignSuccess: 'Ma\'lumotlar muvaffaqiyatli imzolandi',
      eimzoSignError: 'Imzolashda xato',
      successMessage: 'Profil muvaffaqiyatli yangilandi',
      errorMessage: 'Profilni yangilashda xato',
      userTypeLegal: 'Yuridik shaxs',
      userTypeIp: 'Yakka tartibdagi tadbirkor',
      userTypeIndividual: 'Jismoniy shaxs',
      roleCustomer: 'Buyurtmachi',
      roleCarrier: 'Tashuvchi',
      rolePartner: 'Hamkor',
      roleAdmin: 'Administrator',
      changePassword: 'Parolni o\'zgartirish',
      currentPassword: 'Joriy parol',
      newPassword: 'Yangi parol',
      confirmNewPassword: 'Yangi parolni tasdiqlang',
      passwordChangeSuccess: 'Parol muvaffaqiyatli o\'zgartirildi',
      passwordChangeError: 'Parolni o\'zgartirishda xato',
      passwordMismatch: 'Parollar mos kelmaydi',
      passwordTooShort: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak',
      incorrectCurrentPassword: 'Joriy parol noto\'g\'ri',
      withCurrentPassword: 'Parol bilan',
      withSmsCode: 'SMS bilan',
      smsCodeDescription: 'Yangi parolni kiriting va SMS-kod bilan o\'zgartirishni tasdiqlang',
      sendSmsCode: 'SMS-kod yuborish',
      smsCodePlaceholder: 'SMS dan kod',
      smsIntegrationInProgress: 'SMS provayderi bilan integratsiya ishlab chiqilmoqda. Iltimos, joriy parol bilan parolni o\'zgartiring.',
      changePhone: 'Telefon raqamini o\'zgartirish',
      newPhoneNumber: 'Yangi telefon raqami',
      hasAccessToOldPhone: 'Eski raqamga kirishim bor',
      lostAccessToOldPhone: 'Eski raqamga kirishim yo\'q',
      selectScenario: 'Tasdiqlash usulini tanlang',
      scenario1Description: 'Agar joriy raqamga kirishingiz bo\'lsa, eski va yangi raqamga SMS-kod yuboramiz.',
      scenario2Description: 'Agar eski raqamga kirish imkoniyatingiz bo\'lmasa, o\'zgarishni parol bilan tasdiqlang. O\'zgarish 48 soatdan keyin kuchga kiradi.',
      continue: 'Davom etish',
      verifyOldPhone: 'Eski raqamni tasdiqlang',
      enterOldPhoneCode: 'Joriy raqamingizga yuborilgan kodni kiriting',
      verifyPassword: 'Parolni tasdiqlang',
      enterPassword: 'Tasdiqlash uchun parolingizni kiriting',
      verifyNewPhone: 'Yangi raqamni tasdiqlang',
      enterNewPhoneCode: 'Yangi raqamga yuborilgan kodni kiriting',
      phoneChangeSuccess: 'Telefon raqami muvaffaqiyatli o\'zgartirildi!',
      phoneChangePending: 'Raqamni o\'zgartirish so\'rovi qabul qilindi',
      phoneChangeCooldownInfo: 'Xavfsizlik maqsadida telefon raqamingiz 48 soatdan keyin o\'zgartiriladi. Istalgan vaqtda bekor qilishingiz mumkin.',
      cancelPhoneChange: 'Raqam o\'zgartirishni bekor qilish',
      phoneChangeCancelled: 'Raqam o\'zgartirish so\'rovi bekor qilindi',
      timeRemaining: 'Qolgan vaqt',
      hours: 's',
      minutes: 'daq',
      pendingPhoneChangeBanner: 'Telefon raqamini o\'zgartirishni kutmoqda. Yangi raqam:',
      changeScheduledFor: 'O\'zgartirish vaqti:',
    }
  };

  const t = texts[language];

  const getTranslatedUserType = (type: string | undefined) => {
    if (!type) return '';
    switch(type) {
      case 'legal': return t.userTypeLegal;
      case 'ip': return t.userTypeIp;
      case 'individual': return t.userTypeIndividual;
      default: return type;
    }
  };

  const getTranslatedRole = (role: string | undefined) => {
    if (!role) return '';
    switch(role) {
      case 'customer': return t.roleCustomer;
      case 'carrier': return t.roleCarrier;
      case 'partner': return t.rolePartner;
      case 'admin': return t.roleAdmin;
      case 'agent': return t.rolePartner;
      default: return role;
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PATCH', '/api/profile/update', data);
    },
    onSuccess: () => {
      refetchUser();
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      setIsEditing(false);
      setVerificationDialogOpen(false);
      setVerificationCode('');
      toast({ title: t.successMessage });
    },
    onError: () => {
      toast({ title: t.errorMessage, variant: 'destructive' });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      return await apiRequest('POST', '/api/profile/change-password', data);
    },
    onSuccess: () => {
      setPasswordDialogOpen(false);
      resetPasswordForm();
      toast({ title: t.passwordChangeSuccess });
    },
    onError: (error: any) => {
      if (error.message?.includes('incorrect') || error.message?.includes('Current password')) {
        toast({ title: t.incorrectCurrentPassword, variant: 'destructive' });
      } else {
        toast({ title: t.passwordChangeError, variant: 'destructive' });
      }
    },
  });

  // E-IMZO functions for profile verification
  const loadEimzoKeys = async () => {
    console.log('[ProfileView] loadEimzoKeys called, userType:', user?.userType);
    setEimzoLoading(true);
    setEimzoError(null);
    try {
      console.log('[ProfileView] Calling eimzoService.init()...');
      const initialized = await eimzoService.init();
      console.log('[ProfileView] eimzoService.init() returned:', initialized);
      if (!initialized) {
        setEimzoError(t.eimzoNotInstalled);
        return;
      }
      console.log('[ProfileView] Calling eimzoService.listKeys()...');
      const keys = await eimzoService.listKeys();
      console.log('[ProfileView] eimzoService.listKeys() returned:', keys.length, 'keys');
      setEimzoKeys(keys);
      if (keys.length === 0) {
        setEimzoError(t.eimzoNotInstalled);
      }
    } catch (error: any) {
      console.error('[ProfileView] E-IMZO error:', error);
      setEimzoError(error.message || t.eimzoError);
    } finally {
      setEimzoLoading(false);
    }
  };

  const refreshEimzoKeys = () => {
    setSelectedEimzoKey(null);
    loadEimzoKeys();
  };

  const handleEimzoKeySelect = (keyId: string) => {
    const key = eimzoKeys.find(k => k.id === keyId);
    if (key) {
      setSelectedEimzoKey(key);
    }
  };

  const handleEimzoSign = async () => {
    if (!pendingUpdates || !selectedEimzoKey) {
      toast({ 
        title: t.eimzoRequired, 
        variant: 'destructive' 
      });
      return;
    }

    setEimzoSigning(true);
    try {
      // Create document to sign - profile update data
      const documentToSign = JSON.stringify({
        action: 'profile_update',
        timestamp: new Date().toISOString(),
        userId: user?.id,
        updates: pendingUpdates
      });

      // Load the key first (this prompts for password)
      const keyId = await eimzoService.loadKey(selectedEimzoKey);
      
      // Sign the document with the loaded keyId
      const signature = await eimzoService.createPkcs7(keyId, documentToSign);

      // Send to backend with signature
      const response = await fetch('/api/profile/update-with-eimzo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...pendingUpdates,
          eimzoSignature: signature,
          signedDocument: documentToSign,
          language,
        })
      });

      const data = await response.json();

      if (response.ok) {
        refetchUser();
        queryClient.invalidateQueries({ queryKey: ['/api/user'] });
        setIsEditing(false);
        setVerificationDialogOpen(false);
        setSelectedEimzoKey(null);
        toast({ title: t.successMessage });
      } else {
        toast({ 
          title: data.error || t.eimzoSignError, 
          variant: 'destructive' 
        });
      }
    } catch (error: any) {
      console.error('E-IMZO signing error:', error);
      toast({ 
        title: error.message || t.eimzoSignError, 
        variant: 'destructive' 
      });
    } finally {
      setEimzoSigning(false);
    }
  };

  // Load E-IMZO keys when verification dialog opens for legal/IP users
  useEffect(() => {
    if (verificationDialogOpen && (user?.userType === 'legal' || user?.userType === 'ip')) {
      loadEimzoKeys();
    }
  }, [verificationDialogOpen, user?.userType]);

  // Query for pending phone change status
  const { data: phoneChangeStatusData, refetch: refetchPhoneChangeStatus } = useQuery<{
    hasPendingRequest: boolean;
    request?: {
      id: number;
      newPhone: string;
      status: string;
      hasOldPhoneAccess: boolean;
      cooldownEndsAt: string | null;
    };
  }>({
    queryKey: ['/api/phone-change/status', language],
  });

  // Function for sending SMS OTP for password change
  const handleSendPasswordSmsRequest = async () => {
    setSmsSending(true);
    try {
      const response = await fetch('/api/sms/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: user?.phone,
          purpose: 'password_change',
          language,
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSmsSent(true);
        setSmsCooldown(60);
        toast({ 
          title: language === 'ru' 
            ? 'СМС код отправлен' 
            : 'SMS kod yuborildi' 
        });
        // Start cooldown timer
        const interval = setInterval(() => {
          setSmsCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        // Check if response contains lockout or cooldown remaining
        if (data.lockoutRemaining) {
          setSmsCooldown(data.lockoutRemaining);
          const interval = setInterval(() => {
            setSmsCooldown((prev) => {
              if (prev <= 1) {
                clearInterval(interval);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } else if (data.cooldownRemaining) {
          setSmsCooldown(data.cooldownRemaining);
          const interval = setInterval(() => {
            setSmsCooldown((prev) => {
              if (prev <= 1) {
                clearInterval(interval);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
        toast({ 
          title: data.error || (language === 'ru' ? 'Ошибка отправки СМС' : 'SMS yuborishda xato'),
          variant: 'destructive' 
        });
      }
    } catch (error) {
      toast({ 
        title: language === 'ru' ? 'Произошла ошибка' : 'Xatolik yuz berdi',
        variant: 'destructive' 
      });
    } finally {
      setSmsSending(false);
    }
  };

  // Function for changing password via SMS
  const handleChangePasswordSmsRequest = async (newPassword: string, smsCodeValue: string) => {
    setSmsPasswordChanging(true);
    try {
      const response = await fetch('/api/profile/change-password-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          newPassword,
          smsCode: smsCodeValue,
          language,
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setPasswordDialogOpen(false);
        resetPasswordForm();
        toast({ title: t.passwordChangeSuccess });
      } else {
        toast({ 
          title: data.error || t.passwordChangeError, 
          variant: 'destructive' 
        });
      }
    } catch (error) {
      toast({ 
        title: language === 'ru' ? 'Произошла ошибка' : 'Xatolik yuz berdi',
        variant: 'destructive' 
      });
    } finally {
      setSmsPasswordChanging(false);
    }
  };

  const handleSendPasswordSms = () => {
    handleSendPasswordSmsRequest();
  };

  // Function for sending SMS OTP for profile edit verification
  const handleSendProfileSms = async () => {
    setProfileSmsSending(true);
    try {
      const response = await fetch('/api/sms/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: user?.phone,
          purpose: 'profile_edit',
          language,
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setProfileSmsSent(true);
        setProfileSmsCooldown(60);
        toast({ 
          title: language === 'ru' 
            ? 'СМС код отправлен' 
            : 'SMS kod yuborildi' 
        });
        // Start cooldown timer
        const interval = setInterval(() => {
          setProfileSmsCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        // Check if response contains lockout or cooldown remaining
        if (data.lockoutRemaining) {
          setProfileSmsCooldown(data.lockoutRemaining);
          const interval = setInterval(() => {
            setProfileSmsCooldown((prev) => {
              if (prev <= 1) {
                clearInterval(interval);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } else if (data.cooldownRemaining) {
          setProfileSmsCooldown(data.cooldownRemaining);
          const interval = setInterval(() => {
            setProfileSmsCooldown((prev) => {
              if (prev <= 1) {
                clearInterval(interval);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
        toast({ 
          title: data.error || (language === 'ru' ? 'Ошибка отправки СМС' : 'SMS yuborishda xato'),
          variant: 'destructive' 
        });
      }
    } catch (error) {
      toast({ 
        title: language === 'ru' ? 'Произошла ошибка' : 'Xatolik yuz berdi',
        variant: 'destructive' 
      });
    } finally {
      setProfileSmsSending(false);
    }
  };

  // Function for verifying profile edit with SMS code
  const handleVerifyProfileEdit = async () => {
    if (!pendingUpdates) return;
    
    if (!verificationCode.trim()) {
      toast({ 
        title: language === 'ru' ? 'Введите СМС код' : 'SMS kodini kiriting', 
        variant: 'destructive' 
      });
      return;
    }
    
    setProfileSmsVerifying(true);
    try {
      const response = await fetch('/api/profile/update-with-sms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...pendingUpdates,
          smsCode: verificationCode,
          language,
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        refetchUser();
        queryClient.invalidateQueries({ queryKey: ['/api/user'] });
        setIsEditing(false);
        setVerificationDialogOpen(false);
        resetProfileVerification();
        toast({ title: t.successMessage });
      } else {
        toast({ 
          title: data.error || t.errorMessage, 
          variant: 'destructive' 
        });
      }
    } catch (error) {
      toast({ 
        title: language === 'ru' ? 'Произошла ошибка' : 'Xatolik yuz berdi',
        variant: 'destructive' 
      });
    } finally {
      setProfileSmsVerifying(false);
    }
  };

  // Reset profile verification state
  const resetProfileVerification = () => {
    setVerificationCode('');
    setProfileSmsSent(false);
    setProfileSmsCooldown(0);
    setPendingUpdates(null);
  };

  const handlePasswordChangeSms = () => {
    if (newPasswordSms.length < 6) {
      toast({ title: t.passwordTooShort, variant: 'destructive' });
      return;
    }
    if (newPasswordSms !== confirmPasswordSms) {
      toast({ title: t.passwordMismatch, variant: 'destructive' });
      return;
    }
    if (!smsCode.trim()) {
      toast({ 
        title: language === 'ru' ? 'Введите СМС код' : 'SMS kodini kiriting', 
        variant: 'destructive' 
      });
      return;
    }
    handleChangePasswordSmsRequest(newPasswordSms, smsCode);
  };

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSmsCode('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    // Reset SMS password change state
    setNewPasswordSms('');
    setConfirmPasswordSms('');
    setShowNewPasswordSms(false);
    setShowConfirmPasswordSms(false);
    setSmsSent(false);
    setSmsCooldown(0);
  };

  // Phone change handlers
  const resetPhoneChangeForm = () => {
    setPhoneChangeStep('select');
    newPhoneInput.setDigits('');
    setHasOldPhoneAccess(true);
    setPhoneChangeRequestId(null);
    setPhoneChangePassword('');
    setShowPhoneChangePassword(false);
    setPhoneOldOtp('');
    setPhoneNewOtp('');
    setPhoneOldSmsCooldown(0);
    setPhoneNewSmsCooldown(0);
    setCooldownEndsAt(null);
  };

  const handleInitiatePhoneChange = async () => {
    if (!newPhoneInput.isComplete) {
      toast({ title: language === 'ru' ? 'Введите новый номер' : 'Yangi raqamni kiriting', variant: 'destructive' });
      return;
    }
    
    setPhoneVerifying(true);
    try {
      const response = await fetch('/api/phone-change/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newPhone: newPhoneInput.getFullPhone(), hasOldPhoneAccess, language })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setPhoneChangeRequestId(data.requestId);
        if (data.nextStep === 'verify_old_phone') {
          setPhoneChangeStep('verify_old');
        } else {
          setPhoneChangeStep('verify_password');
        }
        toast({ title: data.message });
      } else {
        toast({ title: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: language === 'ru' ? 'Произошла ошибка' : 'Xatolik yuz berdi', variant: 'destructive' });
    } finally {
      setPhoneVerifying(false);
    }
  };

  const handleSendOldPhoneOtp = async () => {
    if (!phoneChangeRequestId) return;
    
    setPhoneOldSmsSending(true);
    try {
      const response = await fetch('/api/phone-change/send-old-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requestId: phoneChangeRequestId, language })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({ title: data.message });
        setPhoneOldSmsCooldown(60);
        const interval = setInterval(() => {
          setPhoneOldSmsCooldown(prev => {
            if (prev <= 1) { clearInterval(interval); return 0; }
            return prev - 1;
          });
        }, 1000);
      } else {
        toast({ title: data.error, variant: 'destructive' });
        if (data.cooldownRemaining) {
          setPhoneOldSmsCooldown(data.cooldownRemaining);
        }
      }
    } catch (error) {
      toast({ title: language === 'ru' ? 'Произошла ошибка' : 'Xatolik yuz berdi', variant: 'destructive' });
    } finally {
      setPhoneOldSmsSending(false);
    }
  };

  const handleVerifyOldPhone = async () => {
    if (!phoneChangeRequestId || !phoneOldOtp.trim()) return;
    
    setPhoneVerifying(true);
    try {
      const response = await fetch('/api/phone-change/verify-old-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requestId: phoneChangeRequestId, code: phoneOldOtp, language })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setPhoneChangeStep('verify_new');
        toast({ title: data.message });
      } else {
        toast({ title: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: language === 'ru' ? 'Произошла ошибка' : 'Xatolik yuz berdi', variant: 'destructive' });
    } finally {
      setPhoneVerifying(false);
    }
  };

  const handleVerifyPassword = async () => {
    if (!phoneChangeRequestId || !phoneChangePassword.trim()) return;
    
    setPhoneVerifying(true);
    try {
      const response = await fetch('/api/phone-change/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requestId: phoneChangeRequestId, password: phoneChangePassword, language })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setPhoneChangeStep('verify_new');
        toast({ title: data.message });
      } else {
        toast({ title: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: language === 'ru' ? 'Произошла ошибка' : 'Xatolik yuz berdi', variant: 'destructive' });
    } finally {
      setPhoneVerifying(false);
    }
  };

  const handleSendNewPhoneOtp = async () => {
    if (!phoneChangeRequestId) return;
    
    setPhoneNewSmsSending(true);
    try {
      const response = await fetch('/api/phone-change/send-new-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requestId: phoneChangeRequestId, language })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({ title: data.message });
        setPhoneNewSmsCooldown(60);
        const interval = setInterval(() => {
          setPhoneNewSmsCooldown(prev => {
            if (prev <= 1) { clearInterval(interval); return 0; }
            return prev - 1;
          });
        }, 1000);
      } else {
        toast({ title: data.error, variant: 'destructive' });
        if (data.cooldownRemaining) {
          setPhoneNewSmsCooldown(data.cooldownRemaining);
        }
      }
    } catch (error) {
      toast({ title: language === 'ru' ? 'Произошла ошибка' : 'Xatolik yuz berdi', variant: 'destructive' });
    } finally {
      setPhoneNewSmsSending(false);
    }
  };

  const handleVerifyNewPhone = async () => {
    if (!phoneChangeRequestId || !phoneNewOtp.trim()) return;
    
    setPhoneVerifying(true);
    try {
      const response = await fetch('/api/phone-change/verify-new-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requestId: phoneChangeRequestId, code: phoneNewOtp, language })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (data.applied) {
          toast({ title: t.phoneChangeSuccess });
          setPhoneChangeDialogOpen(false);
          resetPhoneChangeForm();
          refetchUser();
          refetchPhoneChangeStatus();
          queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
        } else {
          setCooldownEndsAt(new Date(data.cooldownEndsAt));
          setPhoneChangeStep('cooldown');
          refetchPhoneChangeStatus();
          toast({ title: t.phoneChangePending });
        }
      } else {
        toast({ title: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: language === 'ru' ? 'Произошла ошибка' : 'Xatolik yuz berdi', variant: 'destructive' });
    } finally {
      setPhoneVerifying(false);
    }
  };

  const handleCancelPhoneChange = async () => {
    if (!phoneChangeRequestId) return;
    
    setPhoneVerifying(true);
    try {
      const response = await fetch('/api/phone-change/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requestId: phoneChangeRequestId, language })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({ title: t.phoneChangeCancelled });
        setPhoneChangeDialogOpen(false);
        resetPhoneChangeForm();
        refetchPhoneChangeStatus();
      } else {
        toast({ title: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: language === 'ru' ? 'Произошла ошибка' : 'Xatolik yuz berdi', variant: 'destructive' });
    } finally {
      setPhoneVerifying(false);
    }
  };

  const handlePasswordChange = () => {
    if (newPassword.length < 6) {
      toast({ title: t.passwordTooShort, variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: t.passwordMismatch, variant: 'destructive' });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleSave = () => {
    setPendingUpdates(formData);
    setVerificationDialogOpen(true);
  };

  const handleVerify = () => {
    if (!pendingUpdates) return;
    
    if (verificationCode.trim()) {
      updateProfileMutation.mutate(pendingUpdates);
    } else {
      toast({ title: language === 'ru' ? 'Введите код' : 'Kodni kiriting', variant: 'destructive' });
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isIndividual = user?.userType === 'individual';
  const isLegal = user?.userType === 'legal';
  const isIp = user?.userType === 'ip';

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">{t.profile}</h1>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              onClick={() => setPhoneChangeDialogOpen(true)} 
              className="gap-2" 
              data-testid="button-change-phone"
            >
              <MessageSquare className="h-4 w-4" />
              {t.changePhone}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setPasswordDialogOpen(true)} 
              className="gap-2" 
              data-testid="button-change-password"
            >
              <Lock className="h-4 w-4" />
              {t.changePassword}
            </Button>
            {!isEditing && (
              <Button onClick={() => setIsEditing(true)} className="gap-2" data-testid="button-edit-profile">
                <Edit className="h-4 w-4" />
                {t.edit}
              </Button>
            )}
          </div>
        </div>

        {/* Pending Phone Change Banner */}
        {phoneChangeStatusData?.hasPendingRequest && phoneChangeStatusData.request && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-900 flex flex-wrap items-center justify-between gap-4" data-testid="banner-pending-phone-change">
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                {t.pendingPhoneChangeBanner} <span className="font-bold">{phoneChangeStatusData.request.newPhone}</span>
              </p>
              {phoneChangeStatusData.request.cooldownEndsAt && (
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  {t.changeScheduledFor} {new Date(phoneChangeStatusData.request.cooldownEndsAt).toLocaleString(language === 'ru' ? 'ru-RU' : 'uz-UZ')}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const response = await fetch('/api/phone-change/cancel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ requestId: phoneChangeStatusData.request!.id, language })
                  });
                  if (response.ok) {
                    toast({ title: t.phoneChangeCancelled });
                    refetchPhoneChangeStatus();
                  }
                } catch (error) {
                  toast({ title: language === 'ru' ? 'Произошла ошибка' : 'Xatolik yuz berdi', variant: 'destructive' });
                }
              }}
              className="border-yellow-400 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-100 dark:hover:bg-yellow-800/30"
              data-testid="button-cancel-pending-phone-change"
            >
              {t.cancelPhoneChange}
            </Button>
          </div>
        )}

        {isEditing ? (
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-6">
                {/* Basic Contact Info - Always shown */}
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>{t.email}</Label>
                      <Input
                        value={formData.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        data-testid="input-email"
                      />
                    </div>
                  </div>
                </div>

                {/* Personal Name Fields - Only for individuals */}
                {isIndividual && (
                  <div>
                    <h3 className="font-semibold mb-4 text-sm text-foreground">{language === 'ru' ? 'ФИО' : 'FIO'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>{t.lastName}</Label>
                        <Input
                          value={formData.lastName}
                          onChange={(e) => handleChange('lastName', e.target.value)}
                          data-testid="input-last-name"
                        />
                      </div>
                      <div>
                        <Label>{t.firstName}</Label>
                        <Input
                          value={formData.firstName}
                          onChange={(e) => handleChange('firstName', e.target.value)}
                          data-testid="input-first-name"
                        />
                      </div>
                      <div>
                        <Label>{t.middleName}</Label>
                        <Input
                          value={formData.middleName}
                          onChange={(e) => handleChange('middleName', e.target.value)}
                          data-testid="input-middle-name"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ПИНФЛ and Passport Info for Individuals */}
                {isIndividual && (
                  <>
                    <div>
                      <h3 className="font-semibold mb-4 text-sm text-foreground">{language === 'ru' ? 'Персональные документы' : 'Shaxsiy hujjatlar'}</h3>
                      <div className="space-y-2">
                        <Label>{t.pinfl}</Label>
                        <Input
                          value={formData.pinfl}
                          onChange={(e) => handleChange('pinfl', e.target.value.replace(/\D/g, ''))}
                          required
                          maxLength={14}
                          minLength={14}
                          pattern="[0-9]{14}"
                          placeholder="12345678901234"
                          data-testid="input-pinfl"
                        />
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-4 text-sm text-foreground">{language === 'ru' ? 'Паспортные данные' : 'Pasport ma\'lumot'}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>{t.passportSeries}</Label>
                          <Input
                            value={formData.passportSeries}
                            onChange={(e) => handleChange('passportSeries', e.target.value.toUpperCase())}
                            required
                            maxLength={2}
                            pattern="[A-Z]{2}"
                            placeholder="AA"
                            data-testid="input-passport-series"
                          />
                        </div>
                        <div>
                          <Label>{t.passportNumber}</Label>
                          <Input
                            value={formData.passportNumber}
                            onChange={(e) => handleChange('passportNumber', e.target.value.replace(/\D/g, ''))}
                            required
                            maxLength={7}
                            minLength={7}
                            pattern="[0-9]{7}"
                            placeholder="1234567"
                            data-testid="input-passport-number"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Legal Entity Info */}
                {isLegal && (
                  <>
                    <div>
                      <h3 className="font-semibold mb-4 text-sm text-foreground">{language === 'ru' ? 'Юридические данные' : 'Yuridik ma\'lumot'}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>{t.companyName}</Label>
                          <Input
                            value={formData.companyName}
                            onChange={(e) => handleChange('companyName', e.target.value)}
                            required
                            data-testid="input-company-name"
                          />
                        </div>
                        <div>
                          <Label>{t.inn}</Label>
                          <Input
                            value={formData.inn}
                            onChange={(e) => handleChange('inn', e.target.value.replace(/\D/g, ''))}
                            required
                            maxLength={12}
                            minLength={12}
                            pattern="[0-9]{12}"
                            placeholder="123456789012"
                            data-testid="input-inn"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-4 text-sm text-foreground">{language === 'ru' ? 'Банковские реквизиты' : 'Bank ma\'lumotlari'}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>{t.bankAccount}</Label>
                          <Input
                            value={formData.bankAccount}
                            onChange={(e) => handleChange('bankAccount', e.target.value.replace(/\D/g, ''))}
                            required
                            maxLength={20}
                            minLength={20}
                            pattern="[0-9]{20}"
                            placeholder="12345678901234567890"
                            data-testid="input-bank-account"
                          />
                        </div>
                        <div>
                          <Label>{t.bankName}</Label>
                          <Input
                            value={formData.bankName}
                            onChange={(e) => handleChange('bankName', e.target.value)}
                            required
                            data-testid="input-bank-name"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{t.bankCode}</Label>
                        <Input
                          value={formData.bankCode}
                          onChange={(e) => handleChange('bankCode', e.target.value.replace(/\D/g, ''))}
                          required
                          maxLength={5}
                          minLength={5}
                          pattern="[0-9]{5}"
                          placeholder="12345"
                          data-testid="input-bank-code"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Individual Entrepreneur Info */}
                {isIp && (
                  <>
                    <div>
                      <h3 className="font-semibold mb-4 text-sm text-foreground">{language === 'ru' ? 'Данные индивидуального предпринимателя' : 'Yakka tartibdagi tadbirkor ma\'lumotlari'}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>{language === 'ru' ? 'Наименование ИП' : 'YaTT nomi'}</Label>
                          <Input
                            value={formData.companyName}
                            onChange={(e) => handleChange('companyName', e.target.value)}
                            required
                            data-testid="input-company-name"
                          />
                        </div>
                        <div>
                          <Label>{language === 'ru' ? 'ПИНФЛ' : 'JSHSHIR'}</Label>
                          <Input
                            value={formData.inn}
                            onChange={(e) => handleChange('inn', e.target.value.replace(/\D/g, ''))}
                            required
                            maxLength={14}
                            minLength={14}
                            pattern="[0-9]{14}"
                            placeholder="12345678901234"
                            data-testid="input-pinfl"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-4 text-sm text-foreground">{language === 'ru' ? 'Банковские реквизиты' : 'Bank ma\'lumotlari'}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>{t.bankAccount}</Label>
                          <Input
                            value={formData.bankAccount}
                            onChange={(e) => handleChange('bankAccount', e.target.value.replace(/\D/g, ''))}
                            required
                            maxLength={20}
                            minLength={20}
                            pattern="[0-9]{20}"
                            placeholder="12345678901234567890"
                            data-testid="input-bank-account"
                          />
                        </div>
                        <div>
                          <Label>{t.bankName}</Label>
                          <Input
                            value={formData.bankName}
                            onChange={(e) => handleChange('bankName', e.target.value)}
                            required
                            data-testid="input-bank-name"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{t.bankCode}</Label>
                        <Input
                          value={formData.bankCode}
                          onChange={(e) => handleChange('bankCode', e.target.value.replace(/\D/g, ''))}
                          required
                          maxLength={5}
                          minLength={5}
                          pattern="[0-9]{5}"
                          placeholder="12345"
                          data-testid="input-bank-code"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* VAT Payer and Account Info - At the bottom */}
                <div className="border-t pt-4 space-y-4">
                  {/* VAT Payer - Only for legal entities and IPs */}
                  {(isLegal || isIp) && (
                    <>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="nds-payer"
                          checked={formData.ndsPayer}
                          onCheckedChange={(checked) => handleChange('ndsPayer', checked === true)}
                          data-testid="checkbox-nds-payer"
                        />
                        <Label htmlFor="nds-payer" className="cursor-pointer">{t.vatPayer}</Label>
                      </div>

                      {/* NDS Registration Code - Shows when ndsPayer is checked */}
                      {formData.ndsPayer && (
                        <div className="space-y-2">
                          <Label>{t.registrationCodeNds}</Label>
                          <Input
                            value={formData.registrationCodeNds}
                            onChange={(e) => handleChange('registrationCodeNds', e.target.value.replace(/\D/g, ''))}
                            required
                            maxLength={12}
                            minLength={12}
                            pattern="[0-9]{12}"
                            placeholder="123456789012"
                            data-testid="input-registration-code-nds"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* User Type and Role - Read-only */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">{t.userType}</div>
                      <div className="font-medium">{getTranslatedUserType(user?.userType)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">{t.role}</div>
                      <div className="font-medium">{getTranslatedRole(user?.defaultRole)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                data-testid="button-cancel-edit"
              >
                {t.cancel}
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? '...' : t.save}
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{user?.displayName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase">{language === 'ru' ? 'Основная информация' : 'Asosiy ma\'lumot'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">{t.displayName}</div>
                    <div className="font-medium">{user?.displayName}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">{t.email}</div>
                    <div className="font-medium">{user?.email || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">{t.phone}</div>
                    <div className="font-medium">{user?.phone}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">{t.role}</div>
                    <div className="font-medium">{getTranslatedRole(user?.defaultRole)}</div>
                  </div>
                </div>
              </div>

              {/* Personal Information - Only for individuals */}
              {isIndividual && (user?.firstName || user?.lastName || user?.middleName) && (
                <div>
                  <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase">{language === 'ru' ? 'Личные данные' : 'Shaxsiy ma\'lumot'}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {user?.firstName && (
                      <div>
                        <div className="text-sm text-muted-foreground">{t.firstName}</div>
                        <div className="font-medium">{user.firstName}</div>
                      </div>
                    )}
                    {user?.lastName && (
                      <div>
                        <div className="text-sm text-muted-foreground">{t.lastName}</div>
                        <div className="font-medium">{user.lastName}</div>
                      </div>
                    )}
                    {user?.middleName && (
                      <div>
                        <div className="text-sm text-muted-foreground">{t.middleName}</div>
                        <div className="font-medium">{user.middleName}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Passport Information - Only for individuals */}
              {isIndividual && (user?.passportSeries || user?.passportNumber) && (
                <div>
                  <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase">{language === 'ru' ? 'Паспортные данные' : 'Pasport ma\'lumot'}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {user?.passportSeries && (
                      <div>
                        <div className="text-sm text-muted-foreground">{t.passportSeries}</div>
                        <div className="font-medium">{user.passportSeries}</div>
                      </div>
                    )}
                    {user?.passportNumber && (
                      <div>
                        <div className="text-sm text-muted-foreground">{t.passportNumber}</div>
                        <div className="font-medium">{user.passportNumber}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Company/Legal Information - Only for legal/IP */}
              {(isLegal || isIp) && (user?.companyName || user?.inn) && (
                <div>
                  <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase">{language === 'ru' ? 'Юридические данные' : 'Yuridik ma\'lumot'}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {user?.companyName && (
                      <div>
                        <div className="text-sm text-muted-foreground">{t.companyName}</div>
                        <div className="font-medium">{user.companyName}</div>
                      </div>
                    )}
                    {user?.inn && (
                      <div>
                        <div className="text-sm text-muted-foreground">{t.inn}</div>
                        <div className="font-medium">{user.inn}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bank Information - For legal/IP */}
              {(isLegal || isIp) && (user?.bankAccount || user?.bankName || user?.bankCode) && (
                <div>
                  <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase">{language === 'ru' ? 'Банковские реквизиты' : 'Bank ma\'lumotlari'}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {user?.bankAccount && (
                      <div>
                        <div className="text-sm text-muted-foreground">{t.bankAccount}</div>
                        <div className="font-medium">{user.bankAccount}</div>
                      </div>
                    )}
                    {user?.bankName && (
                      <div>
                        <div className="text-sm text-muted-foreground">{t.bankName}</div>
                        <div className="font-medium">{user.bankName}</div>
                      </div>
                    )}
                    {user?.bankCode && (
                      <div>
                        <div className="text-sm text-muted-foreground">{t.bankCode}</div>
                        <div className="font-medium">{user.bankCode}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Account Information */}
              <div>
                <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase">{language === 'ru' ? 'Параметры учетной записи' : 'Hisob parametrlari'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">{t.userType}</div>
                    <div className="font-medium">{getTranslatedUserType(user?.userType)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">{t.vatPayer}</div>
                    <div className="font-medium">{user?.ndsPayer ? t.vatYes : t.vatNo}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Representative Mode Toggle - Only for individuals */}
        {isIndividual && <RepresentativeModeToggle language={language} />}

        {/* Notification Settings */}
        <NotificationSettings language={language} />
      </div>

      {/* Verification Dialog */}
      <Dialog open={verificationDialogOpen} onOpenChange={setVerificationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.verifyChanges}</DialogTitle>
            <DialogDescription>
              {isIndividual ? t.smsVerification : t.edsVerification}
            </DialogDescription>
          </DialogHeader>

          {isIndividual ? (
            <div className="space-y-4">
              <p className="text-sm">{t.sendSms}</p>
              <Button 
                className="w-full" 
                onClick={handleSendProfileSms}
                disabled={profileSmsSending || profileSmsCooldown > 0}
                data-testid="button-send-sms-profile"
              >
                {profileSmsSending 
                  ? '...' 
                  : profileSmsCooldown > 0 
                    ? `${t.sendSmsCode} (${profileSmsCooldown}${language === 'ru' ? 'с' : 's'})`
                    : t.sendSmsCode
                }
              </Button>
              <div>
                <Label>{t.enterCode}</Label>
                <Input
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  disabled={!profileSmsSent}
                  data-testid="input-sms-code"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  {t.eimzo}
                </Label>
                
                {eimzoLoading ? (
                  <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">{t.eimzoLoading}</span>
                  </div>
                ) : eimzoError ? (
                  <div className="flex items-center justify-between p-3 border border-destructive/50 rounded-md bg-destructive/10">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="text-sm text-destructive">{eimzoError}</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={refreshEimzoKeys}
                      data-testid="button-eimzo-refresh"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      {t.eimzoRefresh}
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Select
                      value={selectedEimzoKey?.id || ''}
                      onValueChange={handleEimzoKeySelect}
                    >
                      <SelectTrigger className="flex-1" data-testid="select-eimzo-key">
                        <SelectValue placeholder={t.eimzoSelect} />
                      </SelectTrigger>
                      <SelectContent>
                        {eimzoKeys.map((key) => (
                          <SelectItem key={key.id} value={key.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{key.CN}</span>
                              <span className="text-xs text-muted-foreground">
                                {key.O} | {user?.userType === 'legal' ? `ИНН: ${key.TIN}` : `ПИНФЛ: ${key.PINFL}`}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={refreshEimzoKeys}
                      title={t.eimzoRefresh}
                      data-testid="button-eimzo-refresh-icon"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
                {selectedEimzoKey && (
                  <div className="p-3 border rounded-md bg-green-50 dark:bg-green-900/20">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">{selectedEimzoKey.CN}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t.eimzoRequired}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setVerificationDialogOpen(false);
                resetProfileVerification();
                setSelectedEimzoKey(null);
              }}
              data-testid="button-cancel-verify"
            >
              {t.cancel}
            </Button>
            <Button
              onClick={isIndividual ? handleVerifyProfileEdit : handleEimzoSign}
              disabled={isIndividual 
                ? (profileSmsVerifying || !verificationCode.trim() || verificationCode.length < 6) 
                : (eimzoSigning || !selectedEimzoKey)
              }
              data-testid="button-confirm-verify"
            >
              {isIndividual 
                ? (profileSmsVerifying ? '...' : t.verifyChanges)
                : (eimzoSigning ? t.eimzoSigning : t.eimzoSign)
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={(open) => {
        setPasswordDialogOpen(open);
        if (!open) resetPasswordForm();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.changePassword}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="password" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="password" className="gap-1.5" data-testid="tab-password-change">
                <Lock className="h-4 w-4" />
                {t.withCurrentPassword}
              </TabsTrigger>
              <TabsTrigger value="sms" className="gap-1.5" data-testid="tab-sms-change">
                <MessageSquare className="h-4 w-4" />
                {t.withSmsCode}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="password" className="space-y-4">
              <div className="space-y-2">
                <Label>{t.currentPassword}</Label>
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    data-testid="input-current-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    data-testid="button-toggle-current-password"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t.newPassword}</Label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    data-testid="input-new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    data-testid="button-toggle-new-password"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t.confirmNewPassword}</Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    data-testid="input-confirm-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    data-testid="button-toggle-confirm-password"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <DialogFooter className="gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setPasswordDialogOpen(false)}
                  data-testid="button-cancel-password-change"
                >
                  {t.cancel}
                </Button>
                <Button
                  onClick={handlePasswordChange}
                  disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
                  data-testid="button-confirm-password-change"
                >
                  {changePasswordMutation.isPending ? '...' : t.save}
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="sms" className="space-y-4">
              <p className="text-sm text-muted-foreground">{t.smsCodeDescription}</p>
              <div className="space-y-2">
                <Label>{t.newPassword}</Label>
                <div className="relative">
                  <Input
                    type={showNewPasswordSms ? 'text' : 'password'}
                    value={newPasswordSms}
                    onChange={(e) => setNewPasswordSms(e.target.value)}
                    placeholder="••••••••"
                    data-testid="input-new-password-sms"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowNewPasswordSms(!showNewPasswordSms)}
                    data-testid="button-toggle-new-password-sms"
                  >
                    {showNewPasswordSms ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t.confirmNewPassword}</Label>
                <div className="relative">
                  <Input
                    type={showConfirmPasswordSms ? 'text' : 'password'}
                    value={confirmPasswordSms}
                    onChange={(e) => setConfirmPasswordSms(e.target.value)}
                    placeholder="••••••••"
                    data-testid="input-confirm-password-sms"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowConfirmPasswordSms(!showConfirmPasswordSms)}
                    data-testid="button-toggle-confirm-password-sms"
                  >
                    {showConfirmPasswordSms ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t.smsCodePlaceholder}</Label>
                <Input
                  type="text"
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="------"
                  maxLength={6}
                  disabled={!smsSent}
                  data-testid="input-sms-code-password"
                />
              </div>
              <Button 
                className="w-full" 
                onClick={handleSendPasswordSms}
                disabled={smsSending || smsCooldown > 0}
                data-testid="button-send-sms-password"
              >
                {smsSending 
                  ? '...' 
                  : smsCooldown > 0 
                    ? `${t.sendSmsCode} (${smsCooldown}${language === 'ru' ? 'с' : 's'})`
                    : t.sendSmsCode
                }
              </Button>
              <DialogFooter className="gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setPasswordDialogOpen(false)}
                  data-testid="button-cancel-password-change-sms"
                >
                  {t.cancel}
                </Button>
                <Button
                  onClick={handlePasswordChangeSms}
                  disabled={smsPasswordChanging || !newPasswordSms || !confirmPasswordSms || !smsCode || smsCode.length < 6}
                  data-testid="button-confirm-password-change-sms"
                >
                  {smsPasswordChanging ? '...' : t.save}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Phone Change Dialog */}
      <Dialog open={phoneChangeDialogOpen} onOpenChange={(open) => {
        setPhoneChangeDialogOpen(open);
        if (!open) resetPhoneChangeForm();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.changePhone}</DialogTitle>
            <DialogDescription>
              {phoneChangeStep === 'select' && t.selectScenario}
              {phoneChangeStep === 'verify_old' && t.verifyOldPhone}
              {phoneChangeStep === 'verify_password' && t.verifyPassword}
              {phoneChangeStep === 'verify_new' && t.verifyNewPhone}
              {phoneChangeStep === 'cooldown' && t.phoneChangePending}
            </DialogDescription>
          </DialogHeader>

          {phoneChangeStep === 'select' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t.newPhoneNumber}</Label>
                <Input
                  {...newPhoneInput.inputProps}
                  data-testid="input-new-phone"
                />
              </div>

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{t.selectScenario}</p>
                
                <div 
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${hasOldPhoneAccess ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                  onClick={() => setHasOldPhoneAccess(true)}
                  data-testid="option-has-old-phone"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${hasOldPhoneAccess ? 'border-primary' : 'border-muted-foreground'}`}>
                      {hasOldPhoneAccess && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <span className="font-medium">{t.hasAccessToOldPhone}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 ml-6">{t.scenario1Description}</p>
                </div>

                <div 
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${!hasOldPhoneAccess ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                  onClick={() => setHasOldPhoneAccess(false)}
                  data-testid="option-lost-old-phone"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${!hasOldPhoneAccess ? 'border-primary' : 'border-muted-foreground'}`}>
                      {!hasOldPhoneAccess && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <span className="font-medium">{t.lostAccessToOldPhone}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 ml-6">{t.scenario2Description}</p>
                </div>
              </div>

              <DialogFooter className="gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    resetPhoneChangeForm();
                    setPhoneChangeDialogOpen(false);
                  }}
                  data-testid="button-cancel-phone-change"
                >
                  {t.cancel}
                </Button>
                <Button
                  onClick={handleInitiatePhoneChange}
                  disabled={phoneVerifying || !newPhoneInput.isComplete}
                  data-testid="button-continue-phone-change"
                >
                  {phoneVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : t.continue}
                </Button>
              </DialogFooter>
            </div>
          )}

          {phoneChangeStep === 'verify_old' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t.enterOldPhoneCode}</p>
              
              <Button 
                className="w-full" 
                onClick={handleSendOldPhoneOtp}
                disabled={phoneOldSmsSending || phoneOldSmsCooldown > 0}
                data-testid="button-send-old-phone-otp"
              >
                {phoneOldSmsSending 
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : phoneOldSmsCooldown > 0 
                    ? `${t.sendSmsCode} (${phoneOldSmsCooldown}${language === 'ru' ? 'с' : 's'})`
                    : t.sendSmsCode
                }
              </Button>

              <div className="space-y-2">
                <Label>{t.smsCodePlaceholder}</Label>
                <Input
                  type="text"
                  value={phoneOldOtp}
                  onChange={(e) => setPhoneOldOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="------"
                  maxLength={6}
                  data-testid="input-old-phone-otp"
                />
              </div>

              <DialogFooter className="gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    resetPhoneChangeForm();
                    setPhoneChangeDialogOpen(false);
                  }}
                  data-testid="button-cancel-verify-old"
                >
                  {t.cancel}
                </Button>
                <Button
                  onClick={handleVerifyOldPhone}
                  disabled={phoneVerifying || !phoneOldOtp.trim() || phoneOldOtp.length < 6}
                  data-testid="button-verify-old-phone"
                >
                  {phoneVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : t.verifyChanges}
                </Button>
              </DialogFooter>
            </div>
          )}

          {phoneChangeStep === 'verify_password' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t.enterPassword}</p>
              
              <div className="space-y-2">
                <Label>{t.currentPassword}</Label>
                <div className="relative">
                  <Input
                    type={showPhoneChangePassword ? 'text' : 'password'}
                    value={phoneChangePassword}
                    onChange={(e) => setPhoneChangePassword(e.target.value)}
                    data-testid="input-phone-change-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPhoneChangePassword(!showPhoneChangePassword)}
                    data-testid="button-toggle-phone-change-password"
                  >
                    {showPhoneChangePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <DialogFooter className="gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    resetPhoneChangeForm();
                    setPhoneChangeDialogOpen(false);
                  }}
                  data-testid="button-cancel-verify-password"
                >
                  {t.cancel}
                </Button>
                <Button
                  onClick={handleVerifyPassword}
                  disabled={phoneVerifying || !phoneChangePassword.trim()}
                  data-testid="button-verify-password"
                >
                  {phoneVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : t.verifyChanges}
                </Button>
              </DialogFooter>
            </div>
          )}

          {phoneChangeStep === 'verify_new' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t.enterNewPhoneCode}</p>
              <p className="text-sm font-medium">{newPhoneInput.value}</p>
              
              <Button 
                className="w-full" 
                onClick={handleSendNewPhoneOtp}
                disabled={phoneNewSmsSending || phoneNewSmsCooldown > 0}
                data-testid="button-send-new-phone-otp"
              >
                {phoneNewSmsSending 
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : phoneNewSmsCooldown > 0 
                    ? `${t.sendSmsCode} (${phoneNewSmsCooldown}${language === 'ru' ? 'с' : 's'})`
                    : t.sendSmsCode
                }
              </Button>

              <div className="space-y-2">
                <Label>{t.smsCodePlaceholder}</Label>
                <Input
                  type="text"
                  value={phoneNewOtp}
                  onChange={(e) => setPhoneNewOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="------"
                  maxLength={6}
                  data-testid="input-new-phone-otp"
                />
              </div>

              <DialogFooter className="gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    resetPhoneChangeForm();
                    setPhoneChangeDialogOpen(false);
                  }}
                  data-testid="button-cancel-verify-new"
                >
                  {t.cancel}
                </Button>
                <Button
                  onClick={handleVerifyNewPhone}
                  disabled={phoneVerifying || !phoneNewOtp.trim() || phoneNewOtp.length < 6}
                  data-testid="button-verify-new-phone"
                >
                  {phoneVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : t.verifyChanges}
                </Button>
              </DialogFooter>
            </div>
          )}

          {phoneChangeStep === 'cooldown' && cooldownEndsAt && (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-900">
                <p className="text-sm">{t.phoneChangeCooldownInfo}</p>
                <p className="text-sm font-medium mt-2">
                  {t.timeRemaining}: {Math.max(0, Math.floor((cooldownEndsAt.getTime() - Date.now()) / 3600000))}{t.hours} {Math.max(0, Math.floor(((cooldownEndsAt.getTime() - Date.now()) % 3600000) / 60000))}{t.minutes}
                </p>
              </div>

              <DialogFooter className="gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    resetPhoneChangeForm();
                    setPhoneChangeDialogOpen(false);
                  }}
                  data-testid="button-close-cooldown"
                >
                  {t.cancel}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleCancelPhoneChange}
                  disabled={phoneVerifying}
                  data-testid="button-cancel-phone-change-request"
                >
                  {phoneVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : t.cancelPhoneChange}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RepresentativeModeToggle({ language }: { language: 'ru' | 'uz' }) {
  const { representativeModeEnabled, setRepresentativeModeEnabled, representativeMode, deactivateRepresentativeMode } = useAuth();
  const { toast } = useToast();
  
  const texts = {
    ru: {
      title: 'Режим представителя',
      description: 'Включите этот режим, если вы являетесь представителем организации',
      enableMode: 'Включить режим представителя',
      enabled: 'Режим представителя включён',
      disabled: 'Режим представителя выключен',
      activeWarning: 'Сейчас вы работаете от имени',
      deactivateFirst: 'Сначала выйдите из режима представителя, чтобы отключить эту функцию',
    },
    uz: {
      title: 'Vakil rejimi',
      description: 'Agar siz tashkilot vakili bo\'lsangiz, ushbu rejimni yoqing',
      enableMode: 'Vakil rejimini yoqish',
      enabled: 'Vakil rejimi yoqilgan',
      disabled: 'Vakil rejimi o\'chirilgan',
      activeWarning: 'Hozir siz nomidan ishlayapsiz',
      deactivateFirst: 'Ushbu funksiyani o\'chirish uchun avval vakil rejimidan chiqing',
    }
  };
  const t = texts[language];

  const handleToggle = async (checked: boolean) => {
    if (!checked && representativeMode?.active) {
      toast({
        title: t.deactivateFirst,
        variant: 'destructive',
      });
      return;
    }
    setRepresentativeModeEnabled(checked);
    toast({
      title: checked ? t.enabled : t.disabled,
    });
  };

  return (
    <Card data-testid="section-representative-mode-toggle">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {t.title}
        </CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <Label htmlFor="representative-mode-toggle" className="flex items-center gap-2 cursor-pointer">
            {t.enableMode}
          </Label>
          <Switch
            id="representative-mode-toggle"
            checked={representativeModeEnabled}
            onCheckedChange={handleToggle}
            data-testid="switch-representative-mode"
          />
        </div>
        {representativeMode?.active && (
          <div className="mt-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-sm text-primary">
              {t.activeWarning}: <strong>{representativeMode.customerName}</strong>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MyPrincipalsSection({ language }: { language: 'ru' | 'uz' }) {
  const { representativeMode, activateRepresentativeMode, deactivateRepresentativeMode } = useAuth();
  const { toast } = useToast();
  const [activatingCustomerId, setActivatingCustomerId] = useState<number | null>(null);

  const texts = {
    ru: {
      title: 'Мои доверители',
      description: 'Организации, от имени которых вы можете работать',
      noPrincipals: 'Вы не являетесь представителем ни одной организации',
      company: 'Организация',
      permissions: 'Права',
      status: 'Статус',
      action: 'Действие',
      active: 'Активен',
      inactive: 'Неактивен',
      activate: 'Работать от имени',
      deactivate: 'Выйти из режима',
      currentlyActive: 'Сейчас активен',
      activateSuccess: 'Режим представителя активирован',
      activateError: 'Не удалось активировать режим представителя',
      deactivateSuccess: 'Режим представителя деактивирован',
      loading: 'Загрузка...',
    },
    uz: {
      title: 'Mening ishonch bildiruvchilarim',
      description: 'Nomidan ishlashingiz mumkin bo\'lgan tashkilotlar',
      noPrincipals: 'Siz hech qaysi tashkilotning vakili emassiz',
      company: 'Tashkilot',
      permissions: 'Huquqlar',
      status: 'Holat',
      action: 'Amal',
      active: 'Faol',
      inactive: 'Faol emas',
      activate: 'Nomidan ishlash',
      deactivate: 'Rejimdan chiqish',
      currentlyActive: 'Hozir faol',
      activateSuccess: 'Vakil rejimi faollashtirildi',
      activateError: 'Vakil rejimini faollashtirib bo\'lmadi',
      deactivateSuccess: 'Vakil rejimi o\'chirildi',
      loading: 'Yuklanmoqda...',
    }
  };
  const t = texts[language];
  const permLabels = PERMISSION_LABELS[language];

  const { data: principals, isLoading } = useQuery<Principal[]>({
    queryKey: ['/api/representatives/my-principals'],
  });

  const handleActivate = async (customerId: number) => {
    setActivatingCustomerId(customerId);
    try {
      await activateRepresentativeMode(customerId);
      toast({
        title: t.activateSuccess,
      });
    } catch (error: any) {
      toast({
        title: t.activateError,
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setActivatingCustomerId(null);
    }
  };

  const handleDeactivate = async () => {
    try {
      await deactivateRepresentativeMode();
      toast({
        title: t.deactivateSuccess,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <Card data-testid="section-my-principals">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!principals || principals.length === 0) {
    return null;
  }

  return (
    <Card data-testid="section-my-principals">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {t.title}
        </CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {representativeMode?.active && (
          <div className="mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              <span className="font-medium text-primary">
                {t.currentlyActive}: {representativeMode.customerName}
              </span>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleDeactivate}
              data-testid="button-deactivate-rep-mode"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t.deactivate}
            </Button>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.company}</TableHead>
              <TableHead>{t.permissions}</TableHead>
              <TableHead>{t.status}</TableHead>
              <TableHead className="text-right">{t.action}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {principals.map((principal) => {
              const isCurrentlyActive = representativeMode?.active && representativeMode.customerId === principal.customerId;
              return (
                <TableRow key={principal.id} data-testid={`row-principal-${principal.id}`}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{principal.customer?.companyName || principal.customer?.displayName}</div>
                      {principal.customer?.inn && (
                        <div className="text-sm text-muted-foreground">
                          {language === 'ru' ? 'ИНН' : 'INN'}: {principal.customer.inn}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {principal.permissions.length > 0 ? (
                        principal.permissions.map((perm) => (
                          <Badge key={perm} variant="secondary" className="text-xs">
                            {permLabels[perm]}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={principal.isActive ? "default" : "secondary"}>
                      {principal.isActive ? t.active : t.inactive}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {principal.isActive && (
                      isCurrentlyActive ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleDeactivate}
                          data-testid={`button-deactivate-${principal.customerId}`}
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          {t.deactivate}
                        </Button>
                      ) : (
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => handleActivate(principal.customerId)}
                          disabled={activatingCustomerId === principal.customerId || representativeMode?.active}
                          data-testid={`button-activate-${principal.customerId}`}
                        >
                          {activatingCustomerId === principal.customerId ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <UserCheck className="h-4 w-4 mr-2" />
                          )}
                          {t.activate}
                        </Button>
                      )
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
