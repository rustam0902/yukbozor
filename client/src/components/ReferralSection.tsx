import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Gift, 
  Wallet, 
  Link2, 
  UserPlus, 
  CheckCircle, 
  ArrowRight,
  Clock,
  Percent,
  FileText,
  CreditCard,
  ShoppingCart
} from "lucide-react";

interface ReferralSectionProps {
  language?: 'ru' | 'uz';
}

export default function ReferralSection({ language = 'ru' }: ReferralSectionProps) {
  const texts = {
    ru: {
      title: 'Реферальная программа',
      subtitle: 'Приглашайте заказчиков и получайте вознаграждение от каждой их сделки',
      rewardTitle: 'Ваше вознаграждение',
      rewardPercent: '30%',
      rewardDescription: 'от комиссии платформы',
      rewardDetail: 'с каждого завершённого договора перевозки приглашённого заказчика',
      duration: '3 года',
      durationLabel: 'Срок начисления',
      durationDescription: 'Вознаграждение начисляется в течение 3 лет с даты регистрации приглашённого заказчика',
      howItWorksTitle: 'Как это работает',
      step1Title: 'Станьте партнёром',
      step1Description: 'Зарегистрируйтесь на платформе. Заказчики и перевозчики могут участвовать без дополнительной регистрации',
      step2Title: 'Получите реферальный код',
      step2Description: 'В кабинете партнёра скопируйте свой уникальный реферальный код',
      step3Title: 'Пригласите заказчика',
      step3Description: 'Передайте реферальный код новому пользователю — он вводит его при регистрации',
      step4Title: 'Получайте вознаграждение',
      step4Description: 'После каждого завершённого договора приглашённого заказчика вам начисляется 30% от комиссии платформы',
      useRewardsTitle: 'Выплата вознаграждения',
      useOption1: 'Физ. лицам — на банковскую карту',
      useOption2: 'Юр. лицам и ИП — на расчётный счёт',
      useOption3: 'Выплата раз в месяц по итогам месяца',
      depositSection: 'Вознаграждение отображается на счёте «Вознаграждение партнёра»',
      importantTitle: 'Важно знать',
      important1: 'Вознаграждение начисляется только с завершённых договоров перевозки',
      important2: 'Заказчик должен ввести ваш реферальный код при регистрации на платформе',
      important3: 'При расторжении договора по инициативе заказчика вознаграждение сторнируется',
      important4: 'Один заказчик может быть связан только с одним партнёром'
    },
    uz: {
      title: 'Referal dasturi',
      subtitle: 'Buyurtmachilarni taklif qiling va ularning har bir bitimidan mukofot oling',
      rewardTitle: 'Sizning mukofotingiz',
      rewardPercent: '30%',
      rewardDescription: 'platforma komissiyasidan',
      rewardDetail: 'taklif qilingan buyurtmachining har bir yakunlangan yuk tashish shartnomasi uchun',
      duration: '3 yil',
      durationLabel: 'Hisoblash muddati',
      durationDescription: 'Mukofot taklif qilingan buyurtmachining ro\'yxatdan o\'tgan sanasidan boshlab 3 yil davomida hisoblanadi',
      howItWorksTitle: 'Bu qanday ishlaydi',
      step1Title: 'Hamkor bo\'ling',
      step1Description: 'Platformada ro\'yxatdan o\'ting. Buyurtmachilar va tashuvchilar qo\'shimcha ro\'yxatdan o\'tmasdan ishtirok etishlari mumkin',
      step2Title: 'Referal kodini oling',
      step2Description: 'Hamkor kabinetida o\'zingizning noyob referal kodingizni nusxalang',
      step3Title: 'Buyurtmachini taklif qiling',
      step3Description: 'Referal kodni yangi foydalanuvchiga bering — u ro\'yxatdan o\'tishda uni kiritadi',
      step4Title: 'Mukofot oling',
      step4Description: 'Taklif qilingan buyurtmachining har bir yakunlangan shartnomasi uchun platforma komissiyasining 30% ini olasiz',
      useRewardsTitle: 'Mukofotni to\'lash',
      useOption1: 'Jismoniy shaxslarga — bank kartasiga',
      useOption2: 'Yuridik shaxslar va YTT ga — hisob-kitob hisobiga',
      useOption3: 'Oylik natijalariga ko\'ra oyda bir marta to\'lov',
      depositSection: 'Mukofot "Hamkor mukofoti" hisobida aks ettiriladi',
      importantTitle: 'Bilish muhim',
      important1: 'Mukofot faqat yakunlangan yuk tashish shartnomalari uchun hisoblanadi',
      important2: 'Buyurtmachi platformada ro\'yxatdan o\'tishda sizning referal kodingizni kiritishi kerak',
      important3: 'Shartnoma buyurtmachi tashabbusi bilan bekor qilinganda mukofot storno qilinadi',
      important4: 'Har bir buyurtmachi faqat bitta hamkor bilan bog\'lanishi mumkin'
    }
  };

  const t = texts[language];

  return (
    <section className="py-16 px-6 md:px-12">
      <div className="w-full">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">{t.title}</h2>
          <p className="text-lg text-muted-foreground">{t.subtitle}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
          <Card className="relative overflow-visible">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Percent className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">{t.rewardTitle}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-bold text-primary">{t.rewardPercent}</span>
                <span className="text-muted-foreground">{t.rewardDescription}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t.rewardDetail}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">{t.durationLabel}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-bold text-primary">{t.duration}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t.durationDescription}</p>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">{t.useRewardsTitle}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{t.useOption1}</span>
                </li>
                <li className="flex items-center gap-3">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{t.useOption2}</span>
                </li>
                <li className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{t.useOption3}</span>
                </li>
              </ul>
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">{t.depositSection}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              {t.howItWorksTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                    1
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1 flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      {t.step1Title}
                    </h4>
                    <p className="text-sm text-muted-foreground">{t.step1Description}</p>
                  </div>
                </div>
                <div className="hidden lg:block absolute top-5 left-full w-full">
                  <ArrowRight className="h-5 w-5 text-muted-foreground/50 mx-auto" />
                </div>
              </div>

              <div className="relative">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                    2
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1 flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-primary" />
                      {t.step2Title}
                    </h4>
                    <p className="text-sm text-muted-foreground">{t.step2Description}</p>
                  </div>
                </div>
                <div className="hidden lg:block absolute top-5 left-full w-full">
                  <ArrowRight className="h-5 w-5 text-muted-foreground/50 mx-auto" />
                </div>
              </div>

              <div className="relative">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                    3
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1 flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-primary" />
                      {t.step3Title}
                    </h4>
                    <p className="text-sm text-muted-foreground">{t.step3Description}</p>
                  </div>
                </div>
                <div className="hidden lg:block absolute top-5 left-full w-full">
                  <ArrowRight className="h-5 w-5 text-muted-foreground/50 mx-auto" />
                </div>
              </div>

              <div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                    4
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      {t.step4Title}
                    </h4>
                    <p className="text-sm text-muted-foreground">{t.step4Description}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {t.importantTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5 shrink-0">1</Badge>
                <p className="text-sm text-muted-foreground">{t.important1}</p>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5 shrink-0">2</Badge>
                <p className="text-sm text-muted-foreground">{t.important2}</p>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5 shrink-0">3</Badge>
                <p className="text-sm text-muted-foreground">{t.important3}</p>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5 shrink-0">4</Badge>
                <p className="text-sm text-muted-foreground">{t.important4}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
