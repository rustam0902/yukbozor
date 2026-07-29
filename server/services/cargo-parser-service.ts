import OpenAI from 'openai';
import { uzbekistanRegions } from '@shared/uzbekistan-regions';

type OpenAICompletionUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  prompt_tokens_details?: { cached_tokens?: number };
};

const TRANSPORT_TYPES = [
  'labo', 'bongo', 'furgon', 'isuzu5', 'isuzu10', 'gruzovik',
  'fura_tent', 'fura_ref', 'paravoz', 'shalanda', 'traller', 'tonar',
  'benzovoz', 'konteynerovoz', 'other',
] as const;

// Easy to update when the rate changes
const USD_TO_UZS_RATE = 12800;

export type ParsedCargo = {
  title: string;
  originRegions: string[];
  originDistricts: string[];
  destinationRegions: string[];
  destinationDistricts: string[];
  transportType: typeof TRANSPORT_TYPES[number];
  vehicleCount: number;   // "3 та" = 3 vehicles; default 1
  weightTons: number;
  price: number;
  contactPhone: string;
  loadDate: string;       // ISO yyyy-mm-dd
  loadingTime: string;    // free text e.g. "10:00"
  notes: string | null;
};

// Session-level counters for cost monitoring
let prefilterSkippedCount = 0;
let sentToOpenAICount = 0;

let openaiClient: OpenAI | null = null;
let activeProvider = 'unknown';

function getClient(): OpenAI | null {
  if (openaiClient) return openaiClient;
  // Priority 1: DeepSeek
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    activeProvider = 'DeepSeek';
    openaiClient = new OpenAI({
      apiKey: deepseekKey,
      baseURL: 'https://api.deepseek.com/v1',
    });
    console.log('[CargoParser] Provider: DeepSeek (deepseek-v4-flash)');
    return openaiClient;
  }
  // Priority 2: Replit AI Integrations proxy (skip dummy placeholder)
  const aiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const aiBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (aiKey && aiBase && !aiKey.includes('DUMMY')) {
    activeProvider = 'Replit-AI';
    openaiClient = new OpenAI({ apiKey: aiKey, baseURL: aiBase });
    console.log('[CargoParser] Provider: Replit AI Integrations');
    return openaiClient;
  }
  // Priority 3: Direct OpenAI key
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  activeProvider = 'OpenAI';
  openaiClient = new OpenAI({ apiKey: key });
  console.log('[CargoParser] Provider: OpenAI (direct)');
  return openaiClient;
}

export function isAiParserConfigured(): boolean {
  return !!(
    process.env.DEEPSEEK_API_KEY ||
    (process.env.AI_INTEGRATIONS_OPENAI_API_KEY &&
      !process.env.AI_INTEGRATIONS_OPENAI_API_KEY.includes('DUMMY') &&
      process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) ||
    process.env.OPENAI_API_KEY
  );
}

