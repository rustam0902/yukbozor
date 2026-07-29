import { Card, CardContent } from "@/components/ui/card";
import contractImage from "@assets/generated_images/Business_contract_handshake_9d8a783c.png";
import mobileImage from "@assets/generated_images/Mobile_logistics_tracking_7c9e5714.png";
import warehouseImage from "@assets/generated_images/Warehouse_delivery_operations_8f3437a8.png";

interface FeatureSectionProps {
  language?: 'ru' | 'uz';
}

export default function FeatureSection({ language = 'ru' }: FeatureSectionProps) {
  const texts = {
    ru: {
      title: 'Почему выбирают Yukbozor.uz',
      feature1Title: 'Прозрачные условия',
      feature1Desc: 'Честная и сильная конкуренция обеспечивает формирование оптимальных цен',
      feature2Title: 'Удобное управление',
      feature2Desc: 'Все заказы, предложения и документы в одной платформе',
      feature3Title: 'Безопасные расчёты',
      feature3Desc: 'Взаёмные расчёты между заказчиками и перевозчиками осуществляются через систему эскроу'
    },
    uz: {
      title: 'Nega Yukbozor.uz ni tanlashadi',
      feature1Title: 'Shaffof shartlar',
      feature1Desc: 'Halol va kuchli raqobat optimal narxlar shakllanishini ta\'minlaydi',
      feature2Title: 'Qulay boshqaruv',
      feature2Desc: 'Barcha buyurtmalar, takliflar va hujjatlar bitta platformada',
      feature3Title: 'Havfsiz hisob-kitoblar',
      feature3Desc: 'Buyurtmachilar va yuk tashuvchilar o\'rtasidagi o\'zaro hisob-kitoblar eskrou tizimi orqali amalga oshiriladi'
    }
  };

  const t = texts[language];

  const features = [
    {
      title: t.feature1Title,
      description: t.feature1Desc,
      image: warehouseImage
    },
    {
      title: t.feature2Title,
      description: t.feature2Desc,
      image: mobileImage
    },
    {
      title: t.feature3Title,
      description: t.feature3Desc,
      image: contractImage
    }
  ];

  return (
    <section className="py-16 px-6 md:px-12">
      <div className="w-full">
        <h2 className="text-3xl font-bold text-center mb-12" data-testid="text-features-title">
          {t.title}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="hover-elevate" data-testid={`card-feature-${index}`}>
              <CardContent className="p-6">
                <div className="aspect-video w-full mb-4 rounded-md overflow-hidden">
                  <img 
                    src={feature.image} 
                    alt={feature.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
