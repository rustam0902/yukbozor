import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Home, 
  Package, 
  FileText, 
  Wallet, 
  Users, 
  Settings,
  TrendingUp,
  UserCheck,
  ClipboardList,
  Link2,
  Ban,
  FolderOpen,
  ChevronRight,
  Receipt,
  Truck,
  ListChecks,
  Send,
  Megaphone,
  LayoutTemplate,
  Building2,
  BellRing,
  BarChart2,
  MessageSquare
} from "lucide-react";

interface AppSidebarProps {
  role: 'customer' | 'carrier' | 'partner' | 'admin';
  language?: 'ru' | 'uz';
  activePath?: string;
  onNavigate?: (path: string) => void;
  userType?: 'legal' | 'ip' | 'individual';
  representativeModeEnabled?: boolean;
}

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  children?: MenuItem[];
}

export default function AppSidebar({ role, language = 'ru', activePath = '/', onNavigate, userType, representativeModeEnabled }: AppSidebarProps) {
  const { setOpenMobile } = useSidebar();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  
  const handleNavigate = (url: string) => {
    setOpenMobile(false);
    onNavigate?.(url);
  };

  const toggleMenu = (title: string) => {
    setOpenMenus(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const texts = {
    ru: {
      customer: {
        title: 'Заказчик',
        dashboard: 'Главная',
        myOrders: 'Мои заказы',
        myContracts: 'Мои договоры',
        documents: 'Мои документы',
        invoice: 'Счет-фактура',
        waybill: 'ТТН',
        deposit: 'Депозит',
        blacklist: 'Чёрный список',
        representatives: 'Мои представители',
        profile: 'Профиль',
        announcements: 'Объявления',
        templates: 'Мои шаблоны',
        principals: 'Мои доверители',
        principalOrders: 'Заказы доверителей',
        principalContracts: 'Договоры доверителей',
        principalDocuments: 'Документы доверителей'
      },
      carrier: {
        title: 'Перевозчик',
        dashboard: 'Главная',
        orders: 'Заказы',
        myOffers: 'Мои предложения',
        contracts: 'Договоры',
        documents: 'Мои документы',
        invoice: 'Счет-фактура',
        waybill: 'ТТН',
        deposit: 'Депозит',
        profile: 'Профиль'
      },
      partner: {
        title: 'Партнёр',
        dashboard: 'Главная',
        myClients: 'Приглашённые',
        commissions: 'Комиссии',
        deposit: 'Депозит',
        referral: 'Реферальная программа',
        profile: 'Профиль'
      },
      admin: {
        title: 'Администратор',
        dashboard: 'Главная',
        orders: 'Заказы',
        announcements: 'Объявления',
        users: 'Пользователи',
        deposits: 'Пополнение счетов',
        withdrawals: 'Выводы средств',
        partners: 'Партнёры',
        rewardStatements: 'Ведомости вознаграждений',
        reports: 'Отчеты',
        telegramChannels: 'Telegram каналы',
        telegramBroadcast: 'Рассылка в Telegram',
        pushNotifications: 'Push-уведомления',
        chatRooms: 'Чат-комнаты',
        analytics: 'Аналитика',
        settings: 'Настройки'
      }
    },
    uz: {
      customer: {
        title: 'Buyurtmachi',
        dashboard: 'Bosh sahifa',
        myOrders: 'Mening buyurtmalarim',
        myContracts: 'Mening shartnomalarim',
        documents: 'Mening hujjatlarim',
        invoice: 'Hisob-faktura',
        waybill: 'TTYu',
        deposit: 'Depozit',
        blacklist: 'Qora ro\'yxat',
        representatives: 'Mening vakillarim',
        profile: 'Profil',
        announcements: 'E\'lonlar',
        templates: 'Shablonlarim',
        principals: 'Ishonch beruvchilarim',
        principalOrders: 'Ishonch beruvchilar buyurtmalari',
        principalContracts: 'Ishonch beruvchilar shartnomalari',
        principalDocuments: 'Ishonch beruvchilar hujjatlari'
      },
      carrier: {
        title: 'Tashuvchi',
        dashboard: 'Bosh sahifa',
        orders: 'Buyurtmalar',
        myOffers: 'Mening takliflarim',
        contracts: 'Shartnomalar',
        documents: 'Mening hujjatlarim',
        invoice: 'Hisob-faktura',
        waybill: 'TTYu',
        deposit: 'Depozit',
        profile: 'Profil'
      },
      partner: {
        title: 'Hamkor',
        dashboard: 'Bosh sahifa',
        myClients: 'Taklif etilganlar',
        commissions: 'Komissiyalar',
        deposit: 'Depozit',
        referral: 'Referal dasturi',
        profile: 'Profil'
      },
      admin: {
        title: 'Administrator',
        dashboard: 'Bosh sahifa',
        orders: 'Buyurtmalar',
        announcements: 'E\'lonlar',
        users: 'Foydalanuvchilar',
        deposits: 'Hisobni to\'ldirish',
        withdrawals: 'Mablag\' yechish',
        partners: 'Hamkorlar',
        rewardStatements: 'Mukofot vedomostlari',
        reports: 'Hisobotlar',
        telegramChannels: 'Telegram kanallari',
        telegramBroadcast: 'Telegram tarqatish',
        pushNotifications: 'Push-bildirishnomalar',
        chatRooms: 'Chat xonalari',
        analytics: 'Tahlil',
        settings: 'Sozlamalar'
      }
    }
  };

  const t = texts[language][role];

  // Different menu items for individual (physical person) customers
  // For individuals, /customer is the announcements page (default)
  // When representativeModeEnabled, show principal-related sections instead of announcements/templates
  const individualCustomerItems: MenuItem[] = representativeModeEnabled
    ? [
        { title: texts[language].customer.principals, url: "/customer/principals", icon: Building2 },
        { title: texts[language].customer.principalOrders, url: "/customer/principal-orders", icon: Package },
        { title: texts[language].customer.principalContracts, url: "/customer/principal-contracts", icon: FileText },
        { title: texts[language].customer.principalDocuments, url: "/customer/principal-documents", icon: FolderOpen },
        { title: texts[language].customer.profile, url: "/customer/profile", icon: Settings },
      ]
    : [
        { title: texts[language].customer.announcements, url: "/customer", icon: Megaphone },
        { title: texts[language].customer.templates, url: "/customer/templates", icon: LayoutTemplate },
        { title: texts[language].customer.profile, url: "/customer/profile", icon: Settings },
      ];

  const legalCustomerItems: MenuItem[] = [
    { title: texts[language].customer.dashboard, url: "/customer", icon: Home },
    { title: texts[language].customer.myOrders, url: "/customer/orders", icon: Package },
    { title: texts[language].customer.myContracts, url: "/customer/contracts", icon: FileText },
    { title: texts[language].customer.documents, url: "/customer/documents", icon: FolderOpen },
    { title: texts[language].customer.deposit, url: "/customer/deposit", icon: Wallet },
    { title: texts[language].customer.blacklist, url: "/customer/blacklist", icon: Ban },
    { title: texts[language].customer.representatives, url: "/customer/representatives", icon: Users },
    { title: texts[language].customer.profile, url: "/customer/profile", icon: Settings },
  ];

  const menuItems: Record<string, MenuItem[]> = {
    customer: userType === 'individual' ? individualCustomerItems : legalCustomerItems,
    carrier: [
      { title: texts[language].carrier.orders, url: "/carrier", icon: ClipboardList },
      { title: texts[language].carrier.myOffers, url: "/carrier/offers", icon: TrendingUp },
      { title: texts[language].carrier.contracts, url: "/carrier/contracts", icon: FileText },
      { title: texts[language].carrier.documents, url: "/carrier/documents", icon: FolderOpen },
      { title: texts[language].carrier.deposit, url: "/carrier/deposit", icon: Wallet },
      { title: texts[language].carrier.profile, url: "/carrier/profile", icon: Settings },
    ],
    partner: [
      { title: texts[language].partner.dashboard, url: "/partner", icon: Home },
      { title: texts[language].partner.myClients, url: "/partner/clients", icon: Users },
      { title: texts[language].partner.commissions, url: "/partner/commissions", icon: TrendingUp },
      { title: texts[language].partner.deposit, url: "/partner/deposit", icon: Wallet },
      { title: texts[language].partner.referral, url: "/partner/referral", icon: Link2 },
      { title: texts[language].partner.profile, url: "/partner/profile", icon: Settings },
    ],
    admin: [
      { title: texts[language].admin.dashboard, url: "/admin", icon: Home },
      { title: texts[language].admin.orders, url: "/admin/orders", icon: Package },
      { title: texts[language].admin.announcements, url: "/admin/announcements", icon: Megaphone },
      { title: texts[language].admin.users, url: "/admin/users", icon: Users },
      { title: texts[language].admin.deposits, url: "/admin/deposits", icon: Wallet },
      { title: texts[language].admin.withdrawals, url: "/admin/withdrawals", icon: Wallet },
      { title: texts[language].admin.partners, url: "/admin/partners", icon: UserCheck },
      { title: texts[language].admin.rewardStatements, url: "/admin/reward-statements", icon: ListChecks },
      { title: texts[language].admin.reports, url: "/admin/reports", icon: FileText },
      { title: texts[language].admin.telegramChannels, url: "/admin/telegram-channels", icon: Send },
      { title: texts[language].admin.telegramBroadcast, url: "/admin/telegram-broadcast", icon: MessageSquare },
      { title: texts[language].admin.pushNotifications, url: "/admin/push-notifications", icon: BellRing },
      { title: texts[language].admin.chatRooms, url: "/admin/chat-rooms", icon: MessageSquare },
      { title: texts[language].admin.analytics, url: "/admin/analytics", icon: BarChart2 },
      { title: texts[language].admin.settings, url: "/admin/settings", icon: Settings },
    ],
  };

  const items = menuItems[role];

  // Admin-only: poll skipped Telegram message count for sidebar badge
  const { data: skippedCountData } = useQuery<{ count: number }>({
    queryKey: ['/api/admin/telegram-skipped-messages/count'],
    enabled: role === 'admin',
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const skippedCount = skippedCountData?.count ?? 0;

  const isChildActive = (item: MenuItem) => {
    if (item.children) {
      return item.children.some(child => activePath === child.url);
    }
    return false;
  };

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t.title}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                item.children ? (
                  <Collapsible 
                    key={item.title} 
                    open={openMenus[item.title] || isChildActive(item)}
                    onOpenChange={() => toggleMenu(item.title)}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton 
                          isActive={isChildActive(item)}
                          data-testid={`link-${item.url}`}
                        >
                          <item.icon />
                          <span>{item.title}</span>
                          <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.children.map((child) => (
                            <SidebarMenuSubItem key={child.title}>
                              <SidebarMenuSubButton
                                isActive={activePath === child.url}
                                onClick={() => handleNavigate(child.url)}
                                data-testid={`link-${child.url}`}
                              >
                                <child.icon className="h-4 w-4" />
                                <span>{child.title}</span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      isActive={activePath === item.url}
                      onClick={() => handleNavigate(item.url)}
                      data-testid={`link-${item.url}`}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                      {role === 'admin' && item.url === '/admin/telegram-channels' && skippedCount > 0 && (
                        <Badge
                          variant="destructive"
                          className="ml-auto"
                          data-testid="badge-skipped-count"
                        >
                          {skippedCount}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