// Build a region list for the system prompt with aliases for commonly confused names.
function buildRegionList(): string {
  const aliases: Record<string, string> = {
    tashkent_city: 'Toshkent shahri / Ташкент (город). Псевдонимы: "Toshkent", "Ташкент", "Toshkent sh."',
    tashkent:      'Toshkent viloyati / Ташкентская область. Псевдонимы: "Toshkent viloyati", "Toshkent o\'lkasi", а также города: Chirchiq, Angren, Bekobod, Olmaliq, Yangiyo\'l, Nurafshon, Gazalkent, Газалкент, Zangiota, Kibray, Parkent, Pskent, Bo\'ka, Ohangaron, Tuytеpa, Tuitepa, Tuytepa, Туйтепа',
    karakalpakstan:'Qoraqalpog\'iston / Каракалпакстан. Псевдонимы: "QQR", "KK (Karakalpakstan)", а также города: Nukus, To\'rtko\'l, Mang\'it, Mangit, Chimboy, Beruniy, Taxiatosh, Xo\'jayli, Kegeyli, Qo\'ng\'irot, Ellikkala, Taxtako\'pir, Mo\'ynoq, Bozatov',
    andijan:       'Andijon viloyati / Андижанская область. Псевдонимы: "Andijon", "Андижан", "Shahrixon", "Шахрихон", а также города: Asaka, Shahrixon, Шахрихон, Xo\'jaobod, Paxtaobod, Marhamat, Qo\'rg\'ontepa. ВАЖНО: Shahrixon ≠ Shahrisabz — это разные города в разных областях!',
    bukhara:       'Buxoro viloyati / Бухарская область. Псевдонимы: "Buxoro", "Бухара", а также города: Kogon, G\'ijduvon, Qorovulbozor, Romitan, Vobkent, Peshku, Shofirkon, Olot',
    fergana:       'Farg\'ona viloyati / Ферганская область. Псевдонимы: "Farg\'ona", "Fergana", "Фергана", "Qo\'qon", "Kokand", "Кокон", "Кукон", "Marg\'ilon", "Маргилан", а также города: Rishton, Beshariq, Quvasoy, O\'zbekiston, Buvayda, Oltiariq, So\'x',
    jizzakh:       'Jizzax viloyati / Джизакская область. Псевдонимы: "Jizzax", "Джизак", "Жиззах", а также города: Zafarobod, Zomin, Paxtakor, G\'allaorol, Forish, Arnasoy',
    namangan:      'Namangan viloyati / Наманганская область. Псевдонимы: "Namangan", "Наманган", а также города: Chortoq, Chust, Kosonsoy, Pop, To\'raqo\'rg\'on, Yangiqo\'rg\'on, Uychi',
    navoi:         'Navoiy viloyati / Навоийская область. Псевдонимы: "Navoiy", "Навои", "Navoiy shahri", а также города: Zarafshon, Karmana, Nurota, Uchquduq',
    kashkadarya:   'Qashqadaryo viloyati / Кашкадарьинская область. Псевдонимы: "Qashqadaryo", "Qarshi", "Карши", "Shahrisabz", "Шахрисабз", а также города: G\'uzor, Muborak, Kitob, Koson, Chiroqchi, Nishon, Qasamboy',
    samarkand:     'Samarqand viloyati / Самаркандская область. Псевдонимы: "Samarqand", "Samarkand", "Самарканд", а также города: Kattaqo\'rg\'on, Bulung\'ur, Payariq, Ishtixon, Jomboy, Pastdarg\'om, Paxtachi',
    sirdarya:      'Sirdaryo viloyati / Сырдарьинская область. Псевдонимы: "Sirdaryo", "Guliston"',
    surkhandarya:  'Surxondaryo viloyati / Сурхандарьинская область. Псевдонимы: "Surxondaryo", "Termiz", "Термез", "Термиз", "Denov", "Денов", а также города: Sho\'rchi, Boysun, Uzun, Sherobod, Jarqo\'rg\'on, Angor, Kumqo\'rg\'on',
    khorezm:       'Xorazm viloyati / Хорезмская область. Псевдонимы: "Xorazm", "Urgench", "Urganch", "Ургенч", "Xiva", а также города: Ko\'hna Urgench, Ko\'hna Urganch, Gurlan, Pitnak, Bog\'ot, Shovot, Xonqa, Hazorasp',
  };
  return uzbekistanRegions
    .map(r => aliases[r.name] ? `${r.name}: ${aliases[r.name]}` : `${r.name}: ${r.nameRu} / ${r.nameUz}`)
    .join('\n');
}

