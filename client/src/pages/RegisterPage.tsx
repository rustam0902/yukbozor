import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { usePhoneInput } from '@/hooks/use-phone-input';
import { Languages, Loader2, ArrowLeft, ArrowRight, CheckCircle, KeyRound, AlertCircle, RefreshCw, Check, Eye, EyeOff } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { RegisterPageSEO } from '@/components/SEO';
import { eimzoService, EImzoKey } from '@/lib/e-imzo';

type UserType = 'individual' | 'ip' | 'legal';
type Role = 'customer' | 'carrier' | 'partner';

interface FormData {
  password: string;
  confirmPassword: string;
  displayName: string;
  lastName: string;
  firstName: string;
  middleName: string;
  role: Role;
  userType: UserType;
  companyName: string;
  inn: string;
  pinfl: string;
  bankAccount: string;
  bankName: string;
  bankCode: string;
  ndsPayer: boolean;
  registrationCodeNds: string;
  passportSeries: string;
  passportNumber: string;
  referralCode: string;
  acceptOffer: boolean;
}

const texts = {
  ru: {
    title: 'Регистрация',
    step1Title: 'Тип пользователя и реферал',
    step1Description: 'Выберите тип аккаунта',
    step2Title: 'Личные данные',
    step2Description: 'Заполните информацию о себе или компании',
    step3Title: 'Создание аккаунта',
    step3Description: 'Подтвердите телефон и создайте пароль',
    role: 'Основная роль',
    roles: {
      customer: 'Заказчик',
      carrier: 'Перевозчик',
      partner: 'Партнёр'
    },
    userType: 'Тип пользователя',
    userTypes: {
      individual: 'Физическое лицо',
      ip: 'ИП',
      legal: 'Юридическое лицо'
    },
    fullName: 'ФИО',
    lastName: 'Фамилия',
    firstName: 'Имя',
    middleName: 'Отчество',
    companyName: 'Название компании',
    ipName: 'Название ИП',
    phone: 'Телефон',
    password: 'Пароль',
    confirmPassword: 'Повтор пароля',
    passwordHint: 'Минимум 8 символов',
    inn: 'ИНН',
    pinfl: 'ПИНФЛ',
    bankAccount: 'Банковский счет',
    bankName: 'Название банка',
    bankCode: 'Код банка',
    ndsPayer: 'Плательщик НДС',
    registrationCodeNds: 'Регистрационный код плательщика НДС',
    passportSeries: 'Серия паспорта',
    passportNumber: 'Номер паспорта',
    referralCode: 'Реферальный код',
    referralCodeHint: 'Введите реферальный код пользователя, который вас пригласил. Если у вас нет такого кода, оставьте поле пустым.',
    referralCodePlaceholder: 'Введите код партнёра',
    referralCodeChecking: 'Проверка...',
    referralCodeValid: 'Код действителен',
    referralCodeInvalid: 'Такой код не найден',
    referralCodeFromLink: 'Код получен по ссылке',
    submit: 'Зарегистрироваться',
    submitting: 'Регистрация...',
    haveAccount: 'Уже есть аккаунт?',
    login: 'Войти',
    passwordMismatch: 'Пароли не совпадают',
    passwordTooShort: 'Пароль должен содержать минимум 8 символов',
    success: 'Регистрация успешна!',
    failed: 'Ошибка регистрации',
    acceptOfferBefore: 'Я принимаю условия ',
    offerLink: 'публичной оферты',
    acceptOfferAfter: '',
    offerRequired: 'Необходимо принять условия оферты',
    smsVerification: 'Подтверждение телефона',
    smsDescription: 'Введите код из СМС',
    smsCode: 'Код из СМС',
    sendCode: 'Отправить код',
    resendCode: 'Отправить повторно',
    verify: 'Подтвердить',
    cooldownText: 'Повторная отправка через',
    seconds: 'сек',
    smsSent: 'Код отправлен на ваш номер',
    smsVerified: 'Телефон подтверждён',
    back: 'Назад',
    next: 'Далее',
    eimzo: 'ЭЦП',
    eimzoSelect: 'Выберите ЭЦП',
    eimzoLoading: 'Загрузка ключей...',
    eimzoNotInstalled: 'E-IMZO не установлен или не запущен',
    eimzoNoKeys: 'Ключи не найдены',
    eimzoRefresh: 'Обновить',
    eimzoRequired: 'Для юр. лиц и ИП ЭЦП обязательна',
    eimzoOptional: 'ЭЦП заполнит данные автоматически',
    eimzoDataFilled: 'Данные получены из ЭЦП',
    eimzoCertNumber: '№ сертификата',
    eimzoValidPeriod: 'Срок действия',
    eimzoOrganization: 'Организация',
    eimzoCertType: 'Тип',
    eimzoCertTypeLegal: 'Юр. лицо',
    eimzoCertTypeIP: 'ИП',
    eimzoCertTypeIndividual: 'Физ. лицо',
    eimzoSelected: 'Выбран',
    eimzoSigning: 'Подписание ЭЦП...',
    eimzoSignError: 'Ошибка подписи ЭЦП',
    eimzoSignCancelled: 'Подписание отменено',
    eimzoSignSuccess: 'ЭЦП успешно подписана',
    stepOf: 'из',
    vatNumberRequired: 'Введите регистрационный код плательщика НДС',
    didoxLoading: 'Загрузка данных компании из Didox...',
    didoxSuccess: 'Данные компании получены из Didox',
    didoxError: 'Не удалось загрузить данные из Didox',
    didoxNotRegistered: 'Компания не найдена в Didox. Заполните данные вручную.',
    didoxSkippedNoTin: 'Для автозаполнения из Didox требуется ИНН. Заполните банковские реквизиты вручную.',
    eimzoTypeMismatchLegalIP: 'Вы выбрали тип пользователя "Юридическое лицо", но ваш ЭЦП принадлежит ИП. Выберите подходящий ЭЦП или измените тип пользователя.',
    eimzoTypeMismatchLegalIndividual: 'Вы выбрали тип пользователя "Юридическое лицо", но ваш ЭЦП принадлежит физическому лицу. Выберите подходящий ЭЦП или измените тип пользователя.',
    eimzoTypeMismatchIPLegal: 'Вы выбрали тип пользователя "ИП", но ваш ЭЦП принадлежит юридическому лицу. Выберите подходящий ЭЦП или измените тип пользователя.',
    eimzoTypeMismatchIPIndividual: 'Вы выбрали тип пользователя "ИП", но ваш ЭЦП принадлежит физическому лицу. Выберите подходящий ЭЦП или измените тип пользователя.',
    innAlreadyExists: 'Пользователь с таким ИНН уже зарегистрирован',
    pinflAlreadyExists: 'Пользователь с таким ПИНФЛ уже зарегистрирован',
    passportAlreadyExists: 'Пользователь с такой серией и номером паспорта уже зарегистрирован',
    checkingData: 'Проверка данных...',
    passportSeriesLatinOnly: 'Серия паспорта должна быть на латинском алфавите (например, AA)'
  },
  uz: {
    title: 'Ro\'yxatdan o\'tish',
    step1Title: 'Foydalanuvchi turi va referal',
    step1Description: 'Hisob turini tanlang',
    step2Title: 'Shaxsiy ma\'lumotlar',
    step2Description: 'O\'zingiz yoki kompaniya haqida ma\'lumot kiriting',
    step3Title: 'Hisob yaratish',
    step3Description: 'Telefonni tasdiqlang va parol yarating',
    role: 'Asosiy rol',
    roles: {
      customer: 'Buyurtmachi',
      carrier: 'Tashuvchi',
      partner: 'Hamkor'
    },
    userType: 'Foydalanuvchi turi',
    userTypes: {
      individual: 'Jismoniy shaxs',
      ip: 'YaTT',
      legal: 'Yuridik shaxs'
    },
    fullName: 'FISh',
    lastName: 'Familiya',
    firstName: 'Ism',
    middleName: 'Otasining ismi',
    companyName: 'Kompaniya nomi',
    ipName: 'YaTT nomi',
    phone: 'Telefon',
    password: 'Parol',
    confirmPassword: 'Parolni tasdiqlash',
    passwordHint: 'Kamida 8 ta belgi',
    inn: 'STIR',
    pinfl: 'JSHSHIR',
    bankAccount: 'Bank hisobi',
    bankName: 'Bank nomi',
    bankCode: 'Bank kodi',
    ndsPayer: 'QQS to\'lovchisi',
    registrationCodeNds: 'QQS to\'lovchining ro\'yxatdan o\'tish kodi',
    passportSeries: 'Pasport seriyasi',
    passportNumber: 'Pasport raqami',
    referralCode: 'Referal kodi',
    referralCodeHint: 'Sizni taklif qilgan foydalanuvchining referal kodini kiriting. Agar bunday kod bo\'lmasa, maydonni bo\'sh qoldiring.',
    referralCodePlaceholder: 'Hamkor kodini kiriting',
    referralCodeChecking: 'Tekshirilmoqda...',
    referralCodeValid: 'Kod to\'g\'ri',
    referralCodeInvalid: 'Bunday kod topilmadi',
    referralCodeFromLink: 'Kod havola orqali olindi',
    submit: 'Ro\'yxatdan o\'tish',
    submitting: 'Ro\'yxatdan o\'tilmoqda...',
    haveAccount: 'Hisobingiz bormi?',
    login: 'Kirish',
    passwordMismatch: 'Parollar mos kelmaydi',
    passwordTooShort: 'Parol kamida 8 ta belgidan iborat bo\'lishi kerak',
    success: 'Ro\'yxatdan muvaffaqiyatli o\'tdingiz!',
    failed: 'Ro\'yxatdan o\'tishda xatolik',
    acceptOfferBefore: 'Men ',
    offerLink: 'ommaviy oferta',
    acceptOfferAfter: ' shartlarini qabul qilaman',
    offerRequired: 'Oferta shartlarini qabul qilish kerak',
    smsVerification: 'Telefon tasdiqlash',
    smsDescription: 'SMS dan kodini kiriting',
    smsCode: 'SMS dan kod',
    sendCode: 'Kod yuborish',
    resendCode: 'Qayta yuborish',
    verify: 'Tasdiqlash',
    cooldownText: 'Qayta yuborish',
    seconds: 'son',
    smsSent: 'Kod raqamingizga yuborildi',
    smsVerified: 'Telefon tasdiqlandi',
    back: 'Orqaga',
    next: 'Davom etish',
    eimzo: 'ERI (ЭЦП)',
    eimzoSelect: 'ERI ni tanlang',
    eimzoLoading: 'Kalitlar yuklanmoqda...',
    eimzoNotInstalled: 'E-IMZO o\'rnatilmagan yoki ishlamayapti',
    eimzoNoKeys: 'Kalitlar topilmadi',
    eimzoRefresh: 'Yangilash',
    eimzoRequired: 'Yuridik shaxslar va YaTT uchun ERI majburiy',
    eimzoOptional: 'ERI ma\'lumotlarni avtomatik to\'ldiradi',
    eimzoDataFilled: 'Ma\'lumotlar ERIdan olindi',
    eimzoCertNumber: 'Sertifikat №',
    eimzoValidPeriod: 'Amal qilish muddati',
    eimzoOrganization: 'Tashkilot',
    eimzoCertType: 'Turi',
    eimzoCertTypeLegal: 'Yuridik shaxs',
    eimzoCertTypeIP: 'YaTT',
    eimzoCertTypeIndividual: 'Jismoniy shaxs',
    eimzoSelected: 'Tanlangan',
    eimzoSigning: 'ERI bilan imzolash...',
    eimzoSignError: 'ERI imzolash xatosi',
    eimzoSignCancelled: 'Imzolash bekor qilindi',
    eimzoSignSuccess: 'ERI muvaffaqiyatli imzolandi',
    stepOf: 'dan',
    vatNumberRequired: 'QQS to\'lovchining ro\'yxatdan o\'tish kodini kiriting',
    eimzoTypeMismatchLegalIP: 'Siz "Yuridik shaxs" turini tanladingiz, lekin ERIngiz YaTT ga tegishli. Mos ERI tanlang yoki foydalanuvchi turini o\'zgartiring.',
    eimzoTypeMismatchLegalIndividual: 'Siz "Yuridik shaxs" turini tanladingiz, lekin ERIngiz jismoniy shaxsga tegishli. Mos ERI tanlang yoki foydalanuvchi turini o\'zgartiring.',
    eimzoTypeMismatchIPLegal: 'Siz "YaTT" turini tanladingiz, lekin ERIngiz yuridik shaxsga tegishli. Mos ERI tanlang yoki foydalanuvchi turini o\'zgartiring.',
    eimzoTypeMismatchIPIndividual: 'Siz "YaTT" turini tanladingiz, lekin ERIngiz jismoniy shaxsga tegishli. Mos ERI tanlang yoki foydalanuvchi turini o\'zgartiring.',
    innAlreadyExists: 'Bunday STIR bilan foydalanuvchi allaqachon ro\'yxatdan o\'tgan',
    pinflAlreadyExists: 'Bunday JSHSHIR bilan foydalanuvchi allaqachon ro\'yxatdan o\'tgan',
    passportAlreadyExists: 'Bunday pasport seriyasi va raqami bilan foydalanuvchi allaqachon ro\'yxatdan o\'tgan',
    checkingData: 'Ma\'lumotlar tekshirilmoqda...',
    passportSeriesLatinOnly: 'Pasport seriyasi lotin alifbosida bo\'lishi kerak (masalan, AA)',
    didoxLoading: 'Didox-dan kompaniya ma\'lumotlari yuklanmoqda...',
    didoxSuccess: 'Kompaniya ma\'lumotlari Didox-dan olindi',
    didoxError: 'Didox-dan ma\'lumotlarni yuklashda xatolik',
    didoxNotRegistered: 'Kompaniya Didox-da topilmadi. Ma\'lumotlarni qo\'lda kiriting.',
    didoxSkippedNoTin: 'Didox-dan avtomatik to\'ldirish uchun STIR kerak. Bank rekvizitlarini qo\'lda kiriting.'
  }
};

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { register } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { toast } = useToast();
  const phoneInput = usePhoneInput();
  
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  
  const [formData, setFormData] = useState<FormData>({
    password: '',
    confirmPassword: '',
    displayName: '',
    lastName: '',
    firstName: '',
    middleName: '',
    role: 'customer',
    userType: 'individual',
    companyName: '',
    inn: '',
    pinfl: '',
    bankAccount: '',
    bankName: '',
    bankCode: '',
    ndsPayer: false,
    registrationCodeNds: '',
    passportSeries: '',
    passportNumber: '',
    referralCode: '',
    acceptOffer: false,
  });
  
  const [loading, setLoading] = useState(false);
  const [referralFromUrl, setReferralFromUrl] = useState(false);

  // Referral code validation state
  const [referralChecking, setReferralChecking] = useState(false);
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [referralDebounceTimer, setReferralDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // SMS verification state
  const [smsCode, setSmsCode] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [smsVerified, setSmsVerified] = useState(false);
  const [smsVerifying, setSmsVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // E-IMZO state
  const [eimzoKeys, setEimzoKeys] = useState<EImzoKey[]>([]);
  const [selectedEimzoKey, setSelectedEimzoKey] = useState<EImzoKey | null>(null);
  const [eimzoLoading, setEimzoLoading] = useState(false);
  const [eimzoError, setEimzoError] = useState<string | null>(null);
  const [eimzoInstalled, setEimzoInstalled] = useState<boolean | null>(null);
  const [eimzoSignature, setEimzoSignature] = useState<string | null>(null);
  const [eimzoSigning, setEimzoSigning] = useState(false);

  // Didox loading state
  const [didoxLoading, setDidoxLoading] = useState(false);

  // Data uniqueness check state
  const [checkingUniqueness, setCheckingUniqueness] = useState(false);

  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const t = texts[language];

  // Check for referral code and role in URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    const roleParam = params.get('role');
    
    if (refCode) {
      setFormData(prev => ({ ...prev, referralCode: refCode }));
      setReferralFromUrl(true);
      checkReferralCode(refCode);
    }
    
    if (roleParam && ['customer', 'carrier', 'partner'].includes(roleParam)) {
      setFormData(prev => ({ ...prev, role: roleParam as Role }));
    }
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Update userType when role changes
  useEffect(() => {
    if (formData.role === 'carrier' && formData.userType === 'individual') {
      setFormData(prev => ({ ...prev, userType: 'legal' }));
    }
  }, [formData.role]);

  // Load E-IMZO keys when userType is legal or ip
  useEffect(() => {
    const loadEimzoKeys = async () => {
      if (formData.userType === 'legal' || formData.userType === 'ip') {
        setEimzoLoading(true);
        setEimzoError(null);
        try {
          const installed = await eimzoService.isInstalledAsync(3000);
          setEimzoInstalled(installed);
          
          if (installed) {
            const keys = await eimzoService.listKeys();
            setEimzoKeys(keys);
            if (keys.length === 0) {
              setEimzoError(t.eimzoNoKeys);
            }
          } else {
            setEimzoError(t.eimzoNotInstalled);
          }
        } catch (error: any) {
          console.error('E-IMZO error:', error);
          setEimzoError(error.message || t.eimzoNotInstalled);
        } finally {
          setEimzoLoading(false);
        }
      } else {
        setEimzoKeys([]);
        setSelectedEimzoKey(null);
        setEimzoError(null);
        setEimzoInstalled(null);
      }
    };

    loadEimzoKeys();
  }, [formData.userType]);

  // Check referral code validity
  const checkReferralCode = async (code: string) => {
    if (!code.trim()) {
      setReferralValid(null);
      return;
    }

    setReferralChecking(true);
    try {
      const response = await fetch(`/api/partners/check-referral-code/${encodeURIComponent(code.trim())}`);
      const data = await response.json();
      setReferralValid(data.valid === true);
    } catch (error) {
      setReferralValid(false);
    } finally {
      setReferralChecking(false);
    }
  };

  // Debounced referral code check
  const handleReferralCodeChange = (value: string) => {
    setFormData(prev => ({ ...prev, referralCode: value }));
    
    if (referralDebounceTimer) {
      clearTimeout(referralDebounceTimer);
    }

    if (!value.trim()) {
      setReferralValid(null);
      return;
    }

    const timer = setTimeout(() => {
      checkReferralCode(value);
    }, 500);
    setReferralDebounceTimer(timer);
  };

  // Fetch company data from Didox by INN
  // Returns: { data: ... } on success, { notFound: true } if not registered, { error: true } on API failure
  const fetchDidoxCompanyData = async (taxId: string): Promise<{ data?: any; notFound?: boolean; error?: boolean } | null> => {
    if (!taxId || taxId.length < 9) return null;
    
    setDidoxLoading(true);
    try {
      const response = await fetch(`/api/didox/company/${taxId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Didox company data:', data);
        return { data };
      } else if (response.status === 404) {
        console.log('Company not found in Didox');
        return { notFound: true };
      } else {
        console.error('Didox API error:', response.status);
        toast({ 
          title: t.didoxError, 
          variant: 'destructive' 
        });
        return { error: true };
      }
    } catch (error) {
      console.error('Error fetching Didox data:', error);
      toast({ 
        title: t.didoxError, 
        variant: 'destructive' 
      });
      return { error: true };
    } finally {
      setDidoxLoading(false);
    }
  };

  // Handle E-IMZO key selection - auto-fill data from E-IMZO and Didox
  const handleEimzoKeySelect = async (keyId: string) => {
    const key = eimzoKeys.find(k => k.id === keyId);
    if (key) {
      setSelectedEimzoKey(key);
      
      const newFormData = { ...formData };
      let taxIdToLookup: string | null = null;
      
      if (formData.userType === 'legal') {
        // For legal entities: use O (organization name) for displayName, TIN for INN
        newFormData.displayName = key.O || key.CN || '';
        newFormData.inn = key.TIN || '';
        taxIdToLookup = key.TIN || null;
        console.log('E-IMZO Legal: O=', key.O, 'TIN=', key.TIN, 'CN=', key.CN);
      } else if (formData.userType === 'ip') {
        // For IP: use CN (person's name) for displayName, not O which contains "ЯККА ТАРТИБДАГИ ТАДБИРКОР"
        // O field for IP contains the type descriptor, not the actual name
        newFormData.displayName = key.CN || '';
        newFormData.pinfl = key.PINFL || '';
        // Note: Didox uses TIN/INN for profile lookup, not PINFL
        // For IPs, try to use TIN if available, otherwise skip Didox lookup
        taxIdToLookup = key.TIN || null;
        console.log('E-IMZO IP: CN=', key.CN, 'O=', key.O, 'PINFL=', key.PINFL, 'TIN=', key.TIN);
      }
      
      setFormData(newFormData);
      
      toast({
        title: t.eimzoDataFilled,
        description: key.CN
      });
      
      // Try to fetch additional data from Didox (uses INN/TIN, not PINFL)
      if (taxIdToLookup && taxIdToLookup.length >= 9) {
        toast({ title: t.didoxLoading });
        
        const didoxResult = await fetchDidoxCompanyData(taxIdToLookup);
        
        if (didoxResult?.data) {
          const didoxData = didoxResult.data;
          // Update form with Didox data (only fill empty fields or update with more complete data)
          const updatedFormData = { ...newFormData };
          
          // Company/IP name (prefer Didox if available and more complete)
          if (didoxData.name && (!updatedFormData.displayName || didoxData.name.length > updatedFormData.displayName.length)) {
            updatedFormData.displayName = didoxData.name;
          }
          
          // Bank details
          if (didoxData.bankAccount || didoxData.account) {
            updatedFormData.bankAccount = didoxData.bankAccount || didoxData.account || '';
          }
          if (didoxData.bankName) {
            updatedFormData.bankName = didoxData.bankName;
          }
          if (didoxData.bankMfo || didoxData.bankId) {
            updatedFormData.bankCode = didoxData.bankMfo || didoxData.bankId || '';
          }
          
          // VAT payer status
          if (didoxData.vat !== undefined) {
            updatedFormData.ndsPayer = didoxData.vat;
          }
          if (didoxData.vatRegCode) {
            updatedFormData.registrationCodeNds = didoxData.vatRegCode;
          }
          
          setFormData(updatedFormData);
          
          toast({
            title: t.didoxSuccess,
            description: didoxData.name
          });
        } else if (didoxResult?.notFound) {
          // Company not found in Didox - user will need to fill manually
          toast({
            title: t.didoxNotRegistered,
            variant: 'default'
          });
        }
        // Note: error case already handled with toast in fetchDidoxCompanyData
      } else if (formData.userType === 'ip' && !taxIdToLookup) {
        // IP without TIN in E-IMZO certificate - inform user to fill manually
        toast({
          title: t.didoxSkippedNoTin,
          variant: 'default'
        });
      }
    }
  };

  // Refresh E-IMZO keys
  const refreshEimzoKeys = async () => {
    setEimzoLoading(true);
    setEimzoError(null);
    try {
      const installed = await eimzoService.isInstalledAsync(3000);
      setEimzoInstalled(installed);
      
      if (installed) {
        const keys = await eimzoService.listKeys();
        setEimzoKeys(keys);
        if (keys.length === 0) {
          setEimzoError(t.eimzoNoKeys);
        }
      } else {
        setEimzoError(t.eimzoNotInstalled);
      }
    } catch (error: any) {
      console.error('E-IMZO error:', error);
      setEimzoError(error.message || t.eimzoNotInstalled);
    } finally {
      setEimzoLoading(false);
    }
  };

  // Get available user types based on role
  const getAvailableUserTypes = () => {
    if (formData.role === 'carrier') {
      return ['legal', 'ip'];
    }
    return ['individual', 'ip', 'legal'];
  };

  // Format date for E-IMZO certificate
  const formatCertDate = (dateStr: string): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Get certificate type label
  const getCertTypeLabel = (certType: 'legal' | 'ip' | 'individual'): string => {
    switch (certType) {
      case 'legal': return t.eimzoCertTypeLegal;
      case 'ip': return t.eimzoCertTypeIP;
      default: return t.eimzoCertTypeIndividual;
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'ru' ? 'uz' : 'ru');
  };

  // Get certificate type from E-IMZO key
  const getEimzoCertType = (key: EImzoKey): 'legal' | 'ip' | 'individual' => {
    return key.certType;
  };

  // Validate Step 1
  const validateStep1 = () => {
    if (formData.referralCode && referralValid === false) {
      toast({ title: t.referralCodeInvalid, variant: 'destructive' });
      return false;
    }
    return true;
  };

  // Validate Step 2
  const validateStep2 = () => {
    if (formData.userType === 'individual') {
      if (!formData.firstName) {
        toast({ title: language === 'uz' ? 'Ismni kiriting' : 'Введите имя', variant: 'destructive' });
        return false;
      }
    } else {
      if (!formData.displayName) {
        toast({ title: language === 'uz' ? 'Kompaniya nomini kiriting' : 'Введите название компании', variant: 'destructive' });
        return false;
      }
    }
    return true;
  };

  // Handle SMS send
  const handleSendSms = async () => {
    setSmsSending(true);
    try {
      const response = await fetch('/api/sms/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: phoneInput.getFullPhone(),
          purpose: 'registration',
          language
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setCooldown(60);
        toast({ title: t.smsSent });
      } else {
        if (data.lockoutRemaining) {
          setCooldown(data.lockoutRemaining);
        } else if (data.cooldownRemaining) {
          setCooldown(data.cooldownRemaining);
        }
        toast({ 
          title: data.error || (language === 'uz' ? 'Xatolik yuz berdi' : 'Произошла ошибка'),
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({ 
        title: language === 'uz' ? 'Xatolik yuz berdi' : 'Произошла ошибка',
        variant: 'destructive'
      });
    } finally {
      setSmsSending(false);
    }
  };

  // Handle SMS verification
  const handleVerifySms = async () => {
    setSmsVerifying(true);
    try {
      const response = await fetch('/api/sms/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: phoneInput.getFullPhone(),
          code: smsCode,
          purpose: 'registration',
          language
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setSmsVerified(true);
        toast({ title: t.smsVerified });
      } else {
        toast({ 
          title: data.error || (language === 'uz' ? 'Tasdiqlash muvaffaqiyatsiz' : 'Ошибка подтверждения'),
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({ 
        title: language === 'uz' ? 'Xatolik yuz berdi' : 'Произошла ошибка',
        variant: 'destructive'
      });
    } finally {
      setSmsVerifying(false);
    }
  };

  // Sign with E-IMZO before registration
  const signWithEimzo = async (): Promise<boolean> => {
    if (!selectedEimzoKey) return true;
    
    setEimzoSigning(true);
    try {
      console.log('[Registration] Loading E-IMZO key...');
      const keyId = await eimzoService.loadKey(selectedEimzoKey);
      
      if (!keyId) {
        toast({ title: t.eimzoSignCancelled, variant: 'destructive' });
        return false;
      }
      
      const documentToSign = JSON.stringify({
        action: 'offer_acceptance',
        timestamp: new Date().toISOString(),
        phone: phoneInput.getFullPhone(),
        userType: formData.userType,
        certificateCN: selectedEimzoKey.CN,
        certificateSerial: selectedEimzoKey.serialNumber || selectedEimzoKey.id
      });
      
      console.log('[Registration] Creating PKCS7 signature...');
      const signature = await eimzoService.createPkcs7(keyId, documentToSign);
      
      if (!signature) {
        toast({ title: t.eimzoSignError, variant: 'destructive' });
        return false;
      }
      
      setEimzoSignature(signature);
      console.log('[Registration] E-IMZO signature created successfully');
      toast({ title: t.eimzoSignSuccess });
      return true;
    } catch (error: any) {
      console.error('[Registration] E-IMZO signing error:', error);
      toast({ 
        title: t.eimzoSignError,
        description: error.message,
        variant: 'destructive'
      });
      return false;
    } finally {
      setEimzoSigning(false);
    }
  };

  // Handle registration
  const handleRegister = async () => {
    if (formData.password.length < 8) {
      toast({ title: t.passwordTooShort, variant: 'destructive' });
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      toast({ title: t.passwordMismatch, variant: 'destructive' });
      return;
    }

    if (!formData.acceptOffer) {
      toast({ title: t.offerRequired, variant: 'destructive' });
      return;
    }

    if (!smsVerified) {
      toast({ title: language === 'uz' ? 'Telefonni tasdiqlang' : 'Подтвердите телефон', variant: 'destructive' });
      return;
    }

    // E-IMZO signature already created when moving from step 1 to step 2

    setLoading(true);
    try {
      const { confirmPassword, role, lastName, firstName, middleName, acceptOffer, ...rest } = formData;
      
      let displayName = rest.displayName;
      if (formData.userType === 'individual' && lastName && firstName) {
        displayName = `${lastName} ${firstName}${middleName ? ' ' + middleName : ''}`;
      }
      
      const registrationData: Record<string, any> = {
        ...rest,
        phone: phoneInput.getFullPhone(),
        displayName,
        lastName: formData.userType === 'individual' ? lastName : undefined,
        firstName: formData.userType === 'individual' ? firstName : undefined,
        middleName: formData.userType === 'individual' ? middleName : undefined,
        defaultRole: role,
        language
      };
      
      if (selectedEimzoKey && (formData.userType === 'legal' || formData.userType === 'ip')) {
        registrationData.eimzoCertSerial = selectedEimzoKey.serialNumber || selectedEimzoKey.id;
        registrationData.eimzoCertValidFrom = selectedEimzoKey.validFrom;
        registrationData.eimzoCertValidTo = selectedEimzoKey.validTo;
        registrationData.eimzoCertCn = selectedEimzoKey.CN;
        registrationData.eimzoCertO = selectedEimzoKey.O;
        registrationData.eimzoCertTin = selectedEimzoKey.TIN;
        registrationData.eimzoCertPinfl = selectedEimzoKey.PINFL;
        
        if (eimzoSignature) {
          registrationData.eimzoOfferSignature = eimzoSignature;
        }
      }
      
      await register(registrationData);
      toast({ title: t.success });
      
      const dashboardRoute = role === 'partner' ? '/partner' : role === 'carrier' ? '/carrier' : '/customer';
      setLocation(dashboardRoute);
    } catch (error: any) {
      toast({ 
        title: t.failed, 
        description: error.message || 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Check data uniqueness before step 3
  const checkDataUniqueness = async (): Promise<boolean> => {
    setCheckingUniqueness(true);
    try {
      // Only send fields that are filled and relevant to user type
      // Include userType for scoped uniqueness checks
      const requestBody: Record<string, string | undefined> = {
        userType: formData.userType
      };
      
      // INN only for legal entities
      if (formData.userType === 'legal' && formData.inn && formData.inn.length === 9) {
        requestBody.inn = formData.inn;
      }
      
      // PINFL only for IP and individual (not for legal - director can have multiple companies)
      if ((formData.userType === 'ip' || formData.userType === 'individual') && formData.pinfl && formData.pinfl.length === 14) {
        requestBody.pinfl = formData.pinfl;
      }
      
      // Passport only for individuals
      if (formData.userType === 'individual' && formData.passportSeries && formData.passportNumber) {
        if (formData.passportSeries.length === 2 && formData.passportNumber.length === 7) {
          requestBody.passportSeries = formData.passportSeries;
          requestBody.passportNumber = formData.passportNumber;
        }
      }
      
      const response = await fetch('/api/auth/check-unique-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        // Block on server error
        toast({ 
          title: language === 'uz' ? 'Xatolik yuz berdi. Qayta urinib ko\'ring.' : 'Произошла ошибка. Попробуйте снова.', 
          variant: 'destructive' 
        });
        return false;
      }

      const data = await response.json();
      
      if (!data.unique && data.errors && data.errors.length > 0) {
        // Show first error with specific message
        const firstError = data.errors[0];
        const message = language === 'uz' ? firstError.message_uz : firstError.message_ru;
        toast({ title: message, variant: 'destructive' });
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Check uniqueness error:', error);
      // Block on network error
      toast({ 
        title: language === 'uz' ? 'Tarmoq xatosi. Qayta urinib ko\'ring.' : 'Ошибка сети. Попробуйте снова.', 
        variant: 'destructive' 
      });
      return false;
    } finally {
      setCheckingUniqueness(false);
    }
  };

  // Navigation
  const goToNextStep = async () => {
    if (currentStep === 1) {
      if (!validateStep1()) return;
      // Sign with E-IMZO when moving from step 1 to step 2 for legal/IP
      if ((formData.userType === 'legal' || formData.userType === 'ip') && selectedEimzoKey) {
        const signed = await signWithEimzo();
        if (!signed) return;
      }
    }
    if (currentStep === 2) {
      if (!validateStep2()) return;
      // Check uniqueness before going to step 3
      const isUnique = await checkDataUniqueness();
      if (!isUnique) return;
    }
    setCurrentStep(prev => Math.min(prev + 1, totalSteps));
  };

  const goToPrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  // Progress indicator
  const ProgressIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div 
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              step < currentStep 
                ? 'bg-primary text-primary-foreground' 
                : step === currentStep 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            {step < currentStep ? <Check className="h-4 w-4" /> : step}
          </div>
          {step < 3 && (
            <div className={`w-12 h-1 mx-1 ${step < currentStep ? 'bg-primary' : 'bg-muted'}`} />
          )}
        </div>
      ))}
    </div>
  );

  // Step 1: User Type, E-IMZO, Referral
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="role">{t.role}</Label>
          <Select
            value={formData.role}
            onValueChange={(value) => setFormData({ ...formData, role: value as Role })}
          >
            <SelectTrigger data-testid="select-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="customer">{t.roles.customer}</SelectItem>
              <SelectItem value="carrier">{t.roles.carrier}</SelectItem>
              <SelectItem value="partner">{t.roles.partner}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="userType">{t.userType}</Label>
          <Select
            value={formData.userType}
            onValueChange={(value) => setFormData({ ...formData, userType: value as UserType })}
          >
            <SelectTrigger data-testid="select-user-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getAvailableUserTypes().includes('individual') && (
                <SelectItem value="individual">{t.userTypes.individual}</SelectItem>
              )}
              {getAvailableUserTypes().includes('ip') && (
                <SelectItem value="ip">{t.userTypes.ip}</SelectItem>
              )}
              {getAvailableUserTypes().includes('legal') && (
                <SelectItem value="legal">{t.userTypes.legal}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Referral Code */}
      <div className="space-y-2">
        <Label htmlFor="referralCode">{t.referralCode}</Label>
        <p className="text-xs text-muted-foreground mb-2">{t.referralCodeHint}</p>
        <div className="relative">
          <Input
            id="referralCode"
            type="text"
            placeholder={t.referralCodePlaceholder}
            value={formData.referralCode}
            onChange={(e) => handleReferralCodeChange(e.target.value)}
            maxLength={50}
            disabled={referralFromUrl}
            className={referralFromUrl ? 'bg-muted' : ''}
            data-testid="input-referral-code"
          />
          {referralChecking && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!referralChecking && referralValid === true && formData.referralCode && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
          )}
          {!referralChecking && referralValid === false && formData.referralCode && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <AlertCircle className="h-4 w-4 text-destructive" />
            </div>
          )}
        </div>
        {referralFromUrl && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            {t.referralCodeFromLink}
          </p>
        )}
        {!referralChecking && referralValid === true && formData.referralCode && !referralFromUrl && (
          <p className="text-xs text-green-600">{t.referralCodeValid}</p>
        )}
        {!referralChecking && referralValid === false && formData.referralCode && (
          <p className="text-xs text-destructive">{t.referralCodeInvalid}</p>
        )}
      </div>
    </div>
  );

  // Step 2: Personal/Company Data (simplified)
  const renderStep2 = () => (
    <div className="space-y-4">
      {formData.userType === 'individual' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="firstName">{t.firstName}</Label>
            <Input
              id="firstName"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
              data-testid="input-first-name"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {language === 'ru'
              ? 'Остальные данные (фамилия, ПИНФЛ, паспорт) можно заполнить в профиле после регистрации.'
              : 'Qolgan ma\'lumotlar (familiya, JSHSHIR, pasport) ro\'yxatdan o\'tgandan keyin profildan to\'ldirilishi mumkin.'}
          </p>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="displayName">{formData.userType === 'ip' ? t.ipName : t.companyName}</Label>
            <Input
              id="displayName"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              required
              data-testid="input-display-name"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {language === 'ru'
              ? 'ИНН, банковские реквизиты и другие данные можно заполнить в профиле после регистрации.'
              : 'STIR, bank rekvizitlari va boshqa ma\'lumotlarni ro\'yxatdan o\'tgandan keyin profildan to\'ldirish mumkin.'}
          </p>
        </>
      )}
    </div>
  );

  // Step 3: Phone verification, Password, Role, Offer
  const renderStep3 = () => (
    <div className="space-y-6">
      {/* Phone and SMS Verification */}
      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
        <div className="space-y-2">
          <Label htmlFor="phone">{t.phone}</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="phone"
              {...phoneInput.inputProps}
              disabled={smsVerified}
              className={smsVerified ? 'bg-muted w-full' : 'w-full'}
              data-testid="input-phone"
            />
            {!smsVerified && (
              <Button
                type="button"
                variant="outline"
                onClick={handleSendSms}
                disabled={smsSending || !phoneInput.isComplete || cooldown > 0}
                className="w-full sm:w-auto sm:flex-shrink-0"
                data-testid="button-send-sms"
              >
                {smsSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : cooldown > 0 ? (
                  `${cooldown} ${t.seconds}`
                ) : (
                  t.sendCode
                )}
              </Button>
            )}
          </div>
        </div>

        {!smsVerified && phoneInput.isComplete && (
          <div className="space-y-2">
            <Label htmlFor="smsCode">{t.smsCode}</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                id="smsCode"
                type="text"
                inputMode="numeric"
                placeholder="______"
                maxLength={6}
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-xl tracking-widest w-full"
                data-testid="input-sms-code"
              />
              <Button
                type="button"
                onClick={handleVerifySms}
                disabled={smsVerifying || smsCode.length !== 6}
                className="w-full sm:w-auto sm:flex-shrink-0"
                data-testid="button-verify-sms"
              >
                {smsVerifying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t.verify
                )}
              </Button>
            </div>
          </div>
        )}

        {smsVerified && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">{t.smsVerified}</span>
          </div>
        )}
      </div>

      {/* Password fields - visible after SMS verification */}
      <div className={`space-y-4 transition-opacity ${smsVerified ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t.password}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={8}
                autoComplete="new-password"
                disabled={!smsVerified}
                className="pr-10"
                data-testid="input-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 text-muted-foreground"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t.passwordHint}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t.confirmPassword}</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                minLength={8}
                autoComplete="new-password"
                disabled={!smsVerified}
                className="pr-10"
                data-testid="input-confirm-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 text-muted-foreground"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                data-testid="button-toggle-confirm-password"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Accept Offer */}
        <div className="flex items-start space-x-2">
          <Checkbox
            id="acceptOffer"
            checked={formData.acceptOffer}
            onCheckedChange={(checked) => 
              setFormData({ ...formData, acceptOffer: checked as boolean })
            }
            disabled={!smsVerified}
            data-testid="checkbox-accept-offer"
          />
          <Label htmlFor="acceptOffer" className="text-sm font-normal cursor-pointer leading-relaxed">
            {t.acceptOfferBefore}
            <a 
              href={language === 'uz' ? '/oferta-uz.pdf' : '/oferta-ru.pdf'} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
              data-testid="link-offer"
            >
              {t.offerLink}
            </a>
            {t.acceptOfferAfter}
          </Label>
        </div>
      </div>
    </div>
  );

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return t.step1Title;
      case 2: return t.step2Title;
      case 3: return t.step3Title;
      default: return '';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 1: return t.step1Description;
      case 2: return t.step2Description;
      case 3: return t.step3Description;
      default: return '';
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-4 bg-muted/30">
      <RegisterPageSEO lang={language} />
      <div className="mb-4 flex items-center justify-between">
        <button 
          onClick={() => setLocation('/')} 
          className="flex items-center cursor-pointer" 
          data-testid="link-logo"
        >
          <span className="text-2xl font-bold tracking-tight">
            <span className="text-primary">YUK</span>
            <span className="mx-1"></span>
            <span className="text-destructive">BOZOR</span>
          </span>
        </button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={toggleLanguage}
          data-testid="button-toggle-language"
        >
          {language === 'ru' ? 'RU' : 'UZ'}
        </Button>
      </div>
      
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <div className="text-center mb-2">
              <span className="text-sm text-muted-foreground">
                {currentStep} {t.stepOf} {totalSteps}
              </span>
            </div>
            <ProgressIndicator />
            <CardTitle className="text-xl text-center">{getStepTitle()}</CardTitle>
            <CardDescription className="text-center">{getStepDescription()}</CardDescription>
          </CardHeader>
          <CardContent>
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}

            {/* Navigation buttons */}
            <div className="flex justify-between mt-8 gap-4">
              {currentStep > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={goToPrevStep}
                  data-testid="button-back"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t.back}
                </Button>
              ) : (
                <div />
              )}

              {currentStep < totalSteps ? (
                <Button
                  type="button"
                  onClick={goToNextStep}
                  disabled={
                    (currentStep === 1 && referralChecking) ||
                    (currentStep === 1 && !!formData.referralCode && referralValid === false) ||
                    (currentStep === 2 && checkingUniqueness)
                  }
                  data-testid="button-next"
                >
                  {checkingUniqueness ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t.checkingData}
                    </>
                  ) : (
                    <>
                      {t.next}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleRegister}
                  disabled={loading || eimzoSigning || !smsVerified || !formData.acceptOffer || formData.password.length < 8}
                  data-testid="button-register"
                >
                  {loading || eimzoSigning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {eimzoSigning ? t.eimzoSigning : t.submitting}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {t.submit}
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="text-center text-sm text-muted-foreground mt-6">
              {t.haveAccount}{' '}
              <a href="/login" className="text-primary hover:underline" data-testid="link-login">
                {t.login}
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
