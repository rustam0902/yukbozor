import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Trash2, Mail, Clock, ShieldCheck } from "lucide-react";

type Lang = "ru" | "uz";

const content = {
  ru: {
    title: "Удаление аккаунта",
    subtitle: "Yukbozor.uz",
    lastUpdated: "Дата обновления: 13 марта 2026 г.",
    backHome: "На главную",
    intro:
      "Вы можете в любой момент запросить удаление своего аккаунта и связанных с ним данных на платформе Yukbozor.uz. Ниже приведена пошаговая инструкция.",
    stepsTitle: "Как запросить удаление аккаунта",
    steps: [
      {
        num: "1",
        title: "Войдите в приложение",
        desc: "Откройте мобильное приложение Yukbozor или перейдите на сайт yukbozor.uz и войдите в свой аккаунт.",
      },
      {
        num: "2",
        title: "Перейдите в Профиль",
        desc: 'Нажмите на иконку «Профиль» в нижнем меню приложения или в боковом меню на сайте.',
      },
      {
        num: "3",
        title: "Найдите раздел «Удаление аккаунта»",
        desc: 'Прокрутите страницу вниз до раздела «Удаление аккаунта» и нажмите кнопку «Удалить аккаунт».',
      },
      {
        num: "4",
        title: "Подтвердите удаление",
        desc: "Подтвердите своё решение в появившемся диалоговом окне. После подтверждения запрос будет передан в обработку.",
      },
      {
        num: "OR",
        title: "Альтернативно — напишите нам",
        desc: "Если у вас нет доступа к аккаунту, отправьте запрос на удаление на электронную почту info@yukbozor.uz с темой «Удаление аккаунта» и укажите номер телефона, привязанный к аккаунту.",
        isAlt: true,
      },
    ],
    dataTitle: "Какие данные будут удалены",
    deleted: [
      "Личные данные: имя, фамилия, номер телефона, email",
      "Данные компании: наименование, ИНН/ПИНФЛ, банковские реквизиты",
      "История входов и сессий",
      "Настройки уведомлений",
      "Черновики заказов и объявлений",
    ],
    retainedTitle: "Какие данные сохраняются",
    retained: [
      "Завершённые заказы и договоры — хранятся 3 года в соответствии с требованиями законодательства Республики Узбекистан о бухгалтерском учёте и налогообложении",
      "Финансовые транзакции и платёжные записи — хранятся 5 лет",
      "Данные, необходимые для урегулирования споров — до завершения разбирательства",
    ],
    timelineTitle: "Сроки обработки",
    timeline:
      "Запрос на удаление аккаунта обрабатывается в течение 30 дней. После удаления вы получите подтверждение на email или SMS.",
    contactTitle: "Контакты",
    contact: "По вопросам удаления данных: info@yukbozor.uz",
  },
  uz: {
    title: "Hisobni o'chirish",
    subtitle: "Yukbozor.uz",
    lastUpdated: "Yangilanish sanasi: 2026-yil 13-mart",
    backHome: "Bosh sahifaga",
    intro:
      "Siz istalgan vaqtda Yukbozor.uz platformasidagi hisobingiz va u bilan bog'liq ma'lumotlarni o'chirishni so'rashingiz mumkin. Quyida bosqichma-bosqich ko'rsatma keltirilgan.",
    stepsTitle: "Hisobni o'chirishni qanday so'rash mumkin",
    steps: [
      {
        num: "1",
        title: "Ilovaga kiring",
        desc: "Yukbozor mobil ilovasini oching yoki yukbozor.uz saytiga o'ting va hisobingizga kiring.",
      },
      {
        num: "2",
        title: "Profilga o'ting",
        desc: "Ilovaning pastki menyusidagi «Profil» belgisini bosing yoki saytdagi yon menyudan foydalaning.",
      },
      {
        num: "3",
        title: "«Hisobni o'chirish» bo'limini toping",
        desc: "Sahifani pastga aylantiring va «Hisobni o'chirish» bo'limini toping, so'ng «Hisobni o'chirish» tugmasini bosing.",
      },
      {
        num: "4",
        title: "O'chirishni tasdiqlang",
        desc: "Paydo bo'lgan muloqot oynasida qaroringizni tasdiqlang. Tasdiqlanganidan so'ng so'rov ishlovga qabul qilinadi.",
      },
      {
        num: "YOKI",
        title: "Muqobil — bizga yozing",
        desc: "Agar hisobingizga kirish imkoningiz bo'lmasa, info@yukbozor.uz elektron pochta manziliga «Hisobni o'chirish» mavzusida xat yuboring va hisobga ulangan telefon raqamingizni ko'rsating.",
        isAlt: true,
      },
    ],
    dataTitle: "Qanday ma'lumotlar o'chiriladi",
    deleted: [
      "Shaxsiy ma'lumotlar: ism, familiya, telefon raqami, elektron pochta",
      "Kompaniya ma'lumotlari: nomi, INN/PINFL, bank rekvizitlari",
      "Kirish tarixi va sessiyalar",
      "Bildirishnoma sozlamalari",
      "Buyurtmalar va e'lonlar qoralamalar",
    ],
    retainedTitle: "Qanday ma'lumotlar saqlanadi",
    retained: [
      "Yakunlangan buyurtmalar va shartnomalar — O'zbekiston Respublikasining buxgalteriya hisobi va soliq to'g'risidagi qonunchiligi talablariga muvofiq 3 yil saqlanadi",
      "Moliyaviy tranzaksiyalar va to'lov yozuvlari — 5 yil saqlanadi",
      "Nizolarni hal qilish uchun zarur ma'lumotlar — ko'rib chiqish tugaguncha saqlanadi",
    ],
    timelineTitle: "Ko'rib chiqish muddati",
    timeline:
      "Hisobni o'chirish so'rovi 30 kun ichida ko'rib chiqiladi. O'chirilgandan so'ng elektron pochta yoki SMS orqali tasdiqlash xabari yuboriladi.",
    contactTitle: "Aloqa",
    contact: "Ma'lumotlarni o'chirish bo'yicha savollar uchun: info@yukbozor.uz",
  },
};