const SYSTEM_PROMPT = `Ты парсер объявлений о ГРУЗОПЕРЕВОЗКАХ из Telegram-каналов Узбекистана.
Задача: извлечь структурированные данные, если сообщение — объявление о ГРУЗЕ (владелец груза ищет транспорт).

═══ ЧТО ПРИНИМАТЬ / НЕ ПРИНИМАТЬ ═══

ПРИНИМАТЬ (is_cargo_post=true): объявления где есть ГРУЗ и ищется транспорт/водитель:
  "yuk bor" (есть груз), "yuk jo'nataman" (отправляю груз), "yuk kerak tashish" (нужно перевезти груз)

НЕ ПРИНИМАТЬ (is_cargo_post=false):
- Есть МАШИНА/ВОДИТЕЛЬ, ищут груз:
  "yuk olamiz" / "yuk olaman" / "yuk olinadi" (берём груз = есть машина)
  "mashina bor" / "фура бор" / "Isuzu bor" / "shalanda bor" / "tentofka bor"
  "haydovchi bor" / "shofyor bor" / "водитель ищет груз" / "есть машина"
  → reason_skip="not_cargo"
- Реклама, продажа соляры, запчастей, услуг → reason_skip="not_cargo"
- Нет чёткого маршрута → reason_skip="no_route"
- Нет телефона → reason_skip="no_phone"
- Международный маршрут (Россия, Казахстан, Китай, Таджикистан, Туркменистан и т.п.)
  → reason_skip="international"
- Цена ТОЛЬКО в долларах ($) → высокая вероятность международного рейса.
  Если оба пункта маршрута явно находятся в Узбекистане — допустимо принять.
  Если хоть один пункт сомнителен — reason_skip="international"
- Сообщение непонятное / слишком короткое → reason_skip="insufficient_data"

═══ ОДИН ГРУЗ ИЛИ НЕСКОЛЬКО? ═══

ОДИН ГРУЗ (items содержит РОВНО 1 элемент) — самый распространённый случай.
Многие объявления написаны в несколько строк, но описывают ОДИН груз.
ПРАВИЛО: если в сообщении всего ОДИН маршрут (одна точка отправления + одна точка назначения)
— это всегда ОДИН груз, сколько бы строк ни было.

НЕСКОЛЬКО ГРУЗОВ (items содержит > 1 элемента) — только если в сообщении явно
указаны НЕСКОЛЬКО РАЗНЫХ маршрутов:
  Формат 1 (табличный): каждая строка содержит полный маршрут A→B.
  Формат 2 (блочный): несколько блоков, разделённых пустой строкой,
    каждый блок содержит свою пару откуда–куда.
  Формат 3 (маршруты + общие детали): сначала список маршрутов (по одному на строку),
    затем ОБЩИЕ детали (вес, тип авто, телефон) для ВСЕХ маршрутов:
      "Toshkent Samarqand\nToshkent Buxoro\nToshkent Navoiy\n12 Tonnadan Yuk Bor\n3 Ta Ref Fura\n+998901234567"
    → 3 отдельных груза, у каждого origin=tashkent_city, weight=12, transport=fura_ref, vehicleCount=1.
    "N Ta" при N маршрутах = 1 машина на каждый маршрут (не N машин на каждый!)

ЗАПРЕЩЕНО дробить одно объявление на несколько только потому, что:
- origin написан на одной строке, а destination — на другой
- описание груза вынесено в отдельную строку
- телефон стоит последней строкой

Если поля одинаковые для нескольких грузов (телефон, тип транспорта, дата) — дублируй в каждый элемент.

КОЛИЧЕСТВО МАШИН (vehicle_count):
  "X та" / "X ta" / "X штук" = X машин → vehicle_count: X
  Если не указано → vehicle_count: 1

═══ УЗБЕКСКИЕ СУФФИКСЫ НАПРАВЛЕНИЙ ═══
Суффикс "-dan" = ОТКУДА (origin). Суффиксы "-ga" / "-ka" = КУДА (destination).
  "Buxorodan Toshkentga" → origin=bukhara, destination=tashkent_city
  "To'rtko'ldan Buxoro Shofirkonga" → origin=karakalpakstan, destination=bukhara

ИСКЛЮЧЕНИЯ (суффикс "-dan" НЕ является направлением):
  "X tonnadan" / "X tonnalik" → это ВЕС груза, НЕ пункт отправления. Пример:
    "12 tonnadan yuk bor" = груз весом 12 тонн (weight_tons=12), НЕ "откуда: 12 тонна"
  "X kmdan" / "X dollardan" / числа с суффиксом → единицы измерения, не маршрут.

═══ КРИТИЧЕСКИЕ ПРАВИЛА ПО РЕГИОНАМ ═══
1. "Toshkent" / "Ташкент" (одно слово, без уточнений) → ВСЕГДА tashkent_city
   "Toshkent shahri" / "Toshkent sh." → tashkent_city
   "Toshkent viloyati" / "Toshkent tumani" / "Ташкентская область" → tashkent
   Города Ташкентской области (→ tashkent, НЕ tashkent_city!):
     Chirchiq, Angren, Bekobod, Olmaliq, Yangiyo'l, Nurafshon, Gazalkent,
     Zangiota, Kibray, Parkent, Pskent, Bo'ka, Ohangaron,
     Tuytepa / Tuytеpa / Туйтепа → tashkent (Ташкентская область, НЕ город!)
2. "To'rtko'l" / "Tortko'l" / "Турткуль" → karakalpakstan (НЕ tashkent!)
3. "Mang'it" / "Mangit" / "Манғит" → karakalpakstan
4. "Chimboy" / "Чимбай" → karakalpakstan
5. "Nukus" / "Нукус" → karakalpakstan
6. "Amudaryo" (как топоним) → karakalpakstan
7. "Termiz" / "Термиз" / "Термез" → surkhandarya
8. "Denov" / "Денов" → surkhandarya
9. "Qarshi" / "Карши" / "Shahrisabz" / "Шахрисабз" → kashkadarya
10. "Shahrixon" / "Шахрихон" → andijan (НЕ kashkadarya! Shahrixon ≠ Shahrisabz — полностью разные города)
11. "Qo'qon" / "Kokand" / "Кукон" / "Кокон" / "Marg'ilon" → fergana
12. "Urgench" / "Urganch" / "Ургенч" → khorezm

═══ ПРАВИЛА ДЛЯ ЦЕН ═══
Точка и запятая в числах — разделители тысяч (европейский формат), НЕ дробная часть:
  "5.000 mln" = 5 000 × 1 000 = 5 000 000 сум
  "1.500.000" = 1 500 000 сум
  "5,000,000" = 5 000 000 сум

Единицы:
  "X mln" / "X million" / "X млн" = X × 1 000 000 сум
  "X ming" / "X min" / "X тысяч" = X × 1 000 сум
  "$X" / "X dollar" = X × ${USD_TO_UZS_RATE} сум (но если цена только в $, см. правило про международное)
  Число без единицы → считать суммы (сум)
  "kelishiladi" / "договорная" / не указана → price=0

═══ TRANSPORT TYPE ═══
  "фура" / "tentli" / "tent" / "TENT" / "тент" → fura_tent
  "рефка" / "ref" / "REF" / "muzlatgich" → fura_ref
  "шаланда" / "shalanda" / "SHALANDA" → shalanda
  "ISUZU" / "isuze" / "Исузу":
    + вес < 8 тонн → isuzu5
    + вес ≥ 8 тонн → isuzu10
  "исузу 5" / "isuzu 5t" → isuzu5; "исузу 10" / "isuzu 10t" → isuzu10
  "самосвал" / "samasval" / "сам" → gruzovik
  "чакман" / "chakman" / "грузовик" → gruzovik
  "фургон" / "furgon" → furgon; "лабо" / "labo" → labo; "bongo" → bongo
  "паровоз" / "paravoz" → paravoz; "трейлер" / "traller" → traller; "тонар" / "tonar" → tonar
  Не указан или непонятен → other
  Примечание: "KK" в контексте транспорта может означать "katta kuzov" — используй fura_tent или other

═══ СПИСОК РЕГИОНОВ ═══
${buildRegionList()}

═══ ПРАВИЛА ГЕНЕРАЦИИ ЗАГОЛОВКА (title) ═══
Заголовок ВСЕГДА на узбекском языке. Никаких русских слов.
Формат: "{ГородОткуда}dan {ГородКуда}ga {yuk_turi}[, N tonna]"
Используй origin_district и destination_district (конкретный город/район), НЕ название региона.

Примеры корректных заголовков:
  "Toshkentdan Samarqandga g'isht, 20 tonna"
  "Andijondan Namanganga don, 25 tonna"
  "Termizdan Toshkentga metall, 2 ta shalanda"

Перевод названий грузов с русского на узбекский:
  гипс → gips | кирпич/кирпечи → g'isht | металл → metall | мука → un
  зерно/пшеница/дон → don | цемент → sement | песок → qum | щебень → shag'al
  уголь → ko'mir | хлопок → paxta | овощи/фрукты → meva-sabzavot
  стройматериалы → qurilish materiallari | мебель → mebel | соль → tuz
  картофель → kartoshka | лук → piyoz | арматура → armatura | трубы → quvur
  стекло → shisha | мрамор → marmar | краска → bo'yoq | масло → yog'
  молоко/молочные → sut mahsulotlari | пластик/полиэтилен → plastik
  бетон → beton | уголок/профиль/швеллер → metall | кабель → kabel

Если тип груза неизвестен → "yuk"
Если несколько машин → добавь в конец: ", N ta {transport_type}"
  Пример: "Toshkentdan Buxoroga g'isht, 2 ta shalanda"

═══ ФОРМАТ ОТВЕТА ═══
Возвращай ТОЛЬКО JSON-объект:
{
  "is_cargo_post": boolean,
  "reason_skip": string,
  "items": [
    {
      "title": string,
      "origin_region": string,
      "origin_district": string,
      "destination_region": string,
      "destination_district": string,
      "transport_type": string,
      "vehicle_count": number,
      "weight_tons": number,
      "price": number,
      "contact_phone": string,
      "load_date": string,
      "loading_time": string,
      "notes": string
    }
  ]
}
Если is_cargo_post=false — items должен быть пустым массивом [].
Если is_cargo_post=true — items содержит ОДИН или НЕСКОЛЬКО грузов.
Не добавляй пояснений вне JSON.`;

