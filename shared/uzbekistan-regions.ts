export interface District {
  name: string;
  nameUz: string;
  nameRu: string;
}

export interface Region {
  name: string;
  nameUz: string;
  nameRu: string;
  districts: District[];
}

export const uzbekistanRegions: Region[] = [
  {
    name: 'tashkent_city',
    nameUz: 'Toshkent shahri',
    nameRu: 'Город Ташкент',
    districts: [
      { name: 'bektemir', nameUz: 'Bektemir tumani', nameRu: 'Бектемирский район' },
      { name: 'chilanzar', nameUz: 'Chilonzor tumani', nameRu: 'Чиланзарский район' },
      { name: 'mirobod', nameUz: 'Mirobod tumani', nameRu: 'Мирабадский район' },
      { name: 'mirzo_ulugbek', nameUz: 'Mirzo Ulug\'bek tumani', nameRu: 'Мирзо-Улугбекский район' },
      { name: 'olmazor', nameUz: 'Olmazor tumani', nameRu: 'Алмазарский район' },
      { name: 'sergeli', nameUz: 'Sergeli tumani', nameRu: 'Сергелийский район' },
      { name: 'shayxontohur', nameUz: 'Shayxontohur tumani', nameRu: 'Шайхантахурский район' },
      { name: 'uchtepa', nameUz: 'Uchtepa tumani', nameRu: 'Учтепинский район' },
      { name: 'yakkasaray', nameUz: 'Yakkasaroy tumani', nameRu: 'Яккасарайский район' },
      { name: 'yangiha yot', nameUz: 'Yangihayot tumani', nameRu: 'Янгихаётский район' },
      { name: 'yunusabad', nameUz: 'Yunusobod tumani', nameRu: 'Юнусабадский район' },
      { name: 'yashnobod', nameUz: 'Yashnobod tumani', nameRu: 'Яшнабадский район' },
    ]
  },
  {
    name: 'karakalpakstan',
    nameUz: 'Qoraqalpog\'iston Respublikasi',
    nameRu: 'Республика Каракалпакстан',
    districts: [
      { name: 'nukus', nameUz: 'Nukus shahri', nameRu: 'Город Нукус' },
      { name: 'amudaryo', nameUz: 'Amudaryo tumani', nameRu: 'Амударьинский район' },
      { name: 'beruniy', nameUz: 'Beruniy tumani', nameRu: 'Берунийский район' },
      { name: 'bo\'zatov', nameUz: 'Bo\'zatov tumani', nameRu: 'Бозатауский район' },
      { name: 'ellikqala', nameUz: 'Ellikqal\'a tumani', nameRu: 'Элликкалинский район' },
      { name: 'kegayli', nameUz: 'Kegeyli tumani', nameRu: 'Кегейлийский район' },
      { name: 'qonliko\'l', nameUz: 'Qonliko\'l tumani', nameRu: 'Канлыкульский район' },
      { name: 'qorao\'zak', nameUz: 'Qorao\'zak tumani', nameRu: 'Караузякский район' },
      { name: 'qo\'ng\'irot', nameUz: 'Qo\'ng\'irot tumani', nameRu: 'Кунградский район' },
      { name: 'mo\'ynoq', nameUz: 'Mo\'ynoq tumani', nameRu: 'Муйнакский район' },
      { name: 'nukus_district', nameUz: 'Nukus tumani', nameRu: 'Нукусский район' },
      { name: 'taxiatosh', nameUz: 'Taxiatosh tumani', nameRu: 'Тахиаташский район' },
      { name: 'taxtako\'pir', nameUz: 'Taxtako\'pir tumani', nameRu: 'Тахтакупырский район' },
      { name: 'to\'rtko\'l', nameUz: 'To\'rtko\'l tumani', nameRu: 'Турткульский район' },
      { name: 'xo\'jayli', nameUz: 'Xo\'jayli tumani', nameRu: 'Ходжейлийский район' },
      { name: 'chimboy', nameUz: 'Chimboy tumani', nameRu: 'Чимбайский район' },
      { name: 'shumanay', nameUz: 'Shumanay tumani', nameRu: 'Шуманайский район' },
    ]
  },
  {
    name: 'andijan',
    nameUz: 'Andijon viloyati',
    nameRu: 'Андижанская область',
    districts: [
      { name: 'andijan_city', nameUz: 'Andijon shahri', nameRu: 'Город Андижан' },
      { name: 'xonobod', nameUz: 'Xonobod shahri', nameRu: 'Город Ханабад' },
      { name: 'andijon', nameUz: 'Andijon tumani', nameRu: 'Андижанский район' },
      { name: 'asaka', nameUz: 'Asaka tumani', nameRu: 'Асакинский район' },
      { name: 'baliqchi', nameUz: 'Baliqchi tumani', nameRu: 'Балыкчинский район' },
      { name: 'buloqboshi', nameUz: 'Buloqboshi tumani', nameRu: 'Булакбашинский район' },
      { name: 'bo\'z', nameUz: 'Bo\'z tumani', nameRu: 'Бузский район' },
      { name: 'jalaquduq', nameUz: 'Jalaquduq tumani', nameRu: 'Джалакудукский район' },
      { name: 'izboskan', nameUz: 'Izboskan tumani', nameRu: 'Избасканский район' },
      { name: 'qo\'rg\'ontepa', nameUz: 'Qo\'rg\'ontepa tumani', nameRu: 'Кургантепинский район' },
      { name: 'marhamat', nameUz: 'Marhamat tumani', nameRu: 'Мархаматский район' },
      { name: 'oltinko\'l', nameUz: 'Oltinko\'l tumani', nameRu: 'Алтынкульский район' },
      { name: 'paxtaobod', nameUz: 'Paxtaobod tumani', nameRu: 'Пахтаабадский район' },
      { name: 'ulug\'nor', nameUz: 'Ulug\'nor tumani', nameRu: 'Улугнорский район' },
      { name: 'xo\'jaobod', nameUz: 'Xo\'jaobod tumani', nameRu: 'Ходжаабадский район' },
      { name: 'shaxrixon', nameUz: 'Shaxrixon tumani', nameRu: 'Шахриханский район' },
    ]
  },
  {
    name: 'bukhara',
    nameUz: 'Buxoro viloyati',
    nameRu: 'Бухарская область',
    districts: [
      { name: 'bukhara_city', nameUz: 'Buxoro shahri', nameRu: 'Город Бухара' },
      { name: 'kogon_city', nameUz: 'Kogon shahri', nameRu: 'Город Каган' },
      { name: 'olot', nameUz: 'Olot tumani', nameRu: 'Алатский район' },
      { name: 'buxoro', nameUz: 'Buxoro tumani', nameRu: 'Бухарский район' },
      { name: 'g\'ijduvon', nameUz: 'G\'ijduvon tumani', nameRu: 'Гиждуванский район' },
      { name: 'jondor', nameUz: 'Jondor tumani', nameRu: 'Джондорский район' },
      { name: 'kogon', nameUz: 'Kogon tumani', nameRu: 'Каганский район' },
      { name: 'qorako\'l', nameUz: 'Qorako\'l tumani', nameRu: 'Каракульский район' },
      { name: 'qorovulbozor', nameUz: 'Qorovulbozor tumani', nameRu: 'Караулбазарский район' },
      { name: 'peshku', nameUz: 'Peshku tumani', nameRu: 'Пешкунский район' },
      { name: 'romitan', nameUz: 'Romitan tumani', nameRu: 'Ромитанский район' },
      { name: 'shofirkon', nameUz: 'Shofirkon tumani', nameRu: 'Шафирканский район' },
      { name: 'vobkent', nameUz: 'Vobkent tumani', nameRu: 'Вабкентский район' },
    ]
  },
  {
    name: 'fergana',
    nameUz: 'Farg\'ona viloyati',
    nameRu: 'Ферганская область',
    districts: [
      { name: 'fergana_city', nameUz: 'Farg\'ona shahri', nameRu: 'Город Фергана' },
      { name: 'marg\'ilon', nameUz: 'Marg\'ilon shahri', nameRu: 'Город Маргилан' },
      { name: 'quvasoy', nameUz: 'Quvasoy shahri', nameRu: 'Город Кувасай' },
      { name: 'qo\'qon', nameUz: 'Qo\'qon shahri', nameRu: 'Город Коканд' },
      { name: 'oltiariq', nameUz: 'Oltiariq tumani', nameRu: 'Алтыарыкский район' },
      { name: 'bag\'dot', nameUz: 'Bag\'dot tumani', nameRu: 'Багдадский район' },
      { name: 'beshariq', nameUz: 'Beshariq tumani', nameRu: 'Бешарыкский район' },
      { name: 'buvayda', nameUz: 'Buvayda tumani', nameRu: 'Бувайдинский район' },
      { name: 'dang\'ara', nameUz: 'Dang\'ara tumani', nameRu: 'Дангаринский район' },
      { name: 'farg\'ona', nameUz: 'Farg\'ona tumani', nameRu: 'Ферганский район' },
      { name: 'furqat', nameUz: 'Furqat tumani', nameRu: 'Фуркатский район' },
      { name: 'qo\'shtepa', nameUz: 'Qo\'shtepa tumani', nameRu: 'Куштепинский район' },
      { name: 'quva', nameUz: 'Quva tumani', nameRu: 'Кувинский район' },
      { name: 'rishton', nameUz: 'Rishton tumani', nameRu: 'Риштанский район' },
      { name: 'so\'x', nameUz: 'So\'x tumani', nameRu: 'Сохский район' },
      { name: 'toshloq', nameUz: 'Toshloq tumani', nameRu: 'Ташлакский район' },
      { name: 'o\'zbekiston', nameUz: 'O\'zbekiston tumani', nameRu: 'Узбекистанский район' },
      { name: 'uchko\'prik', nameUz: 'Uchko\'prik tumani', nameRu: 'Учкуприкский район' },
      { name: 'yozyovon', nameUz: 'Yozyovon tumani', nameRu: 'Языванский район' },
    ]
  },
  {
    name: 'jizzakh',
    nameUz: 'Jizzax viloyati',
    nameRu: 'Джизакская область',
    districts: [
      { name: 'jizzakh_city', nameUz: 'Jizzax shahri', nameRu: 'Город Джизак' },
      { name: 'arnasoy', nameUz: 'Arnasoy tumani', nameRu: 'Арнасайский район' },
      { name: 'baxmal', nameUz: 'Baxmal tumani', nameRu: 'Бахмальский район' },
      { name: 'do\'stlik', nameUz: 'Do\'stlik tumani', nameRu: 'Дустликский район' },
      { name: 'forish', nameUz: 'Forish tumani', nameRu: 'Фаришский район' },
      { name: 'g\'allaorol', nameUz: 'G\'allaorol tumani', nameRu: 'Галляаральский район' },
      { name: 'zarbdor', nameUz: 'Zarbdor tumani', nameRu: 'Зарбдарский район' },
      { name: 'sharof_rashidov', nameUz: 'Sharof Rashidov tumani', nameRu: 'Шараф-Рашидовский район' },
      { name: 'mirzacho\'l', nameUz: 'Mirzacho\'l tumani', nameRu: 'Мирзачульский район' },
      { name: 'paxtakor', nameUz: 'Paxtakor tumani', nameRu: 'Пахтакорский район' },
      { name: 'yangiobod', nameUz: 'Yangiobod tumani', nameRu: 'Янгиабадский район' },
      { name: 'zomin', nameUz: 'Zomin tumani', nameRu: 'Заминский район' },
      { name: 'zafarobod', nameUz: 'Zafarobod tumani', nameRu: 'Зафарабадский район' },
    ]
  },
  {
    name: 'namangan',
    nameUz: 'Namangan viloyati',
    nameRu: 'Наманганская область',
    districts: [
      { name: 'namangan_city', nameUz: 'Namangan shahri', nameRu: 'Город Наманган' },
      { name: 'namangan', nameUz: 'Namangan tumani', nameRu: 'Наманганский район' },
      { name: 'chortoq', nameUz: 'Chortoq tumani', nameRu: 'Чартакский район' },
      { name: 'chust', nameUz: 'Chust tumani', nameRu: 'Чустский район' },
      { name: 'kosonsoy', nameUz: 'Kosonsoy tumani', nameRu: 'Касансайский район' },
      { name: 'mingbuloq', nameUz: 'Mingbuloq tumani', nameRu: 'Мингбулакский район' },
      { name: 'norin', nameUz: 'Norin tumani', nameRu: 'Нарынский район' },
      { name: 'pop', nameUz: 'Pop tumani', nameRu: 'Папский район' },
      { name: 'to\'raqo\'rg\'on', nameUz: 'To\'raqo\'rg\'on tumani', nameRu: 'Туракурганский район' },
      { name: 'uchqo\'rg\'on', nameUz: 'Uchqo\'rg\'on tumani', nameRu: 'Учкурганский район' },
      { name: 'uychi', nameUz: 'Uychi tumani', nameRu: 'Уйчинский район' },
      { name: 'yangiqo\'rg\'on', nameUz: 'Yangiqo\'rg\'on tumani', nameRu: 'Янгикурганский район' },
    ]
  },
  {
    name: 'navoi',
    nameUz: 'Navoiy viloyati',
    nameRu: 'Навоийская область',
    districts: [
      { name: 'navoi_city', nameUz: 'Navoiy shahri', nameRu: 'Город Навои' },
      { name: 'zarafshon', nameUz: 'Zarafshon shahri', nameRu: 'Город Зарафшан' },
      { name: 'g\'ozg\'on', nameUz: 'G\'ozg\'on shahri', nameRu: 'Город Газган' },
      { name: 'qiziltepa', nameUz: 'Qiziltepa tumani', nameRu: 'Кызылтепинский район' },
      { name: 'karmana', nameUz: 'Karmana tumani', nameRu: 'Карманинский район' },
      { name: 'konimex', nameUz: 'Konimex tumani', nameRu: 'Канимехский район' },
      { name: 'navbahor', nameUz: 'Navbahor tumani', nameRu: 'Навбахорский район' },
      { name: 'nurota', nameUz: 'Nurota tumani', nameRu: 'Нуратинский район' },
      { name: 'tomdi', nameUz: 'Tomdi tumani', nameRu: 'Тамдынский район' },
      { name: 'uchquduq', nameUz: 'Uchquduq tumani', nameRu: 'Учкудукский район' },
      { name: 'xatirchi', nameUz: 'Xatirchi tumani', nameRu: 'Хатырчинский район' },
    ]
  },
  {
    name: 'kashkadarya',
    nameUz: 'Qashqadaryo viloyati',
    nameRu: 'Кашкадарьинская область',
    districts: [
      { name: 'karshi_city', nameUz: 'Qarshi shahri', nameRu: 'Город Карши' },
      { name: 'shahrisabz_city', nameUz: 'Shahrisabz shahri', nameRu: 'Город Шахрисабз' },
      { name: 'chiroqchi', nameUz: 'Chiroqchi tumani', nameRu: 'Чиракчинский район' },
      { name: 'dehqonobod', nameUz: 'Dehqonobod tumani', nameRu: 'Дехканабадский район' },
      { name: 'g\'uzor', nameUz: 'G\'uzor tumani', nameRu: 'Гузарский район' },
      { name: 'kasbi', nameUz: 'Kasbi tumani', nameRu: 'Касбийский район' },
      { name: 'kitob', nameUz: 'Kitob tumani', nameRu: 'Китабский район' },
      { name: 'koson', nameUz: 'Koson tumani', nameRu: 'Касанский район' },
      { name: 'ko\'kdala', nameUz: 'Ko\'kdala tumani', nameRu: 'Кукдалинский район' },
      { name: 'mirishkor', nameUz: 'Mirishkor tumani', nameRu: 'Миришкорский район' },
      { name: 'muborak', nameUz: 'Muborak tumani', nameRu: 'Мубарекский район' },
      { name: 'nishon', nameUz: 'Nishon tumani', nameRu: 'Нишанский район' },
      { name: 'qamashi', nameUz: 'Qamashi tumani', nameRu: 'Камашинский район' },
      { name: 'qarshi', nameUz: 'Qarshi tumani', nameRu: 'Каршинский район' },
      { name: 'shahrisabz', nameUz: 'Shahrisabz tumani', nameRu: 'Шахрисабзский район' },
      { name: 'yakkabog\'', nameUz: 'Yakkabog\' tumani', nameRu: 'Яккабагский район' },
    ]
  },
  {
    name: 'samarkand',
    nameUz: 'Samarqand viloyati',
    nameRu: 'Самаркандская область',
    districts: [
      { name: 'samarkand_city', nameUz: 'Samarqand shahri', nameRu: 'Город Самарканд' },
      { name: 'kattaqo\'rg\'on_city', nameUz: 'Kattaqo\'rg\'on shahri', nameRu: 'Город Каттакурган' },
      { name: 'bulung\'ur', nameUz: 'Bulung\'ur tumani', nameRu: 'Булунгурский район' },
      { name: 'ishtixon', nameUz: 'Ishtixon tumani', nameRu: 'Иштыханский район' },
      { name: 'jomboy', nameUz: 'Jomboy tumani', nameRu: 'Джамбайский район' },
      { name: 'kattaqo\'rg\'on', nameUz: 'Kattaqo\'rg\'on tumani', nameRu: 'Каттакурганский район' },
      { name: 'narpay', nameUz: 'Narpay tumani', nameRu: 'Нарпайский район' },
      { name: 'nurobod', nameUz: 'Nurobod tumani', nameRu: 'Нурабадский район' },
      { name: 'oqdaryo', nameUz: 'Oqdaryo tumani', nameRu: 'Акдарьинский район' },
      { name: 'paxtachi', nameUz: 'Paxtachi tumani', nameRu: 'Пахтачийский район' },
      { name: 'pastdarg\'om', nameUz: 'Pastdarg\'om tumani', nameRu: 'Пастдаргомский район' },
      { name: 'payariq', nameUz: 'Payariq tumani', nameRu: 'Пайарыкский район' },
      { name: 'qo\'shrabot', nameUz: 'Qo\'shrabot tumani', nameRu: 'Кошрабадский район' },
      { name: 'samarqand', nameUz: 'Samarqand tumani', nameRu: 'Самаркандский район' },
      { name: 'toyloq', nameUz: 'Toyloq tumani', nameRu: 'Тайлакский район' },
      { name: 'urgut', nameUz: 'Urgut tumani', nameRu: 'Ургутский район' },
    ]
  },
  {
    name: 'sirdarya',
    nameUz: 'Sirdaryo viloyati',
    nameRu: 'Сырдарьинская область',
    districts: [
      { name: 'guliston_city', nameUz: 'Guliston shahri', nameRu: 'Город Гулистан' },
      { name: 'shirin', nameUz: 'Shirin shahri', nameRu: 'Город Ширин' },
      { name: 'yangiyer', nameUz: 'Yangiyer shahri', nameRu: 'Город Янгиер' },
      { name: 'boyovut', nameUz: 'Boyovut tumani', nameRu: 'Баяутский район' },
      { name: 'guliston', nameUz: 'Guliston tumani', nameRu: 'Гулистанский район' },
      { name: 'mirzaobod', nameUz: 'Mirzaobod tumani', nameRu: 'Мирзаабадский район' },
      { name: 'oqoltin', nameUz: 'Oqoltin tumani', nameRu: 'Акалтынский район' },
      { name: 'sardoba', nameUz: 'Sardoba tumani', nameRu: 'Сардобинский район' },
      { name: 'sayxunobod', nameUz: 'Sayxunobod tumani', nameRu: 'Сайхунабадский район' },
      { name: 'sirdaryo', nameUz: 'Sirdaryo tumani', nameRu: 'Сырдарьинский район' },
      { name: 'xovos', nameUz: 'Xovos tumani', nameRu: 'Хавастский район' },
    ]
  },
  {
    name: 'surkhandarya',
    nameUz: 'Surxondaryo viloyati',
    nameRu: 'Сурхандарьинская область',
    districts: [
      { name: 'termez_city', nameUz: 'Termiz shahri', nameRu: 'Город Термез' },
      { name: 'angor', nameUz: 'Angor tumani', nameRu: 'Ангорский район' },
      { name: 'bandixon', nameUz: 'Bandixon tumani', nameRu: 'Бандиханский район' },
      { name: 'boysun', nameUz: 'Boysun tumani', nameRu: 'Байсунский район' },
      { name: 'denov', nameUz: 'Denov tumani', nameRu: 'Денауский район' },
      { name: 'jarqo\'rg\'on', nameUz: 'Jarqo\'rg\'on tumani', nameRu: 'Джаркурганский район' },
      { name: 'qiziriq', nameUz: 'Qiziriq tumani', nameRu: 'Кизирикский район' },
      { name: 'qo\'mqo\'rg\'on', nameUz: 'Qo\'mqo\'rg\'on tumani', nameRu: 'Кумкурганский район' },
      { name: 'muzrabot', nameUz: 'Muzrabot tumani', nameRu: 'Музрабадский район' },
      { name: 'oltinsoy', nameUz: 'Oltinsoy tumani', nameRu: 'Алтынсайский район' },
      { name: 'sariosiyo', nameUz: 'Sariosiyo tumani', nameRu: 'Сариасийский район' },
      { name: 'sherobod', nameUz: 'Sherobod tumani', nameRu: 'Шерабадский район' },
      { name: 'sho\'rchi', nameUz: 'Sho\'rchi tumani', nameRu: 'Шурчинский район' },
      { name: 'termez', nameUz: 'Termiz tumani', nameRu: 'Термезский район' },
      { name: 'uzun', nameUz: 'Uzun tumani', nameRu: 'Узунский район' },
    ]
  },
  {
    name: 'tashkent',
    nameUz: 'Toshkent viloyati',
    nameRu: 'Ташкентская область',
    districts: [
      { name: 'angren', nameUz: 'Angren shahri', nameRu: 'Город Ангрен' },
      { name: 'olmaliq', nameUz: 'Olmaliq shahri', nameRu: 'Город Алмалык' },
      { name: 'ohangaron_city', nameUz: 'Ohangaron shahri', nameRu: 'Город Ахангаран' },
      { name: 'bekobod_city', nameUz: 'Bekobod shahri', nameRu: 'Город Бекабад' },
      { name: 'nurafshon', nameUz: 'Nurafshon shahri', nameRu: 'Город Нурафшон' },
      { name: 'chirchiq', nameUz: 'Chirchiq shahri', nameRu: 'Город Чирчик' },
      { name: 'yangiyo\'l_city', nameUz: 'Yangiyo\'l shahri', nameRu: 'Город Янгиюль' },
      { name: 'bekobod', nameUz: 'Bekobod tumani', nameRu: 'Бекабадский район' },
      { name: 'bo\'ka', nameUz: 'Bo\'ka tumani', nameRu: 'Букинский район' },
      { name: 'bo\'stonliq', nameUz: 'Bo\'stonliq tumani', nameRu: 'Бостанлыкский район' },
      { name: 'chinoz', nameUz: 'Chinoz tumani', nameRu: 'Чиназский район' },
      { name: 'ohangaron', nameUz: 'Ohangaron tumani', nameRu: 'Ахангаранский район' },
      { name: 'oqqo\'rg\'on', nameUz: 'Oqqo\'rg\'on tumani', nameRu: 'Аккурганский район' },
      { name: 'parkent', nameUz: 'Parkent tumani', nameRu: 'Паркентский район' },
      { name: 'piskent', nameUz: 'Piskent tumani', nameRu: 'Пскентский район' },
      { name: 'qibray', nameUz: 'Qibray tumani', nameRu: 'Кибрайский район' },
      { name: 'quyichirchiq', nameUz: 'Quyichirchiq tumani', nameRu: 'Куйичирчикский район' },
      { name: 'o\'rtachirchiq', nameUz: 'O\'rtachirchiq tumani', nameRu: 'Уртачирчикский район' },
      { name: 'toshkent', nameUz: 'Toshkent tumani', nameRu: 'Ташкентский район' },
      { name: 'yangiyo\'l', nameUz: 'Yangiyo\'l tumani', nameRu: 'Янгиюльский район' },
      { name: 'yuqorichirchiq', nameUz: 'Yuqorichirchiq tumani', nameRu: 'Юкоричирчикский район' },
      { name: 'zangiota', nameUz: 'Zangiota tumani', nameRu: 'Зангиатинский район' },
    ]
  },
  {
    name: 'khorezm',
    nameUz: 'Xorazm viloyati',
    nameRu: 'Хорезмская область',
    districts: [
      { name: 'urgench_city', nameUz: 'Urganch shahri', nameRu: 'Город Ургенч' },
      { name: 'xiva_city', nameUz: 'Xiva shahri', nameRu: 'Город Хива' },
      { name: 'bog\'ot', nameUz: 'Bog\'ot tumani', nameRu: 'Багатский район' },
      { name: 'gurlan', nameUz: 'Gurlan tumani', nameRu: 'Гурленский район' },
      { name: 'xonqa', nameUz: 'Xonqa tumani', nameRu: 'Ханкинский район' },
      { name: 'hazorasp', nameUz: 'Hazorasp tumani', nameRu: 'Хазараспский район' },
      { name: 'qo\'shko\'pir', nameUz: 'Qo\'shko\'pir tumani', nameRu: 'Кушкупырский район' },
      { name: 'shovot', nameUz: 'Shovot tumani', nameRu: 'Шаватский район' },
      { name: 'tuproqqal\'a', nameUz: 'Tuproqqal\'a tumani', nameRu: 'Турпаккалинский район' },
      { name: 'urganch', nameUz: 'Urganch tumani', nameRu: 'Ургенчский район' },
      { name: 'xiva', nameUz: 'Xiva tumani', nameRu: 'Хивинский район' },
      { name: 'yangiariq', nameUz: 'Yangiariq tumani', nameRu: 'Янгиарыкский район' },
      { name: 'yangibozor', nameUz: 'Yangibozor tumani', nameRu: 'Янгибазарский район' },
    ]
  },
];

export function getRegionByName(name: string): Region | undefined {
  return uzbekistanRegions.find(r => r.name === name);
}

export function getDistrictsByRegion(regionName: string): District[] {
  const region = getRegionByName(regionName);
  return region ? region.districts : [];
}

export function getRegionDisplayName(regionName: string, language: 'ru' | 'uz' = 'ru'): string {
  const region = getRegionByName(regionName);
  if (!region) return regionName;
  return language === 'ru' ? region.nameRu : region.nameUz;
}

export function getDistrictDisplayName(districtName: string, language: 'ru' | 'uz' = 'ru'): string {
  // Search district across all regions
  for (const region of uzbekistanRegions) {
    const district = region.districts.find(d => d.name === districtName);
    if (district) {
      return language === 'ru' ? district.nameRu : district.nameUz;
    }
  }
  return districtName;
}

export function getDistrictDisplayNameWithRegion(regionName: string, districtName: string, language: 'ru' | 'uz' = 'ru'): string {
  const region = getRegionByName(regionName);
  if (!region) return districtName;
  const district = region.districts.find(d => d.name === districtName);
  if (!district) return districtName;
  return language === 'ru' ? district.nameRu : district.nameUz;
}
