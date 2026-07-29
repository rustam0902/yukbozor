import { useState, useRef, useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HeroSection from '@/components/HeroSection';
import FeatureSection from '@/components/FeatureSection';
import DealsSection from '@/components/DealsSection';
import OrdersSection from '@/components/OrdersSection';
import AnnouncementsSection from '@/components/AnnouncementsSection';
import ReferralSection from '@/components/ReferralSection';
import HowItWorksSection from '@/components/HowItWorksSection';
import { HomePageSEO } from '@/components/SEO';
import { useLanguage } from '@/contexts/language-context';
import { useAuth } from '@/contexts/auth-context';

export default function HomePage() {
  const { language, setLanguage } = useLanguage();
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [activeSection, setActiveSection] = useState<'features' | 'deals' | 'orders' | 'announcements' | 'referral' | 'how'>('features');
  const sectionRef = useRef<HTMLDivElement>(null);

  // React to URL search parameter changes
  useEffect(() => {
    const params = new URLSearchParams(search);
    const section = params.get('section');
    const validSections = ['features', 'deals', 'orders', 'announcements', 'referral', 'how'];
    if (section && validSections.includes(section)) {
      setActiveSection(section as 'features' | 'deals' | 'orders' | 'announcements' | 'referral' | 'how');
      // Scroll to section after a short delay
      setTimeout(() => {
        if (section !== 'features' && sectionRef.current) {
          sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      // Clear URL parameter to allow in-page navigation
      setLocation('/', { replace: true });
    }
  }, [search, setLocation]);

  const handleSectionChange = (section: 'features' | 'deals' | 'orders' | 'announcements' | 'referral' | 'how') => {
    setActiveSection(section);
    
    // Delay scroll to allow mobile menu Sheet to close first
    // This prevents the Sheet close animation from resetting scroll position
    setTimeout(() => {
      if (section !== 'features' && sectionRef.current) {
        sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 350);
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'deals':
        return <DealsSection language={language} />;
      case 'orders':
        return <OrdersSection language={language} />;
      case 'announcements':
        return <AnnouncementsSection language={language} />;
      case 'referral':
        return <ReferralSection language={language} />;
      case 'how':
        return <HowItWorksSection language={language} />;
      default:
        return <FeatureSection language={language} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <HomePageSEO lang={language} />
      <Header 
        language={language} 
        onLanguageChange={setLanguage}
        onSectionChange={handleSectionChange}
        fixed={true}
      />
      <main className="flex-1 pt-16">
        <HeroSection language={language} />
        <div ref={sectionRef} className="scroll-mt-20">
          {renderSection()}
        </div>
      </main>
      <Footer language={language} />
    </div>
  );
}