// Few-shot examples covering key cases.
// All use the new { is_cargo_post, reason_skip, items: [...] } format.
const FEW_SHOT_EXAMPLES: Array<{ user: string; assistant: string }> = [
  {
    // Case: Shahrixon → andijan (NOT kashkadarya, NOT Shahrisabz confusion)
    user: `Сегодня: 2026-04-26. Завтра: 2026-04-27.

Текст:
Shahrixondan Toshkentga yuk bor
G'isht 20 tonna
Fura kerak
+998901234567`,
    assistant: JSON.stringify({
      is_cargo_post: true,
      reason_skip: '',
      items: [{
        title: "Shahrixondan Toshkentga g'isht, 20 tonna",
        origin_region: 'andijan',
        origin_district: 'Shahrixon',
        destination_region: 'tashkent_city',
        destination_district: 'Toshkent',
        transport_type: 'fura_tent',
        vehicle_count: 1,
        weight_tons: 20,
        price: 0,
        contact_phone: '+998901234567',
        load_date: '2026-04-26',
        loading_time: 'kun davomida',
        notes: '',
      }],
    }),
  },
  {
    // Case: Mang'it → karakalpakstan (not navoi); ISUZU + 16 tonnes → isuzu10
    user: `Сегодня: 2026-04-26. Завтра: 2026-04-27.

Текст:
YUK BOR SROCHNA
BUXORO Qora ko'ldan
AMUDARYO Mang'itga
UN BOR 16 TONNA
ISUZI KERAK
📞 77 009 65 53`,
    assistant: JSON.stringify({
      is_cargo_post: true,
      reason_skip: '',
      items: [{
        title: "Buxorodan Mang'itga un yuki, 16 tonna",
        origin_region: 'bukhara',
        origin_district: "Qora ko'l",
        destination_region: 'karakalpakstan',
        destination_district: "Mang'it",
        transport_type: 'isuzu10',
        vehicle_count: 1,
        weight_tons: 16,
        price: 0,
        contact_phone: '+998770096553',
        load_date: '2026-04-26',
        loading_time: 'kun davomida',
        notes: '',
      }],
    }),
  },
  {
    // Case: Uzbek suffixes (-dan=origin, -ga=destination) + "Toshkent" (no viloyati) → tashkent_city
    // Also covers price "5.000 mln" = 5,000,000 UZS (dot as thousands separator, NOT 5000 USD)
    user: `Сегодня: 2026-04-26. Завтра: 2026-04-27.

Текст:
Andijondan Toshkentga yuk bor
Qurilish materiallari 8 tonna
Isuzu kerak
Narxi 5.000 mln
+998905034422`,
    assistant: JSON.stringify({
      is_cargo_post: true,
      reason_skip: '',
      items: [{
        title: "Andijondan Toshkentga qurilish materiallari, 8 tonna",
        origin_region: 'andijan',
        origin_district: 'Andijon',
        destination_region: 'tashkent_city',
        destination_district: 'Toshkent',
        transport_type: 'isuzu10',
        vehicle_count: 1,
        weight_tons: 8,
        price: 5000000,
        contact_phone: '+998905034422',
        load_date: '2026-04-26',
        loading_time: 'kun davomida',
        notes: '',
      }],
    }),
  },
  {
    // Case: SINGLE cargo written as multi-line (origin on line 1, destination on line 2).
    // MUST produce exactly 1 item — not 2. Each line is part of ONE cargo description.
    // "ЮК.БОР" = "yuk bor" (cargo available). "25.Т" = 25 tons. "ТЕНТ ФУРАГА" = tent fura needed.
    user: `Сегодня: 2026-04-26. Завтра: 2026-04-27.

Текст:
ТОШКЕНТДАН
САМАРКАНДГА
ЮК.БОР 25.Т
ТЕНТ ФУРАГА
901090494`,
    assistant: JSON.stringify({
      is_cargo_post: true,
      reason_skip: '',
      items: [{
        title: "Toshkentdan Samarqandga yuk, 25 tonna",
        origin_region: 'tashkent_city',
        origin_district: 'Toshkent',
        destination_region: 'samarkand',
        destination_district: 'Samarqand',
        transport_type: 'fura_tent',
        vehicle_count: 1,
        weight_tons: 25,
        price: 0,
        contact_phone: '+998901090494',
        load_date: '2026-04-26',
        loading_time: 'kun davomida',
        notes: '',
      }],
    }),
  },
  {
    // Case: Format 3 — routes listed first, then SHARED details (weight/transport/phone)
    // "3 Ta" with 3 routes = 1 vehicle per route (not 3 each)
    // "12 Tonnadan" = weight 12 tonnes (NOT an origin — "-dan" on units is NOT a direction)
    user: `Сегодня: 2026-04-26. Завтра: 2026-04-27.

Текст:
Toshkent Samarqand

Toshkent Buxoro

Toshkent Navoiy

12 Tonnadan Yuk Bor

3 Ta Ref Fura Kere

+998979987170`,
    assistant: JSON.stringify({
      is_cargo_post: true,
      reason_skip: '',
      items: [
        {
          title: "Toshkentdan Samarqandga yuk, 12 tonna",
          origin_region: 'tashkent_city',
          origin_district: 'Toshkent',
          destination_region: 'samarkand',
          destination_district: 'Samarqand',
          transport_type: 'fura_ref',
          vehicle_count: 1,
          weight_tons: 12,
          price: 0,
          contact_phone: '+998979987170',
          load_date: '2026-04-26',
          loading_time: 'kun davomida',
          notes: '',
        },
        {
          title: "Toshkentdan Buxoroga yuk, 12 tonna",
          origin_region: 'tashkent_city',
          origin_district: 'Toshkent',
          destination_region: 'bukhara',
          destination_district: 'Buxoro',
          transport_type: 'fura_ref',
          vehicle_count: 1,
          weight_tons: 12,
          price: 0,
          contact_phone: '+998979987170',
          load_date: '2026-04-26',
          loading_time: 'kun davomida',
          notes: '',
        },
        {
          title: "Toshkentdan Navoiyga yuk, 12 tonna",
          origin_region: 'tashkent_city',
          origin_district: 'Toshkent',
          destination_region: 'navoi',
          destination_district: 'Navoiy',
          transport_type: 'fura_ref',
          vehicle_count: 1,
          weight_tons: 12,
          price: 0,
          contact_phone: '+998979987170',
          load_date: '2026-04-26',
          loading_time: 'kun davomida',
          notes: '',
        },
      ],
    }),
  },
  {
    // Case: MULTI-CARGO — 3 separate blocks with shared phone, different routes/cargo
    // Demonstrates: block format, vehicle_count from "2 TA", karakalpakstan for Chimboy
    user: `Сегодня: 2026-04-26. Завтра: 2026-04-27.

Текст:
Buxoro CHIMBOY
25 TONNA GIPS
TENT FURA KK
908981849

SAMARQAND QARSHI
2 TA FURA SHALANDA KK
GISHT ORTILADI
908981849

NAVOYI QARSHI
25 TONNA MRAMR
TENT FURA KK
908981849`,
    assistant: JSON.stringify({
      is_cargo_post: true,
      reason_skip: '',
      items: [
        {
          title: "Buxorodan Chimboy (QQR)ga gips, 25 tonna",
          origin_region: 'bukhara',
          origin_district: 'Buxoro',
          destination_region: 'karakalpakstan',
          destination_district: 'Chimboy',
          transport_type: 'fura_tent',
          vehicle_count: 1,
          weight_tons: 25,
          price: 0,
          contact_phone: '+998908981849',
          load_date: '2026-04-26',
          loading_time: 'kun davomida',
          notes: '',
        },
        {
          title: "Samarqanddan Qarshiga g'isht, 2 shalanda",
          origin_region: 'samarkand',
          origin_district: 'Samarqand',
          destination_region: 'kashkadarya',
          destination_district: 'Qarshi',
          transport_type: 'shalanda',
          vehicle_count: 2,
          weight_tons: 0,
          price: 0,
          contact_phone: '+998908981849',
          load_date: '2026-04-26',
          loading_time: 'kun davomida',
          notes: '',
        },
        {
          title: "Navoiydan Qarshiga marmar, 25 tonna",
          origin_region: 'navoi',
          origin_district: 'Navoiy',
          destination_region: 'kashkadarya',
          destination_district: 'Qarshi',
          transport_type: 'fura_tent',
          vehicle_count: 1,
          weight_tons: 25,
          price: 0,
          contact_phone: '+998908981849',
          load_date: '2026-04-26',
          loading_time: 'kun davomida',
          notes: '',
        },
      ],
    }),
  },
];

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function normalizePhoneUz(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('998')) return '+' + digits.slice(0, 12);
  if (digits.length === 9) return '+998' + digits;
  if (digits.length === 12 && digits.startsWith('998')) return '+' + digits;
  return null;
}

