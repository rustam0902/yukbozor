import { Mail, Phone, MapPin, Building2 } from "lucide-react";
import { SiTelegram, SiInstagram } from "react-icons/si";

interface FooterProps {
  language?: "ru" | "uz";
}

export default function Footer({ language = "ru" }: FooterProps) {
  const texts = {
    ru: {
      about: "О платформе",
      aboutDesc: "Yukbozor.uz - Цифровой рынок местных грузоперевозок",
      contacts: "Контакты",
      phone: "+998 93 969 88 99",
      email: "yukbozor@umail.uz",
      address: "Ташкент, Узбекистан",
      legal: "Правовая информация",
      terms: "Условия использования",
      privacy: "Условия реферальной программы",
      copyright: "© 2025 Yukbozor.uz. Все права защищены.",
      bankDetails: "Банковские реквизиты для пополнения депозита:",
      companyName: 'ООО "YUK TASHUVLARI RAQAMLI PLATFORMASI"',
      inn: "ИНН: 312611245",
      account: "Р/с: 20208000007356112003",
      bankCode: "МФО: 00450",
      bankName: 'АО "O\'zmilliybank"',
    },
    uz: {
      about: "Platforma haqida",
      aboutDesc:
        "Yukbozor.uz - Mahalliy yuk tashish xizmatlarining raqamli bozori",
      contacts: "Aloqa",
      phone: "+998 93 969 88 99",
      email: "yukbozor@umail.uz",
      address: "Toshkent, O'zbekiston",
      legal: "Huquqiy ma'lumot",
      terms: "Foydalanish shartlari",
      privacy: "Referal dastur shartlari",
      copyright: "© 2025 Yukbozor.uz. Barcha huquqlar himoyalangan.",
      bankDetails: "Depozitni to'ldirish uchun bank rekvizitlari:",
      companyName: '"YUK TASHUVLARI RAQAMLI PLATFORMASI" MChJ',
      inn: "STIR: 312611245",
      account: "H/r: 20208000007356112003",
      bankCode: "MFO: 00450",
      bankName: '"O\'zmilliybank" AJ',
    },
  };

  const t = texts[language];

  return (
    <footer className="bg-card border-t mt-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <h3 className="font-semibold text-lg mb-4">{t.about}</h3>
            <p className="text-sm text-muted-foreground">{t.aboutDesc}</p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-4">{t.contacts}</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span data-testid="text-phone">{t.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span data-testid="text-email">{t.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span data-testid="text-address">{t.address}</span>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <a
                  href="https://t.me/yukbozor_uz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-[#0088cc] transition-colors"
                  data-testid="link-telegram"
                >
                  <SiTelegram className="h-5 w-5" />
                </a>
                <a
                  href="https://www.instagram.com/yukbozor_uz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-[#E4405F] transition-colors"
                  data-testid="link-instagram"
                >
                  <SiInstagram className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-4">{t.legal}</h3>
            <div className="space-y-2">
              <a
                href={language === 'uz' ? '/oferta-uz.pdf' : '/oferta-ru.pdf'}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-muted-foreground hover:text-foreground"
                data-testid="link-terms"
              >
                {t.terms}
              </a>
              <a
                href={language === 'uz' ? '/referral-terms-uz.pdf' : '/referral-terms-ru.pdf'}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-muted-foreground hover:text-foreground"
                data-testid="link-privacy"
              >
                {t.privacy}
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-4">{t.bankDetails}</h3>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 mt-0.5 shrink-0" />
                <span data-testid="text-company-name">{t.companyName}</span>
              </div>
              <div className="pl-6" data-testid="text-inn">{t.inn}</div>
              <div className="pl-6" data-testid="text-account">{t.account}</div>
              <div className="pl-6" data-testid="text-bank-code">{t.bankCode}</div>
              <div className="pl-6" data-testid="text-bank-name">{t.bankName}</div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          {t.copyright}
        </div>
      </div>
    </footer>
  );
}
