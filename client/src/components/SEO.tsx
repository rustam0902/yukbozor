import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
  structuredData?: object;
}

const defaultMeta = {
  title: 'Yukbozor.uz - Yuk Tashish Xizmatlari Platformasi',
  description: "O'zbekistondagi yuk tashish xizmatlari uchun raqamli bozor. Buyurtma yaratish, takliflar olish, shartnomalarni boshqarish. Цифровая платформа грузоперевозок в Узбекистане.",
  keywords: 'yuk tashish, грузоперевозки, Узбекистан, cargo, logistics, yuk bozori, транспорт, доставка груза, logistika',
  image: 'https://yukbozor.uz/og-image.png',
  url: 'https://yukbozor.uz',
};

export function SEO({
  title,
  description = defaultMeta.description,
  keywords = defaultMeta.keywords,
  image = defaultMeta.image,
  url = defaultMeta.url,
  type = 'website',
  noindex = false,
  structuredData,
}: SEOProps) {
  const fullTitle = title 
    ? `${title} | Yukbozor.uz` 
    : defaultMeta.title;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Canonical URL */}
      <link rel="canonical" href={url} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={url} />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={image} />
      
      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
}

export function HomePageSEO({ lang = 'uz' }: { lang?: 'uz' | 'ru' }) {
  const meta = lang === 'ru' 
    ? {
        title: 'Yukbozor.uz - Платформа Грузоперевозок Узбекистана',
        description: 'Цифровая B2B платформа для грузоперевозок в Узбекистане. Создавайте заказы, получайте предложения от перевозчиков, заключайте контракты онлайн.',
        keywords: 'грузоперевозки, Узбекистан, Ташкент, доставка груза, транспорт, логистика, перевозки, фура, truck, cargo, грузовые перевозки',
      }
    : {
        title: "Yukbozor.uz - O'zbekiston Yuk Tashish Platformasi",
        description: "O'zbekistondagi yuk tashish xizmatlari uchun raqamli B2B bozor. Buyurtma yarating, takliflar oling, shartnomalarni onlayn boshqaring.",
        keywords: "yuk tashish, O'zbekiston, Toshkent, yuk bozori, logistika, transport, avtomobil yuk, cargo, gruzoperevozki",
      };

  return (
    <SEO
      title={meta.title}
      description={meta.description}
      keywords={meta.keywords}
      url="https://yukbozor.uz/"
    />
  );
}

export function OrderPageSEO({ orderId, title, lang = 'uz' }: { orderId: string; title?: string; lang?: 'uz' | 'ru' }) {
  const meta = lang === 'ru'
    ? {
        title: title ? `Заказ: ${title}` : `Заказ #${orderId}`,
        description: 'Детали заказа на грузоперевозку. Просмотр маршрута, цены и условий доставки.',
      }
    : {
        title: title ? `Buyurtma: ${title}` : `Buyurtma #${orderId}`,
        description: "Yuk tashish buyurtmasi tafsilotlari. Yo'nalish, narx va yetkazib berish shartlarini ko'rish.",
      };

  return (
    <SEO
      title={meta.title}
      description={meta.description}
      url={`https://yukbozor.uz/order/${orderId}`}
      noindex={true}
    />
  );
}

export function LoginPageSEO({ lang = 'uz' }: { lang?: 'uz' | 'ru' }) {
  const meta = lang === 'ru'
    ? {
        title: 'Вход в систему',
        description: 'Войдите в свой аккаунт Yukbozor.uz для управления заказами и предложениями грузоперевозок.',
      }
    : {
        title: 'Tizimga kirish',
        description: "Yukbozor.uz hisobingizga kiring - buyurtmalar va takliflarni boshqaring.",
      };

  return (
    <SEO
      title={meta.title}
      description={meta.description}
      url="https://yukbozor.uz/login"
      noindex={true}
    />
  );
}

export function RegisterPageSEO({ lang = 'uz' }: { lang?: 'uz' | 'ru' }) {
  const meta = lang === 'ru'
    ? {
        title: 'Регистрация',
        description: 'Зарегистрируйтесь на Yukbozor.uz - B2B платформе грузоперевозок Узбекистана. Бесплатная регистрация для заказчиков и перевозчиков.',
      }
    : {
        title: "Ro'yxatdan o'tish",
        description: "Yukbozor.uz - O'zbekiston yuk tashish B2B platformasida ro'yxatdan o'ting. Buyurtmachilar va tashuvchilar uchun bepul ro'yxatdan o'tish.",
      };

  return (
    <SEO
      title={meta.title}
      description={meta.description}
      url="https://yukbozor.uz/register"
    />
  );
}

export function CustomerDashboardSEO({ lang = 'uz' }: { lang?: 'uz' | 'ru' }) {
  const meta = lang === 'ru'
    ? {
        title: 'Панель заказчика',
        description: 'Управляйте своими заказами на грузоперевозку, просматривайте предложения и контракты.',
      }
    : {
        title: 'Buyurtmachi paneli',
        description: "Yuk tashish buyurtmalaringizni boshqaring, takliflar va shartnomalarni ko'ring.",
      };

  return (
    <SEO
      title={meta.title}
      description={meta.description}
      url="https://yukbozor.uz/customer"
      noindex={true}
    />
  );
}

export function CarrierDashboardSEO({ lang = 'uz' }: { lang?: 'uz' | 'ru' }) {
  const meta = lang === 'ru'
    ? {
        title: 'Панель перевозчика',
        description: 'Просматривайте доступные заказы, отправляйте предложения и управляйте контрактами.',
      }
    : {
        title: 'Tashuvchi paneli',
        description: "Mavjud buyurtmalarni ko'ring, takliflar yuboring va shartnomalarni boshqaring.",
      };

  return (
    <SEO
      title={meta.title}
      description={meta.description}
      url="https://yukbozor.uz/carrier"
      noindex={true}
    />
  );
}

export function PartnerDashboardSEO({ lang = 'uz' }: { lang?: 'uz' | 'ru' }) {
  const meta = lang === 'ru'
    ? {
        title: 'Панель партнера',
        description: 'Партнерская программа Yukbozor.uz - приглашайте пользователей и получайте комиссию.',
      }
    : {
        title: 'Hamkor paneli',
        description: "Yukbozor.uz hamkorlik dasturi - foydalanuvchilarni taklif qiling va komissiya oling.",
      };

  return (
    <SEO
      title={meta.title}
      description={meta.description}
      url="https://yukbozor.uz/partner"
      noindex={true}
    />
  );
}

export function DealsPageSEO({ lang = 'uz' }: { lang?: 'uz' | 'ru' }) {
  const meta = lang === 'ru'
    ? {
        title: 'Сделки и контракты',
        description: 'Просмотр активных сделок и контрактов на грузоперевозку на платформе Yukbozor.uz.',
      }
    : {
        title: 'Bitimlar va shartnomalar',
        description: "Yukbozor.uz platformasidagi faol bitimlar va yuk tashish shartnomalarini ko'ring.",
      };

  return (
    <SEO
      title={meta.title}
      description={meta.description}
      url="https://yukbozor.uz/deals"
    />
  );
}