export type ParseCargoResult =
  | { ok: true; data: ParsedCargo }
  | { ok: false; reason: 'not_cargo' | 'no_route' | 'no_phone' | 'international' | 'insufficient_data' | 'missing_fields' };

type RawItem = {
  title?: string;
  origin_region?: string;
  destination_region?: string;
  origin_district?: string;
  destination_district?: string;
  transport_type?: string;
  vehicle_count?: number;
  weight_tons?: number;
  price?: number;
  load_date?: string;
  loading_time?: string;
  contact_phone?: string;
  notes?: string | null;
};

/**
 * Parse a free-text Telegram cargo post into one or more structured ParsedCargo items.
 * Returns:
 *  - null when OpenAI is not configured or the API call throws
 *  - Array where each element is either ok (valid cargo) or not_ok (skip reason).
 *    A "not a cargo post" message returns [{ok:false, reason:'not_cargo'}].
 *    A multi-cargo message may return multiple ok:true items.
 */
/**
 * Pre-filter: returns a reason string if the message can be confidently
 * skipped WITHOUT calling OpenAI, or null if OpenAI should process it.
 */
function shouldSkipWithoutAI(text: string): string | null {
  // Too short to be meaningful
  if (text.length < 15) return 'insufficient_data';

  // Must contain a phone number. Uses Uzbek-specific patterns so that pure price
  // numbers (e.g. 5000000, 1500000) are never mistaken for phone numbers:
  //   • International: +998 or 998 followed by 9 digits (separators allowed between groups)
  //   • Local 9-digit: starts with a known Uzbek mobile prefix (9x / 7x) — prices
  //     never start with these digits in isolation (prices start with 1-5 or are larger)
  //   • Spaced local: "90 123 45 67" or "77-009-65-53" style
  const stripped = text.replace(/[\s\-.()+]/g, '');
  const hasPhone =
    /^.*(998\d{9}).*$/.test(stripped) ||
    /(?<!\d)(9[013-9]|77|78|71)\d{7}(?!\d)/.test(stripped) ||
    /(?<!\d)(9[013-9]|77|78|71)[\s\-]\d{3}[\s\-]\d{2}[\s\-]\d{2}(?!\d)/.test(text);
  if (!hasPhone) return 'no_phone';

  const lower = text.toLowerCase();

  // "Has a vehicle, looking for cargo" — not a cargo post
  const notCargoMarkers = [
    'mashina bor', 'машина бор', 'mashina bor',
    'yuk olamiz', 'yuk olaman', 'yuk olinadi', 'yuk olamiz',
    'грузовик бор', 'фура бор', 'tentofka bor', 'tent bor',
    'haydovchi bor', 'shofyor bor', 'водитель ищет', 'водитель есть',
    'есть машина', 'есть фура', 'есть газель',
    'isuzu bor', 'isuz bor', 'shalanda bor',
    'avto bor', 'avtomobil bor',
  ];
  for (const marker of notCargoMarkers) {
    if (lower.includes(marker)) return 'not_cargo';
  }

  // International route markers
  const intlMarkers = [
    'россия', 'russia', 'rossiya', 'российск',
    'казахстан', 'qozog\'iston', 'qozogiston', 'kazakhstan',
    'китай', 'xitoy', 'china',
    'таджикистан', 'tojikiston', 'tajikistan',
    'туркменистан', 'turkmaniston', 'turkmenistan',
    'кыргызстан', 'qirgiziston', 'kyrgyzstan',
    'афганистан', 'afghanistan',
    'иран', 'eron', 'iran',
  ];
  for (const marker of intlMarkers) {
    if (lower.includes(marker)) return 'international';
  }

  return null;
}

