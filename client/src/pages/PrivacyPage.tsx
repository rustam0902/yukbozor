import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

type Lang = "ru" | "uz";

const content = {
  ru: {
    title: "Политика конфиденциальности",
    subtitle: "Yukbozor.uz",
    lastUpdated: "Дата последнего обновления: 13 марта 2026 г.",
    backHome: "На главную",
    sections: [
      {
        heading: "1. Общие положения",
        text: "Yukbozor.uz — B2B платформа для грузовых перевозок в Узбекистане. Настоящая Политика конфиденциальности описывает, как мы собираем, используем и защищаем ваши персональные данные при использовании нашего мобильного приложения и веб-сайта yukbozor.uz (далее — «Платформа»). Используя Платформу, вы соглашаетесь с условиями настоящей Политики.",
      },
      {
        heading: "2. Какие данные мы собираем",
        list: [
          "Контактные данные: имя, фамилия, номер телефона, адрес электронной почты",
          "Данные компании: наименование организации, ИНН/ПИНФЛ, банковские реквизиты",
          "Данные о заказах: маршруты перевозок, даты погрузки, описание груза, цены",
          "Технические данные: тип устройства, версия операционной системы, IP-адрес, журналы действий",
        ],
      },
      {
        heading: "3. Как мы используем данные",
        list: [
          "Предоставление услуг Платформы: создание заказов, поиск перевозчиков, обработка предложений",
          "Отправка SMS и push-уведомлений об изменениях статуса заказов и предложений",
          "Формирование договоров и финансовых документов (счета-фактуры, товарно-транспортные накладные)",
          "Идентификация и верификация пользователей",
          "Улучшение качества сервиса и анализ использования Платформы",
        ],
      },
      {
        heading: "4. Передача данных третьим лицам",
        text: "Мы можем передавать ваши данные следующим категориям третьих лиц исключительно для оказания услуг Платформы:",
        list: [
          "SMS-провайдер (Play Mobile) — для отправки уведомлений и кодов подтверждения",
          "Электронная цифровая подпись (E-IMZO) — для подписания документов",
          "Система электронного документооборота (Didox.uz) — для формирования счетов-фактур и накладных",
        ],
        footer: "Мы не продаём и не передаём ваши персональные данные третьим лицам в маркетинговых целях.",
      },
      {
        heading: "5. Хранение и защита данных",
        text: "Персональные данные хранятся на защищённых серверах, расположенных в Республике Узбекистан. Мы применяем следующие меры защиты: шифрование данных при передаче (HTTPS/TLS), безопасное хранение паролей с использованием современных алгоритмов хеширования, ограниченный доступ к данным на основе ролей.",
      },
      {
        heading: "6. Ваши права",
        list: [
          "Запросить копию своих персональных данных",
          "Потребовать исправления неточных данных",
          "Потребовать удаления аккаунта и связанных данных",
          "Отказаться от получения SMS-уведомлений в настройках профиля",
        ],
        footer: "Для реализации ваших прав направьте запрос на электронную почту: info@yukbozor.uz",
      },
      {
        heading: "7. Файлы cookie и аналитика",
        text: "Веб-версия Платформы может использовать файлы cookie для обеспечения корректной работы аутентификации и сохранения пользовательских настроек. Мы не используем сторонние рекламные трекеры.",
      },
      {
        heading: "8. Изменения политики конфиденциальности",
        text: "Мы оставляем за собой право вносить изменения в настоящую Политику конфиденциальности. При внесении существенных изменений мы уведомим пользователей через приложение или по электронной почте. Продолжение использования Платформы после внесения изменений означает ваше согласие с обновлённой Политикой.",
      },
      {
        heading: "9. Контактная информация",
        text: "Yukbozor.uz platformasi\nг. Ташкент, Республика Узбекистан\nЭлектронная почта: info@yukbozor.uz\nВеб-сайт: https://yukbozor.uz",
      },
    ],
  },
  uz: {
    title: "Maxfiylik siyosati",
    subtitle: "Yukbozor.uz",
    lastUpdated: "Oxirgi yangilanish sanasi: 2026-yil 13-mart",
    backHome: "Bosh sahifaga",
    sections: [
      {
        heading: "1. Umumiy qoidalar",
        text: "Yukbozor.uz — O'zbekistondagi yuk tashish uchun B2B platforma. Ushbu Maxfiylik siyosati bizning mobil ilovamiz va yukbozor.uz veb-saytimizdan (keyingi o'rinlarda — «Platforma») foydalanishda shaxsiy ma'lumotlaringizni qanday to'plashimiz, ishlatishimiz va himoya qilishimizni tavsiflaydi. Platformadan foydalanish orqali siz ushbu Siyosat shartlariga rozilik bildirasiz.",
      },
      {
        heading: "2. Qanday ma'lumotlarni to'playmiz",
        list: [
          "Aloqa ma'lumotlari: ism, familiya, telefon raqami, elektron pochta manzili",
          "Kompaniya ma'lumotlari: tashkilot nomi, INN/PINFL, bank rekvizitlari",
          "Buyurtma ma'lumotlari: tashish yo'nalishlari, yuklash sanalari, yuk tavsifi, narxlar",
          "Texnik ma'lumotlar: qurilma turi, operatsion tizim versiyasi, IP-manzil, faoliyat jurnallari",
        ],
      },
      {
        heading: "3. Ma'lumotlardan qanday foydalanamiz",
        list: [
          "Platforma xizmatlarini ko'rsatish: buyurtmalar yaratish, tashuvchilarni qidirish, takliflarni qayta ishlash",
          "Buyurtma va takliflar holatidagi o'zgarishlar haqida SMS va push-bildirishnomalar yuborish",
          "Shartnomalar va moliyaviy hujjatlar (hisob-fakturalar, yuk-transport hujjatlari) shakllantirish",
          "Foydalanuvchilarni identifikatsiya qilish va tekshirish",
          "Xizmat sifatini yaxshilash va Platformadan foydalanishni tahlil qilish",
        ],
      },
      {
        heading: "4. Ma'lumotlarni uchinchi shaxslarga uzatish",
        text: "Biz ma'lumotlaringizni faqat Platforma xizmatlarini ko'rsatish maqsadida quyidagi uchinchi shaxslarga uzatishimiz mumkin:",
        list: [
          "SMS-provayder (Play Mobile) — bildirishnomalar va tasdiqlash kodlarini yuborish uchun",
          "Elektron raqamli imzo (E-IMZO) — hujjatlarni imzolash uchun",
          "Elektron hujjat aylanmasi tizimi (Didox.uz) — hisob-fakturalar va yuk xatlarini shakllantirish uchun",
        ],
        footer: "Biz shaxsiy ma'lumotlaringizni marketing maqsadlarida uchinchi shaxslarga sotmaymiz va bermaymiz.",
      },
      {
        heading: "5. Ma'lumotlarni saqlash va himoya qilish",
        text: "Shaxsiy ma'lumotlar O'zbekiston Respublikasida joylashgan himoyalangan serverlarda saqlanadi. Biz quyidagi himoya choralarini qo'llaymiz: ma'lumotlarni uzatishda shifrlash (HTTPS/TLS), zamonaviy xesh algoritmlari yordamida parollarni xavfsiz saqlash, rollarga asoslangan ma'lumotlarga cheklangan kirish.",
      },
      {
        heading: "6. Sizning huquqlaringiz",
        list: [
          "Shaxsiy ma'lumotlaringiz nusxasini so'rash",
          "Noto'g'ri ma'lumotlarni tuzatishni talab qilish",
          "Hisob qaydnomasi va bog'liq ma'lumotlarni o'chirishni talab qilish",
          "Profil sozlamalarida SMS-bildirishnomalardan voz kechish",
        ],
        footer: "Huquqlaringizni amalga oshirish uchun so'rovni elektron pochtaga yuboring: info@yukbozor.uz",
      },
      {
        heading: "7. Cookie fayllari va tahlillar",
        text: "Platformaning veb-versiyasi autentifikatsiyaning to'g'ri ishlashini ta'minlash va foydalanuvchi sozlamalarini saqlash uchun cookie fayllaridan foydalanishi mumkin. Biz uchinchi tomon reklama trekkerlaridan foydalanmaymiz.",
      },
      {
        heading: "8. Maxfiylik siyosatiga o'zgartirishlar",
        text: "Biz ushbu Maxfiylik siyosatiga o'zgartirishlar kiritish huquqini o'zimizda saqlaymiz. Muhim o'zgartirishlar kiritilganda, foydalanuvchilarni ilova orqali yoki elektron pochta orqali xabardor qilamiz. O'zgartirishlar kiritilgandan keyin Platformadan foydalanishni davom ettirish yangilangan Siyosatga roziligingizni bildiradi.",
      },
      {
        heading: "9. Aloqa ma'lumotlari",
        text: "Yukbozor.uz platformasi\nToshkent shahri, O'zbekiston Respublikasi\nElektron pochta: info@yukbozor.uz\nVeb-sayt: https://yukbozor.uz",
      },
    ],
  },
};

