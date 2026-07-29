export type Language = 'ru' | 'uz';

export const translations = {
  ru: {
    // App name
    appName: 'Yukbozor',
    tagline: 'Mahalliy yuk tashish xizmatlarning raqamli bozori',
    
    // Auth
    login: 'Вход',
    register: 'Регистрация',
    phone: 'Номер телефона',
    password: 'Пароль',
    confirmPassword: 'Подтвердите пароль',
    forgotPassword: 'Забыли пароль?',
    noAccount: 'Нет аккаунта?',
    haveAccount: 'Уже есть аккаунт?',
    loginButton: 'Войти',
    registerButton: 'Зарегистрироваться',
    logout: 'Выйти',
    
    // PIN
    enterPin: 'Введите PIN-код',
    createPin: 'Создайте PIN-код',
    confirmPin: 'Подтвердите PIN-код',
    pinMismatch: 'PIN-коды не совпадают',
    wrongPin: 'Неверный PIN-код',
    
    // Biometrics
    useBiometrics: 'Использовать отпечаток пальца',
    biometricsPrompt: 'Подтвердите вход отпечатком пальца',
    biometricsError: 'Ошибка биометрии',
    
    // User types
    customer: 'Заказчик',
    carrier: 'Перевозчик',
    partner: 'Партнер',
    
    // Entity types
    legalEntity: 'Юридическое лицо',
    individualEntrepreneur: 'ИП',
    physicalPerson: 'Физическое лицо',
    
    // Navigation
    home: 'Главная',
    orders: 'Заказы',
    deals: 'Сделки',
    deposit: 'Депозит',
    profile: 'Профиль',
    
    // Orders
    newOrder: 'Новый заказ',
    myOrders: 'Мои заказы',
    availableOrders: 'Доступные заказы',
    orderDetails: 'Детали заказа',
    createOrder: 'Создать заказ',
    
    // Offers
    makeOffer: 'Подать предложение',
    myOffers: 'Мои предложения',
    offerPrice: 'Ваша цена',
    
    // Contracts
    contracts: 'Договоры',
    contractDetails: 'Детали договора',
    signContract: 'Подписать договор',
    
    // Deposit
    mainAccount: 'Основной счет',
    blockedAccount: 'Заблокировано',
    inTransitAccount: 'В обработке',
    partnerReward: 'Партнерское вознаграждение',
    topUp: 'Пополнить',
    withdraw: 'Вывести',
    
    // Partner
    referralProgram: 'Реферальная программа',
    referralCode: 'Реферальный код',
    referralLink: 'Реферальная ссылка',
    copyCode: 'Скопировать код',
    copyLink: 'Скопировать ссылку',
    copied: 'Скопировано!',
    
    // Common
    loading: 'Загрузка...',
    error: 'Ошибка',
    retry: 'Повторить',
    cancel: 'Отмена',
    save: 'Сохранить',
    delete: 'Удалить',
    edit: 'Редактировать',
    confirm: 'Подтвердить',
    back: 'Назад',
    next: 'Далее',
    done: 'Готово',
    sum: 'сум',
    
    // Transport types
    transportTypes: {
      labo: 'Лабо',
      bongo: 'Бонго',
      furgon: 'Фургон',
      isuzu5: 'Исузу-5',
      isuzu10: 'Исузу-10',
      gruzovik: 'Грузовик',
      fura_tent: 'Фура тент',
      fura_ref: 'Фура рефрижератор',
      paravoz: 'Паравоз',
      shalanda: 'Шаланда',
      traller: 'Трейлер',
      tonar: 'Тонар',
      other: 'Другой'
    },
    
    // Status
    statusNew: 'Новый',
    statusActive: 'Активный',
    statusCompleted: 'Завершен',
    statusCancelled: 'Отменен',
    
    // Welcome screen
    welcomeTitle: 'Добро пожаловать в Yukbozor',
    welcomeSubtitle: 'Платформа для грузоперевозок в Узбекистане',
    viewOrders: 'Посмотреть доступные заказы',
    workInApp: 'Работать в приложении',
    
    // SMS Login
    loginWithSms: 'Войти по SMS',
    loginWithPassword: 'Войти по паролю',
    sendSmsCode: 'Отправить код',
    smsCode: 'Код из SMS',
    enterSmsCode: 'Введите код из SMS',
    resendCode: 'Отправить код повторно',
    codeResent: 'Код отправлен повторно',
    
    // Registration steps
    step1: 'Шаг 1',
    step2: 'Шаг 2',
    step3: 'Шаг 3',
    selectRole: 'Выберите роль',
    selectUserType: 'Выберите тип пользователя',
    enterDetails: 'Введите данные',
    roleDescription: {
      customer: 'Заказывайте перевозку грузов',
      carrier: 'Выполняйте заказы на перевозку (только для юрлиц и ИП)',
      partner: 'Получайте доход от рекомендаций',
    },
    carrierOnlyForLegal: 'Роль перевозчика доступна только для юридических лиц и ИП',
    
    // Representative mode
    representativeMode: 'Режим представителя',
    representativeModeDesc: 'Работать от имени организации',
    myPrincipals: 'Мои доверители',
    activatePrincipal: 'Активировать',
    deactivatePrincipal: 'Деактивировать',
    noPrincipals: 'Нет доверителей',
    
    // Representatives management
    myRepresentatives: 'Мои представители',
    noRepresentatives: 'У вас нет представителей',
    noRepresentativesDesc: 'Добавьте людей, которые будут работать от вашего имени',
    addRepresentative: 'Добавить представителя',
    searchByPhone: 'Поиск по номеру',
    selectPermissions: 'Выберите разрешения',
    removeRepresentative: 'Удалить представителя',
    selectUser: 'Выберите пользователя',
    noResults: 'Пользователь не найден',
    confirmRemove: 'Вы уверены?',
    removeDesc: 'Этот человек больше не будет представлять вас',
    allPermissions: 'Все разрешения',
    
    // Public orders
    publicOrders: 'Доступные заказы',
    loginToMakeOffer: 'Войдите, чтобы подать предложение',
    
    // Announcements
    announcements: 'Объявления',
    createAnnouncement: 'Создать объявление',
    announcementTitle: 'Название',
    announcementDescription: 'Описание',
    fromRegion: 'Из региона',
    toRegion: 'В регион',
    transportType: 'Тип транспорта',
    contactPhone: 'Контактный телефон',
    noAnnouncements: 'Нет объявлений',
    announcementCreated: 'Объявление создано',
    failedToCreateAnnouncement: 'Не удалось создать объявление',
  },
  
  uz: {
    // App name
    appName: 'Yukbozor',
    tagline: 'Mahalliy yuk tashish xizmatlarning raqamli bozori',
    
    // Auth
    login: 'Kirish',
    register: 'Ro\'yxatdan o\'tish',
    phone: 'Telefon raqami',
    password: 'Parol',
    confirmPassword: 'Parolni tasdiqlang',
    forgotPassword: 'Parolni unutdingizmi?',
    noAccount: 'Akkauntingiz yo\'qmi?',
    haveAccount: 'Akkauntingiz bormi?',
    loginButton: 'Kirish',
    registerButton: 'Ro\'yxatdan o\'tish',
    logout: 'Chiqish',
    
    // PIN
    enterPin: 'PIN-kodni kiriting',
    createPin: 'PIN-kod yarating',
    confirmPin: 'PIN-kodni tasdiqlang',
    pinMismatch: 'PIN-kodlar mos kelmadi',
    wrongPin: 'Noto\'g\'ri PIN-kod',
    
    // Biometrics
    useBiometrics: 'Barmoq izidan foydalanish',
    biometricsPrompt: 'Barmoq izi bilan kirishni tasdiqlang',
    biometricsError: 'Biometrik xato',
    
    // User types
    customer: 'Buyurtmachi',
    carrier: 'Tashuvchi',
    partner: 'Hamkor',
    
    // Entity types
    legalEntity: 'Yuridik shaxs',
    individualEntrepreneur: 'YTT',
    physicalPerson: 'Jismoniy shaxs',
    
    // Navigation
    home: 'Bosh sahifa',
    orders: 'Buyurtmalar',
    deals: 'Bitimlar',
    deposit: 'Depozit',
    profile: 'Profil',
    
    // Orders
    newOrder: 'Yangi buyurtma',
    myOrders: 'Mening buyurtmalarim',
    availableOrders: 'Mavjud buyurtmalar',
    orderDetails: 'Buyurtma tafsilotlari',
    createOrder: 'Buyurtma yaratish',
    
    // Offers
    makeOffer: 'Taklif berish',
    myOffers: 'Mening takliflarim',
    offerPrice: 'Sizning narxingiz',
    
    // Contracts
    contracts: 'Shartnomalar',
    contractDetails: 'Shartnoma tafsilotlari',
    signContract: 'Shartnomani imzolash',
    
    // Deposit
    mainAccount: 'Asosiy hisob',
    blockedAccount: 'Bloklangan',
    inTransitAccount: 'Jarayonda',
    partnerReward: 'Hamkorlik mukofoti',
    topUp: 'To\'ldirish',
    withdraw: 'Yechib olish',
    
    // Partner
    referralProgram: 'Referal dasturi',
    referralCode: 'Referal kod',
    referralLink: 'Referal havola',
    copyCode: 'Kodni nusxalash',
    copyLink: 'Havolani nusxalash',
    copied: 'Nusxalandi!',
    
    // Common
    loading: 'Yuklanmoqda...',
    error: 'Xato',
    retry: 'Qayta urinish',
    cancel: 'Bekor qilish',
    save: 'Saqlash',
    delete: 'O\'chirish',
    edit: 'Tahrirlash',
    confirm: 'Tasdiqlash',
    back: 'Orqaga',
    next: 'Keyingi',
    done: 'Tayyor',
    sum: 'so\'m',
    
    // Transport types
    transportTypes: {
      labo: 'Labo',
      bongo: 'Bongo',
      furgon: 'Furgon',
      isuzu5: 'Isuzu-5',
      isuzu10: 'Isuzu-10',
      gruzovik: 'Yuklarli avtomobil',
      fura_tent: 'Fura tent',
      fura_ref: 'Fura muzlagich',
      paravoz: 'Paravoz',
      shalanda: 'Shalanda',
      traller: 'Treyler',
      tonar: 'Tonar',
      other: 'Boshqa'
    },
    
    // Status
    statusNew: 'Yangi',
    statusActive: 'Faol',
    statusCompleted: 'Yakunlangan',
    statusCancelled: 'Bekor qilingan',
    
    // Welcome screen
    welcomeTitle: 'Yukbozorga xush kelibsiz',
    welcomeSubtitle: 'O\'zbekistonda yuk tashish platformasi',
    viewOrders: 'Mavjud buyurtmalarni ko\'rish',
    workInApp: 'Ilovada ishlash',
    
    // SMS Login
    loginWithSms: 'SMS orqali kirish',
    loginWithPassword: 'Parol bilan kirish',
    sendSmsCode: 'Kodni yuborish',
    smsCode: 'SMS kod',
    enterSmsCode: 'SMSdan kodni kiriting',
    resendCode: 'Kodni qayta yuborish',
    codeResent: 'Kod qayta yuborildi',
    
    // Registration steps
    step1: '1-qadam',
    step2: '2-qadam',
    step3: '3-qadam',
    selectRole: 'Rolni tanlang',
    selectUserType: 'Foydalanuvchi turini tanlang',
    enterDetails: 'Ma\'lumotlarni kiriting',
    roleDescription: {
      customer: 'Yuk tashish xizmatini buyurtma qiling',
      carrier: 'Yuk tashish buyurtmalarini bajaring (faqat yuridik shaxslar va YTT uchun)',
      partner: 'Tavsiyalardan daromad oling',
    },
    carrierOnlyForLegal: 'Tashuvchi roli faqat yuridik shaxslar va YTT uchun mavjud',
    
    // Representative mode
    representativeMode: 'Vakolatli rejim',
    representativeModeDesc: 'Tashkilot nomidan ishlash',
    myPrincipals: 'Mening ishonchnomalarim',
    activatePrincipal: 'Faollashtirish',
    deactivatePrincipal: 'O\'chirish',
    noPrincipals: 'Ishonchnomalar yo\'q',
    
    // Representatives management
    myRepresentatives: 'Mening vakillarim',
    noRepresentatives: 'Sizda vakillar yo\'q',
    noRepresentativesDesc: 'O\'zimiz nomidan ishlaydiyan odamlarni qo\'shing',
    addRepresentative: 'Vakil qo\'shish',
    searchByPhone: 'Raqam bo\'yicha izlash',
    selectPermissions: 'Ruxsatlarni tanlang',
    removeRepresentative: 'Vakilni o\'chirish',
    selectUser: 'Foydalanuvchini tanlang',
    noResults: 'Foydalanuvchi topilmadi',
    confirmRemove: 'Ishonchingiz komilmi?',
    removeDesc: 'Bu odam endi sizi ifodalamaydi',
    allPermissions: 'Barcha ruxsatlar',
    
    // Public orders
    publicOrders: 'Mavjud buyurtmalar',
    loginToMakeOffer: 'Taklif berish uchun tizimga kiring',
    
    // Announcements
    announcements: 'E\'lonlar',
    createAnnouncement: 'E\'lon yaratish',
    announcementTitle: 'Nomi',
    announcementDescription: 'Tavsifi',
    fromRegion: 'Viloyatdan',
    toRegion: 'Viloyatga',
    transportType: 'Transport turi',
    contactPhone: 'Aloqa telefoni',
    noAnnouncements: 'E\'lonlar yo\'q',
    announcementCreated: 'E\'lon yaratildi',
    failedToCreateAnnouncement: 'E\'lon yaratib bo\'lmadi',
  }
};