export async function parseCargoMessage(text: string): Promise<ParseCargoResult[] | null> {
  const client = getClient();
  if (!client) return null;
  const trimmed = (text || '').trim();
  if (trimmed.length < 10 || trimmed.length > 4000) return [{ ok: false, reason: 'insufficient_data' }];

  // Pre-filter: skip obvious non-cargo messages without calling OpenAI
  const preFilterReason = shouldSkipWithoutAI(trimmed);
  if (preFilterReason) {
    prefilterSkippedCount++;
    console.log(
      `[CargoParser] pre-filter skip: reason=${preFilterReason} text_len=${trimmed.length}` +
      ` | stats: skipped=${prefilterSkippedCount} sent=${sentToOpenAICount}`
    );
    const validReasons = ['not_cargo', 'no_route', 'no_phone', 'international', 'insufficient_data'] as const;
    return [{
      ok: false,
      reason: (validReasons as readonly string[]).includes(preFilterReason)
        ? (preFilterReason as typeof validReasons[number])
        : 'not_cargo',
    }];
  }

  sentToOpenAICount++;
  getClient(); // ensure activeProvider is set
  console.log(
    `[CargoParser] sending to ${activeProvider} text_len=${trimmed.length}` +
    ` | stats: skipped=${prefilterSkippedCount} sent=${sentToOpenAICount}`
  );

  const today = todayISO();
  const tomorrow = tomorrowISO();

  let raw: {
    is_cargo_post?: boolean;
    reason_skip?: string;
    items?: RawItem[];
  };

  try {
    const completion = await client.chat.completions.create({
      model: activeProvider === 'DeepSeek' ? 'deepseek-v4-flash' : (process.env.AI_MODEL_NAME || 'gpt-4o-mini'),
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        // Few-shot examples
        ...FEW_SHOT_EXAMPLES.flatMap(ex => [
          { role: 'user' as const, content: ex.user },
          { role: 'assistant' as const, content: ex.assistant },
        ]),
        // Actual request
        {
          role: 'user',
          content: `Сегодня: ${today}. Завтра: ${tomorrow}.\n\nТекст:\n${trimmed}`,
        },
      ],
    });

    // Log token usage for cost monitoring
    const usage = completion.usage as OpenAICompletionUsage | undefined;
    if (usage) {
      const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
      console.log(
        `[CargoParser] tokens: prompt=${usage.prompt_tokens} cached=${cached} completion=${usage.completion_tokens}`
      );
    }

    const content = completion.choices[0]?.message?.content || '{}';
    raw = JSON.parse(content);
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error('[CargoParser] OpenAI call failed:', msg);
    // Throw so caller can record the actual error detail (not a generic message)
    throw new Error(`CargoParser API error: ${msg}`);
  }

  // Top-level skip
  if (!raw || raw.is_cargo_post !== true) {
    const reason = (raw?.reason_skip as string) || 'not_cargo';
    const validReasons = ['not_cargo', 'no_route', 'no_phone', 'international', 'insufficient_data'] as const;
    return [{
      ok: false,
      reason: (validReasons as readonly string[]).includes(reason)
        ? (reason as typeof validReasons[number])
        : 'not_cargo',
    }];
  }

  const items = Array.isArray(raw.items) ? raw.items : [];
  if (items.length === 0) {
    return [{ ok: false, reason: 'insufficient_data' }];
  }

  const validRegion = (code: string | null | undefined): string | null => {
    if (!code) return null;
    return uzbekistanRegions.find(r => r.name === code) ? code : null;
  };

  type TransportType = typeof TRANSPORT_TYPES[number];

  // Validate and normalise each item independently
  const results: ParseCargoResult[] = items.map((item): ParseCargoResult => {
    const originRegion = validRegion(item.origin_region);
    const destinationRegion = validRegion(item.destination_region);
    const phone = normalizePhoneUz(item.contact_phone);

    if (!originRegion || !destinationRegion || !phone) {
      return { ok: false, reason: 'missing_fields' };
    }

    const loadDateRaw = item.load_date;
    if (typeof loadDateRaw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(loadDateRaw)) {
      return { ok: false, reason: 'missing_fields' };
    }

    const rawTransportType = item.transport_type as string | undefined;
    if (!rawTransportType || !(TRANSPORT_TYPES as readonly string[]).includes(rawTransportType)) {
      return { ok: false, reason: 'missing_fields' };
    }
    const transportType = rawTransportType as TransportType;

    const weightTons = Number(item.weight_tons);
    const price = Number(item.price);
    const vehicleCount = Math.max(1, Math.round(Number(item.vehicle_count) || 1));

    return {
      ok: true,
      data: {
        title: String(item.title || 'Груз').slice(0, 100),
        originRegions: [originRegion],
        originDistricts: [String(item.origin_district || originRegion)],
        destinationRegions: [destinationRegion],
        destinationDistricts: [String(item.destination_district || destinationRegion)],
        transportType,
        vehicleCount,
        weightTons: isFinite(weightTons) && weightTons > 0 ? weightTons : 0,
        price: isFinite(price) && price >= 0 ? price : 0,
        contactPhone: phone,
        loadDate: loadDateRaw,
        loadingTime: String(item.loading_time || 'kun davomida').slice(0, 50),
        notes: item.notes ? String(item.notes).slice(0, 500) : null,
      },
    };
  });

  return results;
}