export default function PrivacyPage() {
  const [lang, setLang] = useState<Lang>("ru");
  const t = content[lang];

  return (
    <>
      <Helmet>
        <title>{t.title} | Yukbozor.uz</title>
        <meta name="description" content={t.title + " - " + t.subtitle} />
      </Helmet>

      <div className="min-h-screen bg-background" data-testid="privacy-page">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-6">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-back-home">
                <ArrowLeft className="w-4 h-4 mr-1" />
                {t.backHome}
              </Button>
            </Link>
            <div className="flex gap-1">
              <Button
                variant={lang === "ru" ? "default" : "outline"}
                size="sm"
                onClick={() => setLang("ru")}
                data-testid="button-lang-ru"
              >
                Русский
              </Button>
              <Button
                variant={lang === "uz" ? "default" : "outline"}
                size="sm"
                onClick={() => setLang("uz")}
                data-testid="button-lang-uz"
              >
                O'zbek
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-6 sm:p-8">
              <h1 className="text-2xl font-bold text-foreground mb-1" data-testid="text-privacy-title">
                {t.title}
              </h1>
              <p className="text-lg text-muted-foreground mb-1">{t.subtitle}</p>
              <p className="text-sm text-muted-foreground mb-8">{t.lastUpdated}</p>

              <div className="space-y-6">
                {t.sections.map((section, idx) => (
                  <div key={idx}>
                    <h2 className="text-lg font-semibold text-foreground mb-2">
                      {section.heading}
                    </h2>
                    {section.text && (
                      <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                        {section.text}
                      </p>
                    )}
                    {section.list && (
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-1">
                        {section.list.map((item, i) => (
                          <li key={i} className="leading-relaxed">{item}</li>
                        ))}
                      </ul>
                    )}
                    {section.footer && (
                      <p className="text-muted-foreground mt-2 leading-relaxed">
                        {section.footer}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-6">
            &copy; {new Date().getFullYear()} Yukbozor.uz
          </p>
        </div>
      </div>
    </>
  );
}
