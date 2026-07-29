import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Globe, Menu, User, Package, Truck, Users, ShieldCheck, LogOut, Phone, X, LogIn, UserPlus, UserCheck } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import { SiTelegram } from "react-icons/si";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface HeaderProps {
  language?: 'ru' | 'uz';
  onLanguageChange?: (lang: 'ru' | 'uz') => void;
  userRole?: Array<'customer' | 'carrier' | 'partner' | 'admin'> | null;
  currentRole?: 'customer' | 'carrier' | 'partner' | 'admin' | null;
  userName?: string;
  onMenuClick?: () => void;
  onSectionChange?: (section: 'features' | 'deals' | 'orders' | 'announcements' | 'referral' | 'how') => void;
  sticky?: boolean;
  fixed?: boolean;
}

export default function Header({ 
  language = 'uz', 
  onLanguageChange,
  userRole,
  currentRole,
  userName,
  onMenuClick,
  onSectionChange,
  sticky = true,
  fixed = false
}: HeaderProps) {
  const [location, setLocation] = useLocation();
  const { logout, refetch, representativeMode, deactivateRepresentativeMode } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLanguageToggle = () => {
    const newLang = language === 'ru' ? 'uz' : 'ru';
    onLanguageChange?.(newLang);
  };

  const handleLogout = async () => {
    await logout();
    setLocation('/');
  };

  const handleMobileNavClick = (section: 'features' | 'deals' | 'orders' | 'announcements' | 'referral' | 'how') => {
    onSectionChange?.(section);
    setMobileMenuOpen(false);
  };

  // Navigate to announcements - use in-page navigation on home, URL navigation elsewhere
  const handleAnnouncementsClick = () => {
    if (location === '/' && onSectionChange) {
      onSectionChange('announcements');
    } else {
      setLocation('/?section=announcements');
    }
  };

  const handleMobileAnnouncementsClick = () => {
    setMobileMenuOpen(false);
    if (location === '/' && onSectionChange) {
      onSectionChange('announcements');
    } else {
      setLocation('/?section=announcements');
    }
  };

  const texts = {
    ru: {
      home: 'Главная',
      orders: 'Заказы',
      deals: 'Сделки',
      announcements: 'Объявления',
      referralProgram: 'Реферальная программа',
      howItWorks: 'Как работает платформа?',
      contacts: 'Контакты',
      phone: '+998 (93) 969-88-99',
      telegram: 'Телеграм',
      signIn: 'Войти',
      register: 'Регистрация',
      switchRole: 'Сменить роль',
      logout: 'Выйти',
      customer: 'Заказчик',
      carrier: 'Перевозчик',
      partner: 'Партнёр',
      admin: 'Администратор',
      representativeMode: 'Режим представителя',
      workingAs: 'Работаете от имени',
      exitRepMode: 'Выйти из режима представителя'
    },
    uz: {
      home: 'Bosh sahifa',
      orders: 'Buyurtmalar',
      deals: 'Shartnomalar',
      announcements: 'E\'lonlar',
      referralProgram: 'Referal dasturi',
      howItWorks: 'Platforma qanday ishlaydi?',
      contacts: 'Aloqa',
      phone: '+998 (93) 969-88-99',
      telegram: 'Telegram',
      signIn: 'Kirish',
      register: 'Ro\'yxatdan o\'tish',
      switchRole: 'Rolni o\'zgartirish',
      logout: 'Chiqish',
      customer: 'Buyurtmachi',
      carrier: 'Tashuvchi',
      partner: 'Hamkor',
      admin: 'Administrator',
      representativeMode: 'Vakil rejimi',
      workingAs: 'Nomidan ishlayapsiz',
      exitRepMode: 'Vakil rejimidan chiqish'
    }
  };

  const t = texts[language];

  const roleLabel = currentRole ? t[currentRole] : '';
  
  // Defensive: only show role switcher if user has roles
  const roleMenuItems: Array<{ role: 'customer' | 'carrier' | 'partner'; path: string; icon: typeof Package }> = 
    (userRole && Array.isArray(userRole) && userRole.length > 0) ? [
      { role: 'customer' as const, path: '/customer', icon: Package },
      { role: 'carrier' as const, path: '/carrier', icon: Truck },
      { role: 'partner' as const, path: '/partner', icon: Users }
    ].filter(item => userRole.includes(item.role as 'customer' | 'carrier' | 'partner' | 'admin')) : [];

  return (
    <header className={`${fixed ? 'fixed top-0 left-0 right-0 z-[100]' : sticky ? 'sticky top-0 z-[100]' : ''} bg-background border-b`}>
      <div className="w-full px-3 sm:px-6 md:px-12 lg:px-16 xl:px-20">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          {/* Logo section */}
          <div className="flex items-center gap-2 sm:gap-6 flex-shrink-0">
            {userRole && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onMenuClick}
                data-testid="button-menu-toggle"
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <a 
              href="/"
              className="flex items-center cursor-pointer select-none no-underline" 
              data-testid="link-logo"
            >
              <span className="text-2xl font-bold tracking-tight">
                <span className="text-primary">YUK</span>
                <span className="mx-1"></span>
                <span className="text-destructive">BOZOR</span>
              </span>
            </a>
            {!userRole && (
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="lg:hidden"
                    data-testid="button-mobile-menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72">
                  <SheetHeader>
                    <SheetTitle>
                      <span className="text-xl font-bold">
                        <span className="text-primary">YUK</span>
                        <span className="mx-1"></span>
                        <span className="text-destructive">BOZOR</span>
                      </span>
                    </SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col gap-2 mt-6">
                    <Button variant="ghost" className="justify-start" onClick={handleMobileAnnouncementsClick}>{t.announcements}</Button>
                    <Button variant="ghost" className="justify-start" onClick={() => handleMobileNavClick('orders')}>{t.orders}</Button>
                    <Button variant="ghost" className="justify-start" onClick={() => handleMobileNavClick('deals')}>{t.deals}</Button>
                    <Button variant="ghost" className="justify-start" onClick={() => handleMobileNavClick('referral')}>{t.referralProgram}</Button>
                    <Button variant="ghost" className="justify-start" onClick={() => handleMobileNavClick('how')}>{t.howItWorks}</Button>
                    <div className="border-t my-4" />
                    <a href="tel:+998939698899" className="flex items-center gap-2 px-4 py-2 text-sm">
                      <Phone className="h-4 w-4" />
                      {t.phone}
                    </a>
                    <a href="https://t.me/Yukbozor_Murojaat_Bot" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 text-sm">
                      <SiTelegram className="h-4 w-4" />
                      {t.telegram}
                    </a>
                    <div className="border-t my-4" />
                    <Button variant="outline" onClick={() => { setMobileMenuOpen(false); setLocation('/login'); }}>
                      {t.signIn}
                    </Button>
                    <Button onClick={() => { setMobileMenuOpen(false); setLocation('/register'); }}>
                      {t.register}
                    </Button>
                  </nav>
                </SheetContent>
              </Sheet>
            )}
          </div>

          {/* Navigation section - centered with justify-between */}
          {!userRole && (
            <nav className="hidden lg:flex items-center justify-center flex-1 gap-0.5 mx-4">
              <Button variant="ghost" size="sm" className="text-sm px-2" onClick={handleAnnouncementsClick} data-testid="link-announcements">{t.announcements}</Button>
              <Button variant="ghost" size="sm" className="text-sm px-2" onClick={() => onSectionChange?.('orders')} data-testid="link-orders">{t.orders}</Button>
              <Button variant="ghost" size="sm" className="text-sm px-2" onClick={() => onSectionChange?.('deals')} data-testid="link-deals">{t.deals}</Button>
              <Button variant="ghost" size="sm" className="text-sm px-2" onClick={() => onSectionChange?.('referral')} data-testid="link-referral">{t.referralProgram}</Button>
              <Button variant="ghost" size="sm" className="text-sm px-2" onClick={() => onSectionChange?.('how')} data-testid="link-how-it-works">{t.howItWorks}</Button>
            </nav>
          )}

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {userRole ? (
              <>
                {representativeMode?.active ? (
                  <div className="flex items-center gap-2 hidden md:flex" data-testid="representative-mode-indicator">
                    <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                      <UserCheck className="h-3 w-3" />
                      {t.representativeMode}
                    </Badge>
                    <span className="text-sm font-medium text-primary" data-testid="text-customer-name">
                      {representativeMode.customerName || representativeMode.companyName}
                    </span>
                  </div>
                ) : userName && (
                  <span className="text-sm font-medium hidden md:inline" data-testid="text-user-name">
                    {userName}
                  </span>
                )}
                <div className="w-3" />
                <NotificationBell language={language} />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLanguageToggle}
                  data-testid="button-language-toggle"
                >
                  <Globe className="h-5 w-5" />
                </Button>
                <span className="text-sm font-medium hidden sm:block">{language.toUpperCase()}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2" data-testid="button-user-menu">
                      {currentRole === 'customer' && <Package className="h-4 w-4" />}
                      {currentRole === 'carrier' && <Truck className="h-4 w-4" />}
                      {currentRole === 'partner' && <Users className="h-4 w-4" />}
                      {currentRole === 'admin' && <ShieldCheck className="h-4 w-4" />}
                      {!currentRole && <User className="h-4 w-4" />}
                      <span className="hidden sm:inline">{roleLabel}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {representativeMode?.active && (
                      <>
                        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal flex items-center gap-1">
                          <UserCheck className="h-3 w-3" />
                          {t.workingAs}: {representativeMode.customerName}
                        </DropdownMenuLabel>
                        <DropdownMenuItem 
                          onClick={async () => {
                            await deactivateRepresentativeMode();
                            setLocation('/customer');
                          }} 
                          data-testid="menu-item-exit-rep-mode"
                          className="gap-2 text-primary focus:text-primary"
                        >
                          <X className="h-4 w-4" />
                          <span>{t.exitRepMode}</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    {roleMenuItems.length > 0 && !representativeMode?.active && (
                      <>
                        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                          {t.switchRole}
                        </DropdownMenuLabel>
                        {roleMenuItems.map(({ role, path, icon: Icon }) => (
                          <DropdownMenuItem 
                            key={role}
                            onClick={async () => {
                              console.log(`[Header] Switching role to ${role}, navigating to ${path}`);
                              queryClient.clear();
                              await refetch();
                              setLocation(path);
                            }} 
                            data-testid={`menu-item-switch-${role}`}
                            disabled={currentRole === role}
                            className="gap-2"
                          >
                            <Icon className="h-4 w-4" />
                            <span>{t[role]}</span>
                            {currentRole === role && (
                              <span className="ml-auto text-xs text-muted-foreground">•</span>
                            )}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem 
                      onClick={handleLogout} 
                      data-testid="menu-item-logout"
                      className="gap-2 text-destructive focus:text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>{t.logout}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                {/* Contact icons with larger gap after */}
                <div className="hidden sm:flex items-center gap-2 mr-6">
                  <a href="https://t.me/Yukbozor_Murojaat_Bot" target="_blank" rel="noopener noreferrer" data-testid="link-telegram">
                    <Button variant="ghost" size="icon">
                      <SiTelegram className="h-5 w-5" />
                    </Button>
                  </a>
                  <a href="tel:+998939698899" className="hidden lg:flex items-center gap-2 hover:text-foreground whitespace-nowrap" data-testid="link-phone-guest">
                    <Phone className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">{t.phone}</span>
                  </a>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLanguageToggle}
                    data-testid="button-language-toggle"
                  >
                    <Globe className="h-5 w-5" />
                  </Button>
                  <span className="text-sm font-medium hidden sm:block">{language.toUpperCase()}</span>
                  {/* Icon-only on very small screens, text on sm+ */}
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setLocation('/login')} 
                    data-testid="button-sign-in"
                    className="sm:hidden"
                  >
                    <LogIn className="h-5 w-5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setLocation('/login')} 
                    data-testid="button-sign-in-text"
                    className="hidden sm:inline-flex"
                  >
                    {t.signIn}
                  </Button>
                  <Button 
                    size="icon"
                    onClick={() => setLocation('/register')} 
                    data-testid="button-register"
                    className="sm:hidden"
                  >
                    <UserPlus className="h-5 w-5" />
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => setLocation('/register')} 
                    data-testid="button-register-text"
                    className="hidden sm:inline-flex"
                  >
                    {t.register}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
