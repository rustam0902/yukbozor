import { Button } from "@/components/ui/button";
import { ArrowRight, Users } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import heroImage from "@assets/generated_images/professional_cargo_logistics_hero.png";

interface HeroSectionProps {
  language?: 'ru' | 'uz';
}

export default function HeroSection({ language = 'ru' }: HeroSectionProps) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  
  const texts = {
    ru: {
      title: 'Цифровой рынок местных грузоперевозок',
      subtitle: 'Подбирайте перевозчиков, получайте предложения и управляйте договорами в одном месте',
      createOrder: 'Создать заказ',
      becomePartner: 'Стать партнёром',
      learnMore: 'Узнать больше'
    },
    uz: {
      title: 'Mahalliy yuk tashish xizmatlarining raqamli bozori',
      subtitle: 'Tashuvchilarni tanlang, takliflar oling va shartnomalarni bir joyda boshqaring',
      createOrder: 'Buyurtma yaratish',
      becomePartner: 'Hamkor bo\'lish',
      learnMore: 'Ko\'proq bilish'
    }
  };

  const t = texts[language];

  const handleCreateOrder = () => {
    if (user) {
      // User is logged in - go to customer dashboard
      setLocation('/customer');
    } else {
      // User is not logged in - go to login
      setLocation('/login');
    }
  };

  const handleBecomePartner = () => {
    setLocation('/register?role=partner');
  };

  return (
    <div className="relative h-[60vh] min-h-[500px] w-full overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent" />
      
      <div className="relative h-full max-w-7xl mx-auto px-4 md:px-8 flex items-center">
        <div className="max-w-2xl text-white drop-shadow-lg">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4" data-testid="text-hero-title">
            {t.title}
          </h1>
          <p className="text-lg md:text-xl mb-8 text-white/90" data-testid="text-hero-subtitle">
            {t.subtitle}
          </p>
          <div className="flex flex-wrap gap-4">
            <Button 
              size="lg" 
              className="gap-2" 
              onClick={handleCreateOrder}
              data-testid="button-create-order"
            >
              {t.createOrder}
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="gap-2 bg-background/10 backdrop-blur-sm border-white/20 text-white hover:bg-background/20"
              onClick={handleBecomePartner}
              data-testid="button-become-partner"
            >
              <Users className="h-5 w-5" />
              {t.becomePartner}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