export default function DeleteAccountPage() {
  const [lang, setLang] = useState<Lang>("ru");
  const t = content[lang];

  return (
    <>
      <Helmet>
        <title>{t.title} | Yukbozor.uz</title>
        <meta name="description" content={`${t.title} - ${t.subtitle}`} />
      </Helmet>

      <div className="min-h-screen bg-background" data-testid="delete-account-page">
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
              <div className="flex items-center gap-3 mb-1">
                <Trash2 className="w-6 h-6 text-destructive" />
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
                  {t.title}
                </h1>
              </div>
              <p className="text-muted-foreground mb-1">{t.subtitle}</p>
              <p className="text-sm text-muted-foreground mb-6">{t.lastUpdated}</p>

              <p className="text-muted-foreground leading-relaxed mb-8">{t.intro}</p>

              {/* Steps */}
              <h2 className="text-lg font-semibold text-foreground mb-4">{t.stepsTitle}</h2>
              <div className="space-y-4 mb-8">
                {t.steps.map((step, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-4 p-4 rounded-md border ${
                      step.isAlt
                        ? "border-muted bg-muted/30"
                        : "border-border bg-card"
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                        step.isAlt
                          ? "bg-muted-foreground/20 text-muted-foreground"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      {step.num}
                    </div>
                    <div>
                      <p className="font-medium text-foreground mb-1">{step.title}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* What gets deleted */}
              <h2 className="text-lg font-semibold text-foreground mb-3">{t.dataTitle}</h2>
              <ul className="space-y-2 mb-8">
                {t.deleted.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-muted-foreground text-sm">
                    <Trash2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-destructive" />
                    {item}
                  </li>
                ))}
              </ul>

              {/* What is retained */}
              <h2 className="text-lg font-semibold text-foreground mb-3">{t.retainedTitle}</h2>
              <ul className="space-y-2 mb-8">
                {t.retained.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-muted-foreground text-sm">
                    <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
                    {item}
                  </li>
                ))}
              </ul>

              {/* Timeline */}
              <div className="flex items-start gap-3 p-4 rounded-md bg-muted/40 border border-border mb-8">
                <Clock className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-foreground mb-1">{t.timelineTitle}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t.timeline}</p>
                </div>
              </div>

              {/* Contact */}
              <div className="flex items-start gap-3 p-4 rounded-md bg-muted/40 border border-border">
                <Mail className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-foreground mb-1">{t.contactTitle}</p>
                  <a
                    href="mailto:info@yukbozor.uz"
                    className="text-sm text-primary underline"
                    data-testid="link-contact-email"
                  >
                    info@yukbozor.uz
                  </a>
                </div>
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
