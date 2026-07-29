import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  UserPlus, 
  FileText, 
  Send, 
  CheckCircle2, 
  FileSignature, 
  CreditCard, 
  Truck, 
  Star,
  Shield,
  Lock,
  Percent,
  Scale,
  ArrowDown,
  Search,
  HandCoins,
  Package,
  Building2,
  User
} from "lucide-react";

interface HowItWorksSectionProps {
  language?: 'ru' | 'uz';
}

export default function HowItWorksSection({ language = 'ru' }: HowItWorksSectionProps) {
  const texts = {
    ru: {
      title: 'Как работает платформа?',
      subtitle: 'Yukbozor.uz — электронная платформа для размещения заказов на перевозку грузов и заключения договоров',
      
      forCustomerTitle: 'Для заказчиков',
      forCustomerSubtitle: 'Юр. лица, ИП и физ. лица — разместите заказ и получите предложения',
      
      forCarrierTitle: 'Для перевозчиков',
      forCarrierSubtitle: 'Юр. лица и ИП — находите заказы и развивайте бизнес',
      
      securityTitle: 'Система безопасности',
      securitySubtitle: 'Ваши деньги и грузы под защитой',
      
      customerSteps: [
        { icon: UserPlus, title: 'Регистрация', description: 'Зарегистрируйтесь как заказчик. Для юр. лиц и ИП — с ЭЦП, для физ. лиц — по SMS' },
        { icon: FileText, title: 'Создание заказа', description: 'Укажите маршрут, тип груза, дату погрузки и желаемую цену. Заказ активен 1 час' },
        { icon: Search, title: 'Получение предложений', description: 'В течение 1 часа перевозчики видят заказ и отправляют свои предложения' },
        { icon: CheckCircle2, title: 'Выбор или авто-назначение', description: 'Выберите перевозчика сами или по истечении 1 часа система автоматически выберет лучшее предложение по наименьшей цене. Если предложений нет или все выше вашей цены — заказ продлевается ещё на 1 час' },
        { icon: FileSignature, title: 'Автоматический контракт', description: 'Контракт формируется автоматически и считается подписанным с момента создания. Отдельная подпись не требуется' },
        { icon: CreditCard, title: 'Внесение предоплаты', description: 'Внесите 100% предоплату — она блокируется до завершения доставки' },
        { icon: Truck, title: 'Доставка груза', description: 'Перевозчик доставляет груз. Перевозка начинается только после внесения предоплаты' },
        { icon: Star, title: 'Завершение и оплата', description: 'После доставки заблокированные средства перечисляются перевозчику' }
      ],
      
      carrierSteps: [
        { icon: Building2, title: 'Регистрация', description: 'Зарегистрируйтесь как перевозчик с ЭЦП. Только для юр. лиц и ИП' },
        { icon: Search, title: 'Поиск заказов', description: 'Следите за таймером! До истечения срока действия заказа вы можете подать предложение' },
        { icon: Send, title: 'Подача предложения', description: 'Подайте предложение с вашей ценой. Комиссия платформы 2% блокируется автоматически при подаче' },
        { icon: FileSignature, title: 'Получение контракта', description: 'По истечении таймера лучшее предложение (наименьшая цена с учётом НДС) получает контракт. Учитывается статус НДС заказчика' },
        { icon: Truck, title: 'Выполнение перевозки', description: 'Перевозка начинается после получения статуса «Предоплата внесена»' },
        { icon: HandCoins, title: 'Получение оплаты', description: 'После завершения предоплата перечисляется вам, комиссия 2% удерживается' }
      ],
      
      securityFeatures: [
        { 
          icon: Lock, 
          title: 'Эскроу-механизм', 
          description: 'Предоплата заказчика блокируется до завершения доставки. Перевозчик получает оплату только после подтверждения выполнения',
          badge: 'Защита сделки'
        },
        { 
          icon: CreditCard, 
          title: '100% предоплата от заказчика', 
          description: 'После формирования контракта заказчик вносит полную предоплату. Деньги блокируются на платформе до завершения',
          badge: 'Гарантия оплаты'
        },
        { 
          icon: FileSignature, 
          title: 'Автоматические контракты', 
          description: 'Контракты формируются автоматически на основе заказа и предложения. Все действия в личном кабинете имеют юридическую силу',
          badge: 'Юридическая сила'
        },
        { 
          icon: Scale, 
          title: 'Система штрафов при расторжении', 
          description: 'При расторжении договора применяются штрафные санкции согласно условиям оферты. Комиссия платформы не возвращается',
          badge: 'Честные условия'
        }
      ],
      
      platformCommission: 'Комиссия платформы',
      commissionValue: '2%',
      commissionDescription: 'от суммы сделки оплачивает перевозчик',
      
      startNow: 'Начните прямо сейчас',
      startDescription: 'Зарегистрируйтесь и получите доступ к надежному рынку грузоперевозок'
    },
    uz: {
      title: 'Platforma qanday ishlaydi?',
      subtitle: 'Yukbozor.uz — yuk tashish buyurtmalarini joylashtirish va shartnomalar tuzish uchun elektron platforma',
      
      forCustomerTitle: 'Buyurtmachilar uchun',
      forCustomerSubtitle: 'Yuridik shaxslar, YTT va jismoniy shaxslar — buyurtma joylashtiring va takliflar oling',
      
      forCarrierTitle: 'Tashuvchilar uchun',
      forCarrierSubtitle: 'Yuridik shaxslar va YTT — buyurtmalarni toping va biznesingizni rivojlantiring',
      
      securityTitle: 'Xavfsizlik tizimi',
      securitySubtitle: 'Pulingiz va yukingiz himoya ostida',
      
      customerSteps: [
        { icon: UserPlus, title: 'Ro\'yxatdan o\'tish', description: 'Buyurtmachi sifatida ro\'yxatdan o\'ting. Yuridik shaxslar va YTT uchun — ERI bilan, jismoniy shaxslar uchun — SMS orqali' },
        { icon: FileText, title: 'Buyurtma yaratish', description: 'Marshrut, yuk turi, yuklash sanasi va kerakli narxni belgilang. Buyurtma 1 soat faol' },
        { icon: Search, title: 'Takliflar olish', description: '1 soat davomida tashuvchilar buyurtmani ko\'rib, o\'z takliflarini yuborishadi' },
        { icon: CheckCircle2, title: 'Tanlash yoki avto-tayinlash', description: 'Tashuvchini o\'zingiz tanlang yoki 1 soatdan so\'ng tizim eng past narx bo\'yicha eng yaxshi taklifni avtomatik tanlaydi. Agar takliflar bo\'lmasa yoki barchasi narxingizdan yuqori bo\'lsa — buyurtma yana 1 soatga uzaytiriladi' },
        { icon: FileSignature, title: 'Avtomatik shartnoma', description: 'Shartnoma avtomatik shakllantiriladi va yaratilgan paytdan boshlab imzolangan hisoblanadi. Alohida imzo talab etilmaydi' },
        { icon: CreditCard, title: 'Oldindan to\'lov', description: '100% oldindan to\'lovni kiriting — u yetkazib berish yakunlanguncha bloklanadi' },
        { icon: Truck, title: 'Yukni yetkazib berish', description: 'Tashuvchi yukni yetkazadi. Tashish faqat oldindan to\'lov kiritilgandan so\'ng boshlanadi' },
        { icon: Star, title: 'Yakunlash va to\'lov', description: 'Yetkazib berilgandan so\'ng bloklangan mablag\'lar tashuvchiga o\'tkaziladi' }
      ],
      
      carrierSteps: [
        { icon: Building2, title: 'Ro\'yxatdan o\'tish', description: 'ERI bilan tashuvchi sifatida ro\'yxatdan o\'ting. Faqat yuridik shaxslar va YTT uchun' },
        { icon: Search, title: 'Buyurtmalarni qidirish', description: 'Taymerga e\'tibor bering! Buyurtma muddati tugashidan oldin taklif berishingiz mumkin' },
        { icon: Send, title: 'Taklif berish', description: 'O\'z narxingiz bilan taklif bering. 2% platforma komissiyasi taklif berishda avtomatik bloklanadi' },
        { icon: FileSignature, title: 'Shartnoma olish', description: 'Taymer tugaganda eng yaxshi taklif (QQS hisobga olingan holda eng past narx) shartnoma oladi. Buyurtmachining QQS holati hisobga olinadi' },
        { icon: Truck, title: 'Tashishni bajarish', description: 'Tashish «Oldindan to\'lov kiritildi» holati olingandan so\'ng boshlanadi' },
        { icon: HandCoins, title: 'To\'lovni olish', description: 'Yakunlangandan so\'ng oldindan to\'lov sizga o\'tkaziladi, 2% komissiya ushlab qolinadi' }
      ],
      
      securityFeatures: [
        { 
          icon: Lock, 
          title: 'Eskrou mexanizmi', 
          description: 'Buyurtmachining oldindan to\'lovi yetkazib berish yakunlanguncha bloklanadi. Tashuvchi to\'lovni faqat bajarilganligi tasdiqlangandan so\'ng oladi',
          badge: 'Bitim himoyasi'
        },
        { 
          icon: CreditCard, 
          title: 'Buyurtmachidan 100% oldindan to\'lov', 
          description: 'Shartnoma shakllantirilgandan so\'ng buyurtmachi to\'liq oldindan to\'lovni kiritadi. Pul yakunlanguncha platformada bloklanadi',
          badge: 'To\'lov kafolati'
        },
        { 
          icon: FileSignature, 
          title: 'Avtomatik shartnomalar', 
          description: 'Shartnomalar buyurtma va taklif asosida avtomatik shakllantiriladi. Shaxsiy kabinetdagi barcha harakatlar yuridik kuchga ega',
          badge: 'Yuridik kuch'
        },
        { 
          icon: Scale, 
          title: 'Bekor qilishda jarima tizimi', 
          description: 'Shartnoma bekor qilinganda oferta shartlariga muvofiq jarima sanktsiyalari qo\'llaniladi. Platforma komissiyasi qaytarilmaydi',
          badge: 'Halol shartlar'
        }
      ],
      
      platformCommission: 'Platforma komissiyasi',
      commissionValue: '2%',
      commissionDescription: 'bitim summasidan tashuvchi to\'laydi',
      
      startNow: 'Hoziroq boshlang',
      startDescription: 'Ro\'yxatdan o\'ting va ishonchli yuk tashish bozoriga kirish huquqiga ega bo\'ling'
    }
  };

  const t = texts[language];

  const StepCard = ({ step, index, total }: { step: any, index: number, total: number }) => {
    const Icon = step.icon;
    return (
      <div className="relative">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 relative">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
              <Icon className="h-5 w-5" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-background border-2 border-primary flex items-center justify-center text-xs font-bold text-primary">
              {index + 1}
            </div>
          </div>
          <div className="flex-1 pt-1">
            <h4 className="font-semibold mb-1">{step.title}</h4>
            <p className="text-sm text-muted-foreground">{step.description}</p>
          </div>
        </div>
        {index < total - 1 && (
          <div className="absolute left-6 top-14 h-8 w-px bg-border" />
        )}
      </div>
    );
  };

  return (
    <section className="py-16 px-6 md:px-12">
      <div className="w-full">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">{t.title}</h2>
          <p className="text-lg text-muted-foreground">{t.subtitle}</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2 mb-12">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <User className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-xl">{t.forCustomerTitle}</CardTitle>
                  <p className="text-sm text-muted-foreground">{t.forCustomerSubtitle}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {t.customerSteps.map((step, index) => (
                  <StepCard key={index} step={step} index={index} total={t.customerSteps.length} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Truck className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <CardTitle className="text-xl">{t.forCarrierTitle}</CardTitle>
                  <p className="text-sm text-muted-foreground">{t.forCarrierSubtitle}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {t.carrierSteps.map((step, index) => (
                  <StepCard key={index} step={step} index={index} total={t.carrierSteps.length} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-12">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">{t.securityTitle}</CardTitle>
                <p className="text-sm text-muted-foreground">{t.securitySubtitle}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {t.securityFeatures.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div key={index} className="flex gap-4 p-4 rounded-lg bg-muted/50">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{feature.title}</h4>
                        <Badge variant="secondary" className="text-xs">{feature.badge}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-8">
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Percent className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.platformCommission}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-primary">{t.commissionValue}</span>
                    <span className="text-muted-foreground">{t.commissionDescription}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
