import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import AppSidebar from '@/components/AppSidebar';
import Header from '@/components/Header';
import { formatMoney } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { 
  useAdminUsers, 
  useAdminUsersWithProfiles, 
  useAdminWithdrawals, 
  useAdminAllWithdrawals, 
  useApproveWithdrawal, 
  useRejectWithdrawal, 
  useChangePassword, 
  useAdminCreditDeposit, 
  useAdminUserDeposits,
  useAdminBalanceReport,
  useAdminUserTransactions,
  searchAdminUsers,
  useAdminOrdersReport,
  useAdminContractsReport,
  useAdminPartnerRewardsReport,
  useAdminPlatformCommissionReport,
  adminDeleteOrder
} from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/dateFormat';
import { formatAmountWithSpaces, parseFormattedAmount, getAmountInWords } from '@/lib/number-to-words';
import { Users, Wallet, UserCheck, FileText, Search, RefreshCw, Settings, Eye, EyeOff, CreditCard, CheckCircle, ChevronLeft, ChevronRight, Pencil, History, Trash2, MessageSquare, Send, ShieldOff, Bell, ExternalLink, AlertCircle, FlaskConical, Flag } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface AdminDashboardProps {
  section?: string;
}

interface AdminDashboardMainProps {
  language: 'ru' | 'uz';
  setLanguage: (lang: 'ru' | 'uz') => void;
  user: any;
  children: React.ReactNode;
}

function AdminDashboardMain({ language, setLanguage, user, children }: AdminDashboardMainProps) {
  const { toggleSidebar } = useSidebar();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Header 
        language={language} 
        onLanguageChange={setLanguage}
        userRole={user.roles}
        currentRole="admin"
        userName={user.displayName}
        onMenuClick={toggleSidebar}
        sticky={false}
      />
      <main className="flex-1 overflow-auto min-h-0 p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}

function DashboardSection({ language }: { language: 'ru' | 'uz' }) {
  const { data: users, isLoading: usersLoading } = useAdminUsers();
  const { data: withdrawals, isLoading: withdrawalsLoading } = useAdminWithdrawals();

  const texts = {
    ru: {
      title: 'Панель администратора',
      overview: 'Обзор',
      totalUsers: 'Всего пользователей',
      pendingWithdrawals: 'Ожидающих выводов',
      customers: 'Заказчиков',
      carriers: 'Перевозчиков',
      partners: 'Партнёров'
    },
    uz: {
      title: 'Administrator paneli',
      overview: 'Umumiy ko\'rinish',
      totalUsers: 'Jami foydalanuvchilar',
      pendingWithdrawals: 'Kutilayotgan yechimlar',
      customers: 'Buyurtmachilar',
      carriers: 'Tashuvchilar',
      partners: 'Hamkorlar'
    }
  };

  const t = texts[language];

  const customerCount = users?.filter((u: any) => u.roles?.includes('customer')).length || 0;
  const carrierCount = users?.filter((u: any) => u.roles?.includes('carrier')).length || 0;
  const partnerCount = users?.filter((u: any) => u.roles?.includes('partner')).length || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold" data-testid="text-admin-title">{t.title}</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-total-users">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.totalUsers}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{users?.length || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-pending-withdrawals">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.pendingWithdrawals}</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {withdrawalsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{withdrawals?.length || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-customers">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.customers}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{customerCount}</div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-carriers">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.carriers}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{carrierCount}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UsersSection({ language }: { language: 'ru' | 'uz' }) {
  const { data: users, isLoading, refetch } = useAdminUsersWithProfiles();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAuditDialog, setShowAuditDialog] = useState(false);
  const [auditUserId, setAuditUserId] = useState<number | null>(null);
  const { toast } = useToast();

  const texts = {
    ru: {
      title: 'Пользователи',
      search: 'Поиск...',
      allRoles: 'Все роли',
      customer: 'Заказчик',
      carrier: 'Перевозчик',
      partner: 'Партнёр',
      admin: 'Админ',
      name: 'Имя',
      phone: 'Телефон',
      roles: 'Роли',
      status: 'Статус',
      registered: 'Регистрация',
      active: 'Активен',
      blocked: 'Заблокирован',
      noUsers: 'Нет пользователей',
      refresh: 'Обновить',
      actions: 'Действия',
      edit: 'Редактировать',
      history: 'История',
      editUser: 'Редактирование пользователя',
      save: 'Сохранить',
      cancel: 'Отмена',
      displayName: 'Отображаемое имя',
      email: 'Email',
      lastName: 'Фамилия',
      firstName: 'Имя',
      middleName: 'Отчество',
      pinfl: 'ПИНФЛ',
      inn: 'ИНН',
      success: 'Данные сохранены',
      error: 'Ошибка сохранения',
      auditHistory: 'История изменений',
      noChanges: 'Изменений не найдено',
      changedBy: 'Изменил',
      changedAt: 'Когда',
      field: 'Поле',
      oldValue: 'Было',
      newValue: 'Стало',
      userType: 'Тип',
      legal: 'Юр. лицо',
      ip: 'ИП',
      individual: 'Физ. лицо'
    },
    uz: {
      title: 'Foydalanuvchilar',
      search: 'Qidirish...',
      allRoles: 'Barcha rollar',
      customer: 'Buyurtmachi',
      carrier: 'Tashuvchi',
      partner: 'Hamkor',
      admin: 'Admin',
      name: 'Ism',
      phone: 'Telefon',
      roles: 'Rollar',
      status: 'Holat',
      registered: 'Ro\'yxatdan o\'tish',
      active: 'Faol',
      blocked: 'Bloklangan',
      noUsers: 'Foydalanuvchilar yo\'q',
      refresh: 'Yangilash',
      actions: 'Amallar',
      edit: 'Tahrirlash',
      history: 'Tarix',
      editUser: 'Foydalanuvchini tahrirlash',
      save: 'Saqlash',
      cancel: 'Bekor qilish',
      displayName: 'Ko\'rsatiladigan ism',
      email: 'Email',
      lastName: 'Familiya',
      firstName: 'Ism',
      middleName: 'Otasining ismi',
      pinfl: 'JSHSHIR',
      inn: 'STIR',
      success: 'Ma\'lumotlar saqlandi',
      error: 'Saqlashda xatolik',
      auditHistory: 'O\'zgarishlar tarixi',
      noChanges: 'O\'zgarishlar topilmadi',
      changedBy: 'O\'zgartirgan',
      changedAt: 'Qachon',
      field: 'Maydon',
      oldValue: 'Eski qiymat',
      newValue: 'Yangi qiymat',
      userType: 'Turi',
      legal: 'Yuridik shaxs',
      ip: 'YTT',
      individual: 'Jismoniy shaxs'
    }
  };

  const t = texts[language];

  const filteredUsers = users?.filter((user: any) => {
    const matchesSearch = 
      user.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone?.includes(searchQuery);
    
    const matchesRole = roleFilter === 'all' || user.roles?.includes(roleFilter);
    
    return matchesSearch && matchesRole;
  }) || [];

  const getRoleBadge = (role: string) => {
    const roleTexts: Record<string, string> = {
      customer: t.customer,
      carrier: t.carrier,
      partner: t.partner,
      admin: t.admin
    };
    return roleTexts[role] || role;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold" data-testid="text-users-title">{t.title}</h1>
        <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-users">
          <RefreshCw className="h-4 w-4 mr-2" />
          {t.refresh}
        </Button>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-users"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-role-filter">
            <SelectValue placeholder={t.allRoles} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allRoles}</SelectItem>
            <SelectItem value="customer">{t.customer}</SelectItem>
            <SelectItem value="carrier">{t.carrier}</SelectItem>
            <SelectItem value="partner">{t.partner}</SelectItem>
            <SelectItem value="admin">{t.admin}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : filteredUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.name}</TableHead>
                  <TableHead>{t.phone}</TableHead>
                  <TableHead>{t.userType}</TableHead>
                  <TableHead>{t.roles}</TableHead>
                  <TableHead>{t.status}</TableHead>
                  <TableHead>{t.registered}</TableHead>
                  <TableHead>{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user: any) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell className="font-medium">{user.displayName || '-'}</TableCell>
                    <TableCell>{user.phone}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {user.userType === 'legal' ? t.legal : user.userType === 'ip' ? t.ip : t.individual}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles?.map((role: string) => (
                          <Badge key={role} variant="secondary" className="text-xs">
                            {getRoleBadge(role)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={user.isBlocked ? "bg-red-500" : "bg-green-500"}>
                        {user.isBlocked ? t.blocked : t.active}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.createdAt ? formatDate(user.createdAt) : '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => { setEditingUser(user); setShowEditDialog(true); }}
                          data-testid={`button-edit-user-${user.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => { setAuditUserId(user.id); setShowAuditDialog(true); }}
                          data-testid={`button-history-user-${user.id}`}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        {(user.telegramUsername || user.telegramId) && (
                          <a
                            href={user.telegramUsername ? `https://t.me/${user.telegramUsername}` : `tg://user?id=${user.telegramId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={language === 'ru' ? 'Написать в Telegram' : 'Telegramda yozish'}
                            className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent text-[#2AABEE]"
                            data-testid={`button-telegram-user-${user.id}`}
                          >
                            <Send className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {t.noUsers}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.editUser}</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <EditUserForm 
              user={editingUser} 
              language={language} 
              texts={t}
              onSuccess={() => {
                setShowEditDialog(false);
                setEditingUser(null);
                refetch();
                toast({ title: t.success });
              }}
              onCancel={() => {
                setShowEditDialog(false);
                setEditingUser(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Audit History Dialog */}
      <Dialog open={showAuditDialog} onOpenChange={setShowAuditDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.auditHistory}</DialogTitle>
          </DialogHeader>
          {auditUserId && (
            <AuditHistoryView 
              userId={auditUserId} 
              language={language} 
              texts={t}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Edit User Form Component
function EditUserForm({ user, language, texts, onSuccess, onCancel }: { 
  user: any; 
  language: 'ru' | 'uz'; 
  texts: any;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [phone, setPhone] = useState(user.phone || '');
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [email, setEmail] = useState(user.email || '');
  const [lastName, setLastName] = useState(user.lastName || '');
  const [firstName, setFirstName] = useState(user.firstName || '');
  const [middleName, setMiddleName] = useState(user.middleName || '');
  const [pinfl, setPinfl] = useState(user.pinfl || '');
  const [inn, setInn] = useState(user.inn || '');
  const [userType, setUserType] = useState(user.userType || 'individual');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone,
          displayName,
          email: email || null,
          lastName: lastName || null,
          firstName: firstName || null,
          middleName: middleName || null,
          pinfl: pinfl || null,
          inn: inn || null,
          userType,
          language
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || texts.error);
        return;
      }

      onSuccess();
    } catch (err) {
      setError(texts.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">{texts.phone} *</label>
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+998901234567"
          required
          data-testid="input-edit-phone"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{texts.userType}</label>
        <Select value={userType} onValueChange={setUserType}>
          <SelectTrigger data-testid="select-edit-userType">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="individual">{texts.individual}</SelectItem>
            <SelectItem value="ip">{texts.ip}</SelectItem>
            <SelectItem value="legal">{texts.legal}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{texts.displayName} *</label>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          data-testid="input-edit-displayName"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{texts.email}</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="input-edit-email"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">{texts.lastName}</label>
          <Input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            data-testid="input-edit-lastName"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{texts.firstName}</label>
          <Input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            data-testid="input-edit-firstName"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{texts.middleName}</label>
          <Input
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
            data-testid="input-edit-middleName"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">{texts.pinfl}</label>
          <Input
            value={pinfl}
            onChange={(e) => setPinfl(e.target.value)}
            placeholder="14 цифр"
            maxLength={14}
            data-testid="input-edit-pinfl"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{texts.inn}</label>
          <Input
            value={inn}
            onChange={(e) => setInn(e.target.value)}
            placeholder="9 цифр"
            maxLength={9}
            data-testid="input-edit-inn"
          />
        </div>
      </div>

      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {texts.cancel}
        </Button>
        <Button type="submit" disabled={isSubmitting} data-testid="button-save-user">
          {isSubmitting ? '...' : texts.save}
        </Button>
      </div>
    </form>
  );
}

// Audit History View Component
function AuditHistoryView({ userId, language, texts }: { 
  userId: number; 
  language: 'ru' | 'uz';
  texts: any;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/admin/users', userId, 'audit'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${userId}/audit`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      return response.json();
    }
  });

  const fieldLabels: Record<string, string> = {
    phone: texts.phone,
    displayName: texts.displayName,
    email: texts.email,
    lastName: texts.lastName,
    firstName: texts.firstName,
    middleName: texts.middleName,
    companyName: language === 'uz' ? 'Kompaniya nomi' : 'Название компании',
    inn: 'ИНН/СТИР',
    pinfl: 'ПИНФЛ/ЖШШИР',
    bankAccount: language === 'uz' ? 'Bank hisobi' : 'Банк. счёт',
    bankName: language === 'uz' ? 'Bank nomi' : 'Название банка',
    bankCode: language === 'uz' ? 'Bank kodi' : 'Код банка',
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!data?.auditLogs?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {texts.noChanges}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.auditLogs.map((log: any, index: number) => (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{texts.changedBy}:</span> {log.adminName}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatDate(log.createdAt, true)}
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{texts.field}</TableHead>
                  <TableHead>{texts.oldValue}</TableHead>
                  <TableHead>{texts.newValue}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {log.changes?.map((change: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      {fieldLabels[change.field] || change.field}
                    </TableCell>
                    <TableCell className="text-red-600">
                      {change.oldValue || '-'}
                    </TableCell>
                    <TableCell className="text-green-600">
                      {change.newValue || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DepositsSection({ language }: { language: 'ru' | 'uz' }) {
  const { data: users, isLoading: usersLoading } = useAdminUsersWithProfiles();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const creditDeposit = useAdminCreditDeposit();
  const { data: userDeposits, isLoading: depositsLoading } = useAdminUserDeposits(selectedUserId || 0);
  const { toast } = useToast();

  const texts = {
    ru: {
      title: 'Пополнение счетов',
      selectUser: 'Выберите пользователя',
      searchUser: 'Поиск по имени, телефону, ИНН/ПИНФЛ или р/с...',
      amount: 'Сумма (сум)',
      reference: 'Назначение платежа',
      referencePlaceholder: 'Номер платёжного поручения или комментарий',
      credit: 'Пополнить счёт',
      currentBalance: 'Текущий баланс',
      mainAccount: 'Основной счёт',
      success: 'Счёт успешно пополнен',
      error: 'Ошибка при пополнении',
      sum: 'сум',
      noUsers: 'Пользователи не найдены',
      userInfo: 'Информация о пользователе',
      phone: 'Телефон',
      inn: 'ИНН',
      pinfl: 'ПИНФЛ',
      bankAccount: 'Р/счёт',
      amountInWords: 'Сумма прописью',
      confirmTitle: 'Подтверждение пополнения',
      confirmMessage: 'Вы действительно хотите пополнить счёт клиента',
      confirmAmount: 'на сумму',
      confirmYes: 'Да, пополнить',
      confirmNo: 'Отменить'
    },
    uz: {
      title: 'Hisobni to\'ldirish',
      selectUser: 'Foydalanuvchini tanlang',
      searchUser: 'Ism, telefon, INN/PINFL yoki h/r bo\'yicha qidirish...',
      amount: 'Summa (so\'m)',
      reference: 'To\'lov maqsadi',
      referencePlaceholder: 'To\'lov topshiriqnomasi raqami yoki izoh',
      credit: 'Hisobni to\'ldirish',
      currentBalance: 'Joriy balans',
      mainAccount: 'Asosiy hisob',
      success: 'Hisob muvaffaqiyatli to\'ldirildi',
      error: 'To\'ldirishda xato',
      sum: 'so\'m',
      noUsers: 'Foydalanuvchilar topilmadi',
      userInfo: 'Foydalanuvchi ma\'lumotlari',
      phone: 'Telefon',
      inn: 'INN',
      pinfl: 'PINFL',
      bankAccount: 'H/r',
      amountInWords: 'Yozuv bilan summa',
      confirmTitle: 'Hisobni to\'ldirishni tasdiqlash',
      confirmMessage: 'Mijoz hisobini to\'ldirishni tasdiqlaysizmi',
      confirmAmount: 'summasi',
      confirmYes: 'Ha, to\'ldirish',
      confirmNo: 'Bekor qilish'
    }
  };

  const t = texts[language];

  const filteredUsers = users?.filter((user: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase().trim();
    const nameMatch = user.displayName?.toLowerCase().includes(query);
    const phoneMatch = user.phone?.includes(query);
    const innMatch = user.inn ? String(user.inn).includes(query) : false;
    const pinflMatch = user.pinfl ? String(user.pinfl).includes(query) : false;
    const bankMatch = user.bankAccount ? String(user.bankAccount).includes(query) : false;
    return nameMatch || phoneMatch || innMatch || pinflMatch || bankMatch;
  }) || [];

  const selectedUser = users?.find((u: any) => u.id === selectedUserId);

  const handleCredit = async () => {
    if (!selectedUserId || !amount) return;
    
    const amountNum = parseFormattedAmount(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: language === 'uz' ? 'Noto\'g\'ri summa' : 'Неверная сумма', variant: 'destructive' });
      return;
    }
    
    try {
      const result = await creditDeposit.mutateAsync({
        userId: selectedUserId,
        amount: amountNum,
        reference: reference || undefined,
        language,
      });
      toast({ title: t.success });
      setAmount('');
      setReference('');
      setConfirmDialogOpen(false);
    } catch (error: any) {
      toast({ title: error.message || t.error, variant: 'destructive' });
      setConfirmDialogOpen(false);
    }
  };

  const mainBalance = userDeposits?.deposits?.find((d: any) => d.accountType === 'main')?.balance || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold" data-testid="text-deposits-title">{t.title}</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t.selectUser}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.searchUser}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-user-deposits"
              />
            </div>
            
            <div className="max-h-[300px] overflow-y-auto border rounded-md">
              {usersLoading ? (
                <div className="p-4 space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user: any) => (
                  <div
                    key={user.id}
                    className={`p-3 cursor-pointer hover-elevate border-b last:border-b-0 ${selectedUserId === user.id ? 'bg-primary/10' : ''}`}
                    onClick={() => setSelectedUserId(user.id)}
                    data-testid={`select-user-${user.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{user.displayName || 'Без имени'}</div>
                        <div className="text-sm text-muted-foreground">{user.phone}</div>
                        {(user.inn || user.pinfl || user.bankAccount) && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {user.inn && <span className="mr-2">ИНН: {user.inn}</span>}
                            {user.pinfl && <span className="mr-2">ПИНФЛ: {user.pinfl}</span>}
                            {user.bankAccount && <span>Р/с: {user.bankAccount}</span>}
                          </div>
                        )}
                      </div>
                      {selectedUserId === user.id && (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-muted-foreground">{t.noUsers}</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t.credit}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedUser && (
              <div className="p-4 bg-muted rounded-md space-y-2">
                <div className="font-medium">{t.userInfo}</div>
                <div className="text-sm">
                  <span className="text-muted-foreground">ID:</span> {selectedUser.id}
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">{t.phone}:</span> {selectedUser.phone}
                </div>
                {selectedUser.inn && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">{t.inn}:</span> {selectedUser.inn}
                  </div>
                )}
                {selectedUser.pinfl && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">{t.pinfl}:</span> {selectedUser.pinfl}
                  </div>
                )}
                {selectedUser.bankAccount && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">{t.bankAccount}:</span> {selectedUser.bankAccount}
                  </div>
                )}
                {!depositsLoading && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">{t.currentBalance}:</span>{' '}
                    <span className="font-medium">{formatMoney(mainBalance)} {t.sum}</span>
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.amount}</label>
              <Input
                type="text"
                value={formatAmountWithSpaces(amount, true)}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
                  setAmount(value);
                }}
                placeholder="100 000.00"
                disabled={!selectedUserId}
                data-testid="input-credit-amount"
              />
              {amount && parseFormattedAmount(amount, true) > 0 && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">{t.amountInWords}:</span>{' '}
                  {getAmountInWords(Math.floor(parseFormattedAmount(amount, true)), language)}
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.reference}</label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={t.referencePlaceholder}
                disabled={!selectedUserId}
                data-testid="input-credit-reference"
              />
            </div>
            
            <Button
              className="w-full"
              onClick={() => setConfirmDialogOpen(true)}
              disabled={!selectedUserId || !amount || creditDeposit.isPending}
              data-testid="button-credit-deposit"
            >
              {creditDeposit.isPending ? '...' : t.credit}
            </Button>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent data-testid="dialog-confirm-credit">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                {t.confirmMessage} <strong>{selectedUser?.displayName || selectedUser?.phone}</strong> {t.confirmAmount}:
              </p>
              <p className="text-lg font-bold text-primary">
                {formatMoney(parseFormattedAmount(amount, true))} {t.sum}
              </p>
              {amount && parseFormattedAmount(amount, true) > 0 && (
                <p className="text-sm text-muted-foreground">
                  ({getAmountInWords(Math.floor(parseFormattedAmount(amount, true)), language)})
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-credit">
              {t.confirmNo}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCredit}
              disabled={creditDeposit.isPending}
              data-testid="button-confirm-credit"
            >
              {creditDeposit.isPending ? '...' : t.confirmYes}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function WithdrawalsSection({ language }: { language: 'ru' | 'uz' }) {
  const { data: pendingWithdrawals, isLoading: pendingLoading } = useAdminWithdrawals();
  const { data: allWithdrawals, isLoading: allLoading } = useAdminAllWithdrawals();
  const approveWithdrawal = useApproveWithdrawal();
  const rejectWithdrawal = useRejectWithdrawal();
  const { toast } = useToast();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [withdrawalToReject, setWithdrawalToReject] = useState<any>(null);

  const texts = {
    ru: {
      title: 'Заявки на вывод средств',
      user: 'Пользователь',
      amount: 'Сумма',
      bankDetails: 'Реквизиты',
      sourceAccount: 'Счёт',
      date: 'Дата',
      status: 'Статус',
      actions: 'Действия',
      pending: 'Ожидает',
      processing: 'В обработке',
      completed: 'Завершён',
      rejected: 'Отклонён',
      approve: 'Завершить',
      reject: 'Отклонить',
      currency: 'сум',
      noWithdrawals: 'Нет заявок на вывод средств',
      approved: 'Вывод завершён',
      rejectedMsg: 'Заявка отклонена',
      error: 'Ошибка',
      main: 'Основной',
      partner_reward: 'Партнёрский',
      noBankDetails: 'Не указаны',
      inn: 'ИНН',
      pinfl: 'ПИНФЛ',
      cardNumber: 'Номер карты',
      cardExpiry: 'Срок',
      mfo: 'МФО',
      tabPending: 'Ожидают',
      tabCompleted: 'Завершённые',
      tabRejected: 'Отклонённые',
      rejectConfirmTitle: 'Подтверждение отклонения',
      rejectConfirmDesc: 'Вы уверены, что хотите отклонить заявку на вывод? Средства будут возвращены на счёт пользователя.',
      cancel: 'Отмена',
      confirm: 'Отклонить'
    },
    uz: {
      title: 'Mablag\' yechish so\'rovlari',
      user: 'Foydalanuvchi',
      amount: 'Summa',
      bankDetails: 'Rekvizitlar',
      sourceAccount: 'Hisob',
      date: 'Sana',
      status: 'Holat',
      actions: 'Harakatlar',
      pending: 'Kutilmoqda',
      processing: 'Ishlanmoqda',
      completed: 'Yakunlangan',
      rejected: 'Rad etilgan',
      approve: 'Yakunlash',
      reject: 'Rad etish',
      currency: 'so\'m',
      noWithdrawals: 'Mablag\' yechish so\'rovlari yo\'q',
      approved: 'Yechish yakunlandi',
      rejectedMsg: 'So\'rov rad etildi',
      error: 'Xato',
      main: 'Asosiy',
      partner_reward: 'Hamkorlik',
      noBankDetails: 'Ko\'rsatilmagan',
      inn: 'STIR',
      pinfl: 'JSHSHIR',
      cardNumber: 'Karta raqami',
      cardExpiry: 'Muddati',
      mfo: 'MFO',
      tabPending: 'Kutilmoqda',
      tabCompleted: 'Yakunlangan',
      tabRejected: 'Rad etilgan',
      rejectConfirmTitle: 'Rad etishni tasdiqlash',
      rejectConfirmDesc: 'Siz mablag\' yechish so\'rovini rad etmoqchimisiz? Mablag\'lar foydalanuvchi hisobiga qaytariladi.',
      cancel: 'Bekor qilish',
      confirm: 'Rad etish'
    }
  };

  const t = texts[language];

  // Filter withdrawals by status
  const completedWithdrawals = allWithdrawals?.filter((w: any) => w.status === 'completed') || [];
  const rejectedWithdrawals = allWithdrawals?.filter((w: any) => w.status === 'rejected') || [];

  const handleApprove = async (id: number) => {
    try {
      await approveWithdrawal.mutateAsync(id);
      toast({ title: t.approved });
    } catch (error) {
      toast({ title: t.error, variant: 'destructive' });
    }
  };

  const openRejectDialog = (withdrawal: any) => {
    setWithdrawalToReject(withdrawal);
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!withdrawalToReject) return;
    try {
      await rejectWithdrawal.mutateAsync(withdrawalToReject.id);
      toast({ title: t.rejectedMsg });
    } catch (error) {
      toast({ title: t.error, variant: 'destructive' });
    } finally {
      setRejectDialogOpen(false);
      setWithdrawalToReject(null);
    }
  };

  const getSourceAccountLabel = (type: string) => {
    if (type === 'main') return t.main;
    if (type === 'partner_reward') return t.partner_reward;
    return type;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'pending') {
      return <Badge className="bg-yellow-500 text-white no-default-hover-elevate no-default-active-elevate">{t.pending}</Badge>;
    }
    if (status === 'processing') {
      return <Badge className="bg-blue-500 text-white no-default-hover-elevate no-default-active-elevate">{t.processing}</Badge>;
    }
    if (status === 'completed') {
      return <Badge className="bg-green-500 text-white no-default-hover-elevate no-default-active-elevate">{t.completed}</Badge>;
    }
    if (status === 'rejected') {
      return <Badge className="bg-red-500 text-white no-default-hover-elevate no-default-active-elevate">{t.rejected}</Badge>;
    }
    return <Badge>{status}</Badge>;
  };

  const renderWithdrawalRow = (withdrawal: any, showActions: boolean = false) => (
    <TableRow key={withdrawal.id} data-testid={`row-withdrawal-${withdrawal.id}`}>
      <TableCell>
        <div className="font-medium">{withdrawal.user?.displayName || '-'}</div>
        <div className="text-xs text-muted-foreground">{withdrawal.user?.phone}</div>
        {withdrawal.profile?.companyName && (
          <div className="text-xs text-muted-foreground">{withdrawal.profile.companyName}</div>
        )}
        {(withdrawal.recipientInn || withdrawal.recipientPinfl) && (
          <div className="text-xs text-muted-foreground">
            {withdrawal.recipientInn ? `${t.inn}: ${withdrawal.recipientInn}` : `${t.pinfl}: ${withdrawal.recipientPinfl}`}
          </div>
        )}
      </TableCell>
      <TableCell className="font-medium">{formatMoney(withdrawal.amount)} {t.currency}</TableCell>
      <TableCell>
        <Badge variant="outline">{getSourceAccountLabel(withdrawal.sourceAccountType)}</Badge>
      </TableCell>
      <TableCell>
        {withdrawal.cardNumber ? (
          <div className="text-sm">
            <div className="font-mono">{withdrawal.cardNumber.replace(/(\d{4})/g, '$1 ').trim()}</div>
            <div className="text-xs text-muted-foreground">{t.cardExpiry}: {withdrawal.cardExpiry}</div>
          </div>
        ) : withdrawal.bankAccount ? (
          <div className="text-sm">
            <div className="font-mono">{withdrawal.bankAccount}</div>
            <div className="text-xs text-muted-foreground">{withdrawal.bankName || '-'}</div>
            {withdrawal.bankCode && (
              <div className="text-xs text-muted-foreground">{t.mfo}: {withdrawal.bankCode}</div>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">{t.noBankDetails}</span>
        )}
      </TableCell>
      <TableCell>{formatDate(withdrawal.createdAt)}</TableCell>
      <TableCell>
        {getStatusBadge(withdrawal.status)}
      </TableCell>
      {showActions && (
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            <Button 
              size="sm" 
              onClick={() => handleApprove(withdrawal.id)}
              disabled={approveWithdrawal.isPending}
              data-testid={`button-approve-${withdrawal.id}`}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              {t.approve}
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => openRejectDialog(withdrawal)}
              disabled={rejectWithdrawal.isPending}
              data-testid={`button-reject-${withdrawal.id}`}
            >
              {t.reject}
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );

  const renderTable = (withdrawals: any[], showActions: boolean = false, isLoading: boolean = false) => (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : withdrawals && withdrawals.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.user}</TableHead>
                <TableHead>{t.amount}</TableHead>
                <TableHead>{t.sourceAccount}</TableHead>
                <TableHead>{t.bankDetails}</TableHead>
                <TableHead>{t.date}</TableHead>
                <TableHead>{t.status}</TableHead>
                {showActions && <TableHead className="text-right">{t.actions}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawals.map((withdrawal: any) => renderWithdrawalRow(withdrawal, showActions))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            {t.noWithdrawals}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold" data-testid="text-withdrawals-title">{t.title}</h1>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">
            {t.tabPending} {pendingWithdrawals?.length ? `(${pendingWithdrawals.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            {t.tabCompleted} {completedWithdrawals.length ? `(${completedWithdrawals.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-rejected">
            {t.tabRejected} {rejectedWithdrawals.length ? `(${rejectedWithdrawals.length})` : ''}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending" className="mt-4">
          {renderTable(pendingWithdrawals || [], true, pendingLoading)}
        </TabsContent>
        
        <TabsContent value="completed" className="mt-4">
          {renderTable(completedWithdrawals, false, allLoading)}
        </TabsContent>
        
        <TabsContent value="rejected" className="mt-4">
          {renderTable(rejectedWithdrawals, false, allLoading)}
        </TabsContent>
      </Tabs>

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.rejectConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.rejectConfirmDesc}
              {withdrawalToReject && (
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  <div>{withdrawalToReject.user?.displayName} - {formatMoney(withdrawalToReject.amount)} {t.currency}</div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-reject">{t.cancel}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRejectConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-reject"
            >
              {t.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PartnersSection({ language }: { language: 'ru' | 'uz' }) {
  const { data: users, isLoading } = useAdminUsers();
  const [searchQuery, setSearchQuery] = useState('');

  const texts = {
    ru: {
      title: 'Партнёры',
      search: 'Поиск...',
      name: 'Имя',
      phone: 'Телефон',
      referralCode: 'Реф. код',
      clients: 'Клиентов',
      registered: 'Регистрация',
      noPartners: 'Нет партнёров'
    },
    uz: {
      title: 'Hamkorlar',
      search: 'Qidirish...',
      name: 'Ism',
      phone: 'Telefon',
      referralCode: 'Ref. kod',
      clients: 'Mijozlar',
      registered: 'Ro\'yxatdan o\'tish',
      noPartners: 'Hamkorlar yo\'q'
    }
  };

  const t = texts[language];

  const partners = users?.filter((user: any) => user.roles?.includes('partner')) || [];
  
  const filteredPartners = partners.filter((partner: any) => {
    return partner.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      partner.phone?.includes(searchQuery);
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold" data-testid="text-partners-title">{t.title}</h1>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t.search}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-partners"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : filteredPartners.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.name}</TableHead>
                  <TableHead>{t.phone}</TableHead>
                  <TableHead>{t.referralCode}</TableHead>
                  <TableHead>{t.clients}</TableHead>
                  <TableHead>{t.registered}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPartners.map((partner: any) => (
                  <TableRow key={partner.id} data-testid={`row-partner-${partner.id}`}>
                    <TableCell className="font-medium">{partner.displayName || '-'}</TableCell>
                    <TableCell>{partner.phone}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{partner.referralCode || '-'}</Badge>
                    </TableCell>
                    <TableCell>{partner.referredUsersCount || 0}</TableCell>
                    <TableCell>{partner.createdAt ? formatDate(partner.createdAt) : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {t.noPartners}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsSection({ language }: { language: 'ru' | 'uz' }) {
  const [activeTab, setActiveTab] = useState('balances');
  const [balanceDate, setBalanceDate] = useState(new Date().toISOString().split('T')[0]);
  const rewardsScrollRef = useRef<HTMLDivElement>(null);
  const commissionScrollRef = useRef<HTMLDivElement>(null);

  const scrollTable = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = direction === 'right' ? 200 : -200;
      ref.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };
  const [balanceSearch, setBalanceSearch] = useState('');
  const [balancePage, setBalancePage] = useState(1);
  const balancePageSize = 20;
  const [turnoverStartDate, setTurnoverStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [turnoverEndDate, setTurnoverEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [turnoverUserSearch, setTurnoverUserSearch] = useState('');
  const [turnoverUserResults, setTurnoverUserResults] = useState<any[]>([]);
  const [turnoverSelectedUser, setTurnoverSelectedUser] = useState<any>(null);
  const [turnoverSearchLoading, setTurnoverSearchLoading] = useState(false);
  const [turnoverSelectedAccount, setTurnoverSelectedAccount] = useState<string>('main');
  const [ordersStartDate, setOrdersStartDate] = useState('');
  const [ordersEndDate, setOrdersEndDate] = useState('');
  const [ordersStatus, setOrdersStatus] = useState<string[]>([]);
  const [ordersSearch, setOrdersSearch] = useState('');
  const [ordersPage, setOrdersPage] = useState(1);
  const [contractsStartDate, setContractsStartDate] = useState('');
  const [contractsEndDate, setContractsEndDate] = useState('');
  const [contractsStatus, setContractsStatus] = useState<string[]>([]);
  const [contractsSearch, setContractsSearch] = useState('');
  const [contractsPage, setContractsPage] = useState(1);
  const [rewardsStartDate, setRewardsStartDate] = useState('');
  const [rewardsEndDate, setRewardsEndDate] = useState('');
  const [rewardsPage, setRewardsPage] = useState(1);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [commissionStartDate, setCommissionStartDate] = useState('');
  const [commissionEndDate, setCommissionEndDate] = useState('');
  const [commissionStatus, setCommissionStatus] = useState<string[]>([]);
  const [commissionPage, setCommissionPage] = useState(1);
  const [isExportingCommissionExcel, setIsExportingCommissionExcel] = useState(false);
  const [deleteOrderId, setDeleteOrderId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const pageSize = 20;

  const balanceReport = useAdminBalanceReport(balanceDate);
  const userTransactionsReport = useAdminUserTransactions(
    turnoverSelectedUser?.id || null,
    turnoverStartDate,
    turnoverEndDate
  );
  const ordersReport = useAdminOrdersReport({
    startDate: ordersStartDate || undefined,
    endDate: ordersEndDate || undefined,
    status: ordersStatus.length > 0 ? ordersStatus : undefined,
    includeDeleted: ordersStatus.includes('deleted'),
    page: ordersPage,
    pageSize
  });
  const contractsReport = useAdminContractsReport({
    startDate: contractsStartDate || undefined,
    endDate: contractsEndDate || undefined,
    status: contractsStatus.length > 0 ? contractsStatus : undefined,
    page: contractsPage,
    pageSize
  });
  const rewardsReport = useAdminPartnerRewardsReport({
    startDate: rewardsStartDate || undefined,
    endDate: rewardsEndDate || undefined,
    page: rewardsPage,
    pageSize
  });
  const commissionReport = useAdminPlatformCommissionReport({
    startDate: commissionStartDate || undefined,
    endDate: commissionEndDate || undefined,
    status: commissionStatus.length > 0 ? commissionStatus : undefined,
    page: commissionPage,
    pageSize
  });

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const params = new URLSearchParams();
      if (rewardsStartDate) params.append('startDate', rewardsStartDate);
      if (rewardsEndDate) params.append('endDate', rewardsEndDate);
      params.append('language', language);
      
      const res = await fetch(`/api/admin/reports/partner-rewards/excel?${params.toString()}`, { 
        credentials: 'include' 
      });
      
      if (!res.ok) {
        throw new Error('Failed to generate Excel');
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = language === 'uz' 
        ? `partner_mukofotlar_${new Date().toISOString().split('T')[0]}.xlsx`
        : `partner_voznagrazhdeniya_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Excel export error:', error);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportCommissionExcel = async () => {
    setIsExportingCommissionExcel(true);
    try {
      const params = new URLSearchParams();
      if (commissionStartDate) params.append('startDate', commissionStartDate);
      if (commissionEndDate) params.append('endDate', commissionEndDate);
      if (commissionStatus.length > 0) {
        commissionStatus.forEach(s => params.append('status', s));
      }
      params.append('language', language);
      
      const res = await fetch(`/api/admin/reports/platform-commission/excel?${params.toString()}`, { 
        credentials: 'include' 
      });
      
      if (!res.ok) {
        throw new Error('Failed to generate Excel');
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = language === 'uz' 
        ? `platforma_komissiyasi_${new Date().toISOString().split('T')[0]}.xlsx`
        : `komissiya_platformy_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Commission Excel export error:', error);
    } finally {
      setIsExportingCommissionExcel(false);
    }
  };

  const toggleCommissionStatus = (status: string) => {
    setCommissionStatus(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
    setCommissionPage(1);
  };

  const orderStatuses = ['new', 'assigned', 'completed', 'cancelled', 'deleted'];
  const contractStatuses = ['awaiting_prepayment', 'prepayment_made', 'awaiting_completion_confirmation', 'closed', 'termination_pending', 'terminated'];

  const statusLabels = {
    ru: {
      new: 'Новый',
      assigned: 'Назначен',
      completed: 'Завершён',
      cancelled: 'Отменён',
      deleted: 'Удалён',
      awaiting_prepayment: 'Ожидает предоплату',
      prepayment_made: 'Предоплата внесена',
      awaiting_completion_confirmation: 'Ожидает подтверждения',
      closed: 'Закрыт',
      termination_pending: 'Ожидает расторжения',
      terminated: 'Расторгнут'
    },
    uz: {
      new: 'Yangi',
      assigned: 'Tayinlangan',
      completed: 'Tugallangan',
      cancelled: 'Bekor qilingan',
      deleted: 'O\'chirilgan',
      awaiting_prepayment: 'Oldindan to\'lovni kutmoqda',
      prepayment_made: 'Oldindan to\'lov qilingan',
      awaiting_completion_confirmation: 'Tasdiqlashni kutmoqda',
      closed: 'Yopilgan',
      termination_pending: 'Bekor qilishni kutmoqda',
      terminated: 'Bekor qilingan'
    }
  };

  const texts = {
    ru: {
      title: 'Отчеты',
      balances: 'Балансы',
      turnovers: 'Обороты',
      orders: 'Заказы',
      contracts: 'Договоры',
      partnerRewards: 'Вознаграждения',
      platformCommission: 'Комиссия платформы',
      exportExcel: 'Скачать Excel',
      carrierInnPinfl: 'ИНН/ПИНФЛ перевозчика',
      orderNumber: 'Номер заказа',
      orderDate: 'Дата заказа',
      commissionAmount: 'Начисленная комиссия',
      commissionFromMain: 'С основного счёта',
      commissionFromBonus: 'С бонусного счёта',
      totalCommission: 'Итого комиссия',
      noCommissions: 'Нет данных о комиссии',
      lastName: 'Фамилия',
      firstName: 'Имя',
      middleName: 'Отчество',
      companyName: 'Организация',
      inn: 'ИНН',
      pinfl: 'ПИНФЛ',
      contractNumber: 'Номер договора',
      contractDate: 'Дата договора',
      contractAmount: 'Сумма договора',
      contractStatus: 'Статус договора',
      rewardAmount: 'Начисленное вознаграждение',
      noRewards: 'Нет данных о вознаграждениях',
      asOfDate: 'На дату',
      period: 'Период',
      from: 'С',
      to: 'По',
      apply: 'Применить',
      userId: 'ID пользователя',
      userName: 'Название пользователя',
      mainBalance: 'Основной',
      blockedBalance: 'Заблокировано',
      inTransitBalance: 'В пути',
      partnerReward: 'Партнёрские',
      totalBalance: 'Всего',
      credit: 'Приход',
      debit: 'Расход',
      noData: 'Нет данных',
      orderId: 'ID заказа',
      status: 'Статус',
      price: 'Цена с НДС',
      createdAt: 'Создан',
      customer: 'Заказчик',
      contractId: 'ID договора',
      carrier: 'Перевозчик',
      signedAt: 'Подписан',
      page: 'Страница',
      of: 'из',
      prev: 'Назад',
      next: 'Вперёд',
      loading: 'Загрузка...',
      summary: 'Итого по системе',
      totalMain: 'Основные счета',
      totalBlocked: 'Заблокировано',
      totalInTransit: 'В пути',
      totalPartner: 'Партнёрские',
      grandTotal: 'Общий баланс',
      totalCredit: 'Всего приход',
      totalDebit: 'Всего расход',
      netChange: 'Чистое изменение',
      totalOrders: 'Всего заказов',
      totalContracts: 'Всего договоров',
      search: 'Поиск по имени или ID',
      allStatuses: 'Все статусы',
      filterByStatus: 'Фильтр по статусу',
      clear: 'Сбросить',
      searchUser: 'Найти пользователя',
      searchUserPlaceholder: 'Введите имя, телефон, ID, ИНН или ПИНФЛ...',
      selectUser: 'Выберите пользователя для просмотра транзакций',
      selectedUser: 'Выбранный пользователь',
      phone: 'Телефон',
      userType: 'Тип',
      transactions: 'Транзакции',
      noTransactions: 'Нет транзакций за выбранный период',
      accountMain: 'Основной счёт',
      accountBlocked: 'Заблокированный счёт',
      accountInTransit: 'Счёт в пути',
      accountPartnerReward: 'Партнёрский счёт',
      currentBalance: 'Текущий баланс',
      date: 'Дата',
      type: 'Тип',
      amount: 'Сумма',
      reference: 'Описание',
      topup: 'Пополнение',
      withdrawal: 'Вывод',
      withdrawal_request: 'Запрос на вывод',
      withdrawal_approved: 'Вывод одобрен',
      withdrawal_rejected: 'Вывод отклонён',
      block: 'Блокировка',
      unblock: 'Разблокировка',
      transfer_in: 'Перевод приход',
      transfer_out: 'Перевод расход',
      escrow_block: 'Залог заблокирован',
      escrow_release: 'Залог освобождён',
      escrow_refund: 'Возврат залога',
      prepayment: 'Предоплата',
      commission: 'Комиссия',
      partner_reward: 'Партнёрское вознаграждение',
      penalty: 'Штраф',
      refWithdrawalRequest: 'Запрос на вывод',
      refAdminTopup: 'Пополнение от администратора',
      offers: 'Предложения',
      actions: 'Действия',
      delete: 'Удалить',
      confirmDeleteOrder: 'Вы уверены, что хотите удалить этот заказ?',
      confirmDeleteOrderDesc: 'Это действие нельзя отменить. Заказ будет помечен как удалённый.',
      cancel: 'Отмена',
      orderDeleted: 'Заказ успешно удалён',
      deleteError: 'Ошибка при удалении заказа'
    },
    uz: {
      title: 'Hisobotlar',
      balances: 'Balanslar',
      turnovers: 'Aylanmalar',
      orders: 'Buyurtmalar',
      contracts: 'Shartnomalar',
      partnerRewards: 'Mukofotlar',
      platformCommission: 'Platforma komissiyasi',
      exportExcel: 'Excel yuklab olish',
      carrierInnPinfl: 'Tashuvchi INN/PINFL',
      orderNumber: 'Buyurtma raqami',
      orderDate: 'Buyurtma sanasi',
      commissionAmount: 'Hisoblangan komissiya',
      commissionFromMain: 'Asosiy hisobdan',
      commissionFromBonus: 'Bonus hisobdan',
      totalCommission: 'Jami komissiya',
      noCommissions: 'Komissiya haqida ma\'lumot yo\'q',
      lastName: 'Familiya',
      firstName: 'Ism',
      middleName: 'Otasining ismi',
      companyName: 'Tashkilot',
      inn: 'INN',
      pinfl: 'PINFL',
      contractNumber: 'Shartnoma raqami',
      contractDate: 'Shartnoma sanasi',
      contractAmount: 'Shartnoma summasi',
      contractStatus: 'Shartnoma holati',
      rewardAmount: 'Hisoblangan mukofot',
      noRewards: 'Mukofotlar haqida ma\'lumot yo\'q',
      asOfDate: 'Sanaga',
      period: 'Davr',
      from: 'Dan',
      to: 'Gacha',
      apply: 'Qo\'llash',
      userId: 'Foydalanuvchi ID',
      userName: 'Foydalanuvchi nomi',
      mainBalance: 'Asosiy',
      blockedBalance: 'Bloklangan',
      inTransitBalance: 'Yo\'lda',
      partnerReward: 'Hamkorlik',
      totalBalance: 'Jami',
      credit: 'Kirim',
      debit: 'Chiqim',
      noData: 'Ma\'lumot yo\'q',
      orderId: 'Buyurtma ID',
      status: 'Holat',
      price: 'QQS bilan narx',
      createdAt: 'Yaratilgan',
      customer: 'Buyurtmachi',
      contractId: 'Shartnoma ID',
      carrier: 'Tashuvchi',
      signedAt: 'Imzolangan',
      page: 'Sahifa',
      of: 'dan',
      prev: 'Oldingi',
      next: 'Keyingi',
      loading: 'Yuklanmoqda...',
      summary: 'Tizim bo\'yicha jami',
      totalMain: 'Asosiy hisoblar',
      totalBlocked: 'Bloklangan',
      totalInTransit: 'Yo\'lda',
      totalPartner: 'Hamkorlik',
      grandTotal: 'Umumiy balans',
      totalCredit: 'Jami kirim',
      totalDebit: 'Jami chiqim',
      netChange: 'Sof o\'zgarish',
      totalOrders: 'Jami buyurtmalar',
      totalContracts: 'Jami shartnomalar',
      search: 'Ism yoki ID bo\'yicha qidirish',
      allStatuses: 'Barcha holatlar',
      filterByStatus: 'Holat bo\'yicha filtrlash',
      clear: 'Tozalash',
      searchUser: 'Foydalanuvchini topish',
      searchUserPlaceholder: 'Ism, telefon, ID, INN yoki PINFL kiriting...',
      selectUser: 'Tranzaksiyalarni ko\'rish uchun foydalanuvchini tanlang',
      selectedUser: 'Tanlangan foydalanuvchi',
      phone: 'Telefon',
      userType: 'Turi',
      transactions: 'Tranzaksiyalar',
      noTransactions: 'Tanlangan davr uchun tranzaksiyalar yo\'q',
      accountMain: 'Asosiy hisob',
      accountBlocked: 'Bloklangan hisob',
      accountInTransit: 'Yo\'ldagi hisob',
      accountPartnerReward: 'Hamkorlik hisobi',
      currentBalance: 'Joriy balans',
      date: 'Sana',
      type: 'Turi',
      amount: 'Summa',
      reference: 'Tavsif',
      topup: 'To\'ldirish',
      withdrawal: 'Yechish',
      withdrawal_request: 'Yechish so\'rovi',
      withdrawal_approved: 'Yechish tasdiqlandi',
      withdrawal_rejected: 'Yechish rad etildi',
      block: 'Bloklash',
      unblock: 'Blokdan chiqarish',
      transfer_in: 'Kirim o\'tkazma',
      transfer_out: 'Chiqim o\'tkazma',
      escrow_block: 'Garov bloklangan',
      escrow_release: 'Garov chiqarildi',
      escrow_refund: 'Garov qaytarildi',
      prepayment: 'Oldindan to\'lov',
      commission: 'Komissiya',
      partner_reward: 'Hamkorlik mukofoti',
      penalty: 'Jarima',
      refWithdrawalRequest: 'Yechish so\'rovi',
      refAdminTopup: 'Administrator to\'ldirishi',
      offers: 'Takliflar',
      actions: 'Amallar',
      delete: 'O\'chirish',
      confirmDeleteOrder: 'Haqiqatan ham bu buyurtmani o\'chirmoqchimisiz?',
      confirmDeleteOrderDesc: 'Bu amalni bekor qilib bo\'lmaydi. Buyurtma o\'chirilgan deb belgilanadi.',
      cancel: 'Bekor qilish',
      orderDeleted: 'Buyurtma muvaffaqiyatli o\'chirildi',
      deleteError: 'Buyurtmani o\'chirishda xatolik'
    }
  };

  const t = texts[language];

  const formatBalance = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num).replace(/\s/g, ' ');
  };

  const allFilteredBalanceUsers = (balanceReport.data?.users || []).filter((user: any) => {
    if (!balanceSearch) return true;
    const search = balanceSearch.toLowerCase();
    return user.userId?.toString().includes(search) || 
           user.displayName?.toLowerCase().includes(search) ||
           user.inn?.toLowerCase().includes(search) ||
           user.pinfl?.toLowerCase().includes(search);
  });
  const balanceTotalPages = Math.ceil(allFilteredBalanceUsers.length / balancePageSize);
  const filteredBalanceUsers = allFilteredBalanceUsers.slice(
    (balancePage - 1) * balancePageSize,
    balancePage * balancePageSize
  );

  const handleTurnoverUserSearch = async (query: string) => {
    setTurnoverUserSearch(query);
    if (query.length < 2) {
      setTurnoverUserResults([]);
      return;
    }
    setTurnoverSearchLoading(true);
    try {
      const results = await searchAdminUsers(query);
      setTurnoverUserResults(results);
    } catch (error) {
      console.error('User search error:', error);
    } finally {
      setTurnoverSearchLoading(false);
    }
  };

  const selectTurnoverUser = (user: any) => {
    setTurnoverSelectedUser(user);
    setTurnoverUserSearch('');
    setTurnoverUserResults([]);
  };

  const clearTurnoverUser = () => {
    setTurnoverSelectedUser(null);
  };

  const filteredOrders = (ordersReport.data?.orders || []).filter((order: any) => {
    if (!ordersSearch) return true;
    const search = ordersSearch.toLowerCase();
    return order.id?.toString().includes(search) ||
           order.customer?.displayName?.toLowerCase().includes(search) ||
           order.customer?.id?.toString().includes(search) ||
           order.customer?.inn?.toLowerCase().includes(search) ||
           order.customer?.pinfl?.toLowerCase().includes(search);
  });

  const filteredContracts = (contractsReport.data?.contracts || []).filter((contract: any) => {
    if (!contractsSearch) return true;
    const search = contractsSearch.toLowerCase();
    return contract.id?.toString().includes(search) ||
           contract.customer?.displayName?.toLowerCase().includes(search) ||
           contract.carrier?.displayName?.toLowerCase().includes(search) ||
           contract.customer?.id?.toString().includes(search) ||
           contract.carrier?.id?.toString().includes(search) ||
           contract.customer?.inn?.toLowerCase().includes(search) ||
           contract.customer?.pinfl?.toLowerCase().includes(search) ||
           contract.carrier?.inn?.toLowerCase().includes(search) ||
           contract.carrier?.pinfl?.toLowerCase().includes(search);
  });

  const toggleOrderStatus = (status: string) => {
    setOrdersStatus(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
    setOrdersPage(1);
  };

  const toggleContractStatus = (status: string) => {
    setContractsStatus(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
    setContractsPage(1);
  };

  const handleDeleteOrder = async () => {
    if (!deleteOrderId) return;
    setIsDeleting(true);
    try {
      await adminDeleteOrder(deleteOrderId);
      toast({ title: t.orderDeleted });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/reports/orders'] });
    } catch (error: any) {
      toast({ title: t.deleteError, description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setDeleteOrderId(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold" data-testid="text-reports-title">{t.title}</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 p-1" data-testid="tabs-reports">
          <TabsTrigger value="balances" className="flex-1 min-w-fit" data-testid="tab-balances">{t.balances}</TabsTrigger>
          <TabsTrigger value="turnovers" className="flex-1 min-w-fit" data-testid="tab-turnovers">{t.turnovers}</TabsTrigger>
          <TabsTrigger value="orders" className="flex-1 min-w-fit" data-testid="tab-orders">{t.orders}</TabsTrigger>
          <TabsTrigger value="contracts" className="flex-1 min-w-fit" data-testid="tab-contracts">{t.contracts}</TabsTrigger>
          <TabsTrigger value="partner-rewards" className="flex-1 min-w-fit" data-testid="tab-partner-rewards">{t.partnerRewards}</TabsTrigger>
          <TabsTrigger value="platform-commission" className="flex-1 min-w-fit" data-testid="tab-platform-commission">{t.platformCommission}</TabsTrigger>
        </TabsList>

        <TabsContent value="balances" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.balances}</CardTitle>
              <div className="flex flex-wrap items-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">{t.asOfDate}:</label>
                  <Input
                    type="date"
                    value={balanceDate}
                    onChange={(e) => setBalanceDate(e.target.value)}
                    className="w-48"
                    data-testid="input-balance-date"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t.search}
                    value={balanceSearch}
                    onChange={(e) => { setBalanceSearch(e.target.value); setBalancePage(1); }}
                    className="w-64"
                    data-testid="input-balance-search"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {balanceReport.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : balanceReport.data?.users?.length > 0 ? (
                <>
                  <Card className="mb-4 bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">{t.totalMain}:</span>
                          <p className="font-bold">{formatBalance(balanceReport.data.totals?.main || 0)} UZS</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t.totalBlocked}:</span>
                          <p className="font-bold text-orange-600">{formatBalance(balanceReport.data.totals?.blocked || 0)} UZS</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t.totalInTransit}:</span>
                          <p className="font-bold text-blue-600">{formatBalance(balanceReport.data.totals?.in_transit || 0)} UZS</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t.totalPartner}:</span>
                          <p className="font-bold text-green-600">{formatBalance(balanceReport.data.totals?.partner_reward || 0)} UZS</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t.grandTotal}:</span>
                          <p className="font-bold text-lg">{formatBalance(balanceReport.data.totals?.total || 0)} UZS</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  {filteredBalanceUsers.length > 0 ? (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t.userId}</TableHead>
                            <TableHead>{t.userName}</TableHead>
                            <TableHead className="text-right">{t.mainBalance}</TableHead>
                            <TableHead className="text-right">{t.blockedBalance}</TableHead>
                            <TableHead className="text-right">{t.inTransitBalance}</TableHead>
                            <TableHead className="text-right">{t.partnerReward}</TableHead>
                            <TableHead className="text-right">{t.totalBalance}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredBalanceUsers.map((user: any) => (
                            <TableRow key={user.userId} data-testid={`row-balance-${user.userId}`}>
                              <TableCell>{user.userId}</TableCell>
                              <TableCell>{user.displayName || '-'}</TableCell>
                              <TableCell className="text-right">{formatBalance(user.main || 0)}</TableCell>
                              <TableCell className="text-right text-orange-600">{formatBalance(user.blocked || 0)}</TableCell>
                              <TableCell className="text-right text-blue-600">{formatBalance(user.in_transit || 0)}</TableCell>
                              <TableCell className="text-right text-green-600">{formatBalance(user.partner_reward || 0)}</TableCell>
                              <TableCell className="text-right font-bold">{formatBalance(user.total || 0)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {balanceTotalPages > 1 && (
                        <div className="flex items-center justify-center mt-4 gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={balancePage <= 1}
                            onClick={() => setBalancePage(1)}
                            data-testid="button-balance-first"
                          >
                            «
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={balancePage <= 1}
                            onClick={() => setBalancePage(p => p - 1)}
                            data-testid="button-balance-prev"
                          >
                            ‹
                          </Button>
                          {(() => {
                            const totalPages = balanceTotalPages;
                            const currentPage = balancePage;
                            const pages: (number | string)[] = [];
                            
                            if (totalPages <= 7) {
                              for (let i = 1; i <= totalPages; i++) pages.push(i);
                            } else {
                              if (currentPage <= 4) {
                                for (let i = 1; i <= 5; i++) pages.push(i);
                                pages.push('...');
                                pages.push(totalPages);
                              } else if (currentPage >= totalPages - 3) {
                                pages.push(1);
                                pages.push('...');
                                for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
                              } else {
                                pages.push(1);
                                pages.push('...');
                                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                                pages.push('...');
                                pages.push(totalPages);
                              }
                            }
                            
                            return pages.map((page, idx) => (
                              page === '...' ? (
                                <span key={`dots-${idx}`} className="px-2 text-muted-foreground">...</span>
                              ) : (
                                <Button
                                  key={page}
                                  variant={currentPage === page ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => setBalancePage(page as number)}
                                  data-testid={`button-balance-page-${page}`}
                                  className="min-w-[36px]"
                                >
                                  {page}
                                </Button>
                              )
                            ));
                          })()}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={balancePage >= balanceTotalPages}
                            onClick={() => setBalancePage(p => p + 1)}
                            data-testid="button-balance-next"
                          >
                            ›
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={balancePage >= balanceTotalPages}
                            onClick={() => setBalancePage(balanceTotalPages)}
                            data-testid="button-balance-last"
                          >
                            »
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">{t.noData}</div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">{t.noData}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="turnovers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.turnovers}</CardTitle>
              <div className="flex flex-wrap items-center gap-4 mt-2">
                <div className="flex items-center gap-2 relative">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t.searchUserPlaceholder}
                    value={turnoverUserSearch}
                    onChange={(e) => handleTurnoverUserSearch(e.target.value)}
                    className="w-72"
                    data-testid="input-turnover-user-search"
                  />
                  {turnoverSearchLoading && (
                    <RefreshCw className="h-4 w-4 animate-spin absolute right-3 text-muted-foreground" />
                  )}
                  {turnoverUserResults.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-background border rounded-md shadow-lg z-50 max-h-60 overflow-auto">
                      {turnoverUserResults.map((user: any) => (
                        <div
                          key={user.id}
                          className="px-3 py-2 hover:bg-muted cursor-pointer flex justify-between items-center"
                          onClick={() => selectTurnoverUser(user)}
                          data-testid={`user-result-${user.id}`}
                        >
                          <div>
                            <div className="font-medium">{user.displayName}</div>
                            <div className="text-sm text-muted-foreground">
                              {user.phone}
                              {user.inn && <span className="ml-2">ИНН: {user.inn}</span>}
                              {user.pinfl && <span className="ml-2">ПИНФЛ: {user.pinfl}</span>}
                            </div>
                          </div>
                          <Badge variant="outline">{user.userType}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">{t.period}:</label>
                  <span className="text-sm">{t.from}</span>
                  <Input
                    type="date"
                    value={turnoverStartDate}
                    onChange={(e) => setTurnoverStartDate(e.target.value)}
                    className="w-40"
                    data-testid="input-turnover-start"
                  />
                  <span className="text-sm">{t.to}</span>
                  <Input
                    type="date"
                    value={turnoverEndDate}
                    onChange={(e) => setTurnoverEndDate(e.target.value)}
                    className="w-40"
                    data-testid="input-turnover-end"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!turnoverSelectedUser ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>{t.selectUser}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">{userTransactionsReport.data?.user?.displayName}</h3>
                          <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                            <span>{t.phone}: {userTransactionsReport.data?.user?.phone}</span>
                            <Badge variant="outline">{userTransactionsReport.data?.user?.userType}</Badge>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={clearTurnoverUser} data-testid="button-clear-user">
                          {t.clear}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {userTransactionsReport.isLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                  ) : (
                    <>
                      {(() => {
                        const accountLabels: Record<string, string> = {
                          main: t.accountMain,
                          blocked: t.accountBlocked,
                          in_transit: t.accountInTransit,
                          partner_reward: t.accountPartnerReward
                        };

                        const getTransactionTypeLabel = (type: string) => {
                          const typeLabels: Record<string, string> = {
                            topup: t.topup,
                            withdrawal: t.withdrawal,
                            withdrawal_request: t.withdrawal_request,
                            withdrawal_approved: t.withdrawal_approved,
                            withdrawal_rejected: t.withdrawal_rejected,
                            block: t.block,
                            unblock: t.unblock,
                            transfer_in: t.transfer_in,
                            transfer_out: t.transfer_out,
                            escrow_block: t.escrow_block,
                            escrow_release: t.escrow_release,
                            escrow_refund: t.escrow_refund,
                            prepayment: t.prepayment,
                            commission: t.commission,
                            partner_reward: t.partner_reward,
                            penalty: t.penalty
                          };
                          return typeLabels[type] || type;
                        };

                        const getTransactionReference = (reference: string | null) => {
                          if (!reference) return '-';
                          if (reference.startsWith('Withdrawal request #')) {
                            return `${t.refWithdrawalRequest} #${reference.split('#')[1]}`;
                          }
                          if (reference.startsWith('Admin topup:')) {
                            return `${t.refAdminTopup}: ${reference.replace('Admin topup:', '').trim()}`;
                          }
                          if (reference.startsWith('withdrawal-')) {
                            return `${t.refWithdrawalRequest} #${reference.split('-')[1]}`;
                          }
                          return reference;
                        };

                        const selectedTransactions = (userTransactionsReport.data?.transactions || []).filter((tx: any) => tx.accountType === turnoverSelectedAccount);
                        const selectedSummary = userTransactionsReport.data?.accountSummary?.[turnoverSelectedAccount];

                        return (
                          <>
                            <div className="grid grid-cols-4 gap-2 mb-4">
                              {['main', 'blocked', 'in_transit', 'partner_reward'].map(accountType => {
                                const summary = userTransactionsReport.data?.accountSummary?.[accountType];
                                const isSelected = turnoverSelectedAccount === accountType;
                                return (
                                  <Card 
                                    key={accountType}
                                    className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
                                    onClick={() => setTurnoverSelectedAccount(accountType)}
                                    data-testid={`account-tab-${accountType}`}
                                  >
                                    <CardContent className="p-3">
                                      <div className="text-xs text-muted-foreground mb-1">{accountLabels[accountType]}</div>
                                      <div className="font-semibold text-sm">{formatBalance(summary?.balance || 0)} UZS</div>
                                      <div className="flex gap-2 text-xs mt-1">
                                        <span className="text-green-600">+{formatBalance(summary?.credit || 0)}</span>
                                        <span className="text-red-600">-{formatBalance(summary?.debit || 0)}</span>
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>

                            <Card>
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-base">{accountLabels[turnoverSelectedAccount]}</CardTitle>
                                  <div className="flex items-center gap-4 text-sm">
                                    <span className="text-green-600">+{formatBalance(selectedSummary?.credit || 0)}</span>
                                    <span className="text-red-600">-{formatBalance(selectedSummary?.debit || 0)}</span>
                                    <span className="font-semibold">{t.currentBalance}: {formatBalance(selectedSummary?.balance || 0)} UZS</span>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent>
                                {selectedTransactions.length > 0 ? (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>{t.date}</TableHead>
                                        <TableHead>{t.type}</TableHead>
                                        <TableHead className="text-right">{t.amount}</TableHead>
                                        <TableHead>{t.reference}</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {selectedTransactions.map((tx: any) => {
                                        // Same logic as user cabinet - determine sign by transaction type, use absolute value
                                        const creditTypes = ['topup', 'unblock', 'escrow_release', 'escrow_refund', 'transfer_in', 'registration_bonus'];
                                        const isPositive = creditTypes.includes(tx.type);
                                        const amount = Math.abs(parseFloat(tx.amount || '0'));
                                        return (
                                          <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                                            <TableCell>{formatDate(tx.createdAt)}</TableCell>
                                            <TableCell>
                                              <Badge variant={isPositive ? 'default' : 'secondary'}>
                                                {getTransactionTypeLabel(tx.type)}
                                              </Badge>
                                            </TableCell>
                                            <TableCell className={`text-right font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                              {isPositive ? '+' : '-'}{formatBalance(amount)}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{getTransactionReference(tx.reference)}</TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                ) : (
                                  <div className="text-center py-4 text-sm text-muted-foreground">{t.noTransactions}</div>
                                )}
                              </CardContent>
                            </Card>
                          </>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.orders}</CardTitle>
              <div className="flex flex-wrap items-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t.from}</span>
                  <Input
                    type="date"
                    value={ordersStartDate}
                    onChange={(e) => { setOrdersStartDate(e.target.value); setOrdersPage(1); }}
                    className="w-40"
                    data-testid="input-orders-start"
                  />
                  <span className="text-sm text-muted-foreground">{t.to}</span>
                  <Input
                    type="date"
                    value={ordersEndDate}
                    onChange={(e) => { setOrdersEndDate(e.target.value); setOrdersPage(1); }}
                    className="w-40"
                    data-testid="input-orders-end"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t.search}
                    value={ordersSearch}
                    onChange={(e) => setOrdersSearch(e.target.value)}
                    className="w-64"
                    data-testid="input-orders-search"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-sm text-muted-foreground mr-2">{t.filterByStatus}:</span>
                {orderStatuses.map(status => (
                  <Badge
                    key={status}
                    variant={ordersStatus.includes(status) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleOrderStatus(status)}
                    data-testid={`filter-order-status-${status}`}
                  >
                    {statusLabels[language][status as keyof typeof statusLabels['ru']]}
                  </Badge>
                ))}
                {ordersStatus.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setOrdersStatus([]); setOrdersPage(1); }}
                    data-testid="button-clear-orders-status"
                  >
                    {t.clear}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {ordersReport.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : ordersReport.data?.orders?.length > 0 ? (
                <>
                  <div className="mb-4 text-sm text-muted-foreground">
                    {t.totalOrders}: <span className="font-bold">{ordersReport.data.total}</span>
                  </div>
                  {filteredOrders.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.orderId}</TableHead>
                          <TableHead>{t.customer}</TableHead>
                          <TableHead>{t.status}</TableHead>
                          <TableHead className="text-center">{t.offers}</TableHead>
                          <TableHead className="text-right">{t.price}</TableHead>
                          <TableHead>{t.createdAt}</TableHead>
                          <TableHead>{t.actions}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((order: any) => {
                          const displayStatus = order.isDeleted ? 'deleted' : order.status;
                          return (
                            <TableRow key={order.id} data-testid={`row-order-${order.id}`} className={order.isDeleted ? 'opacity-60' : ''}>
                              <TableCell className="font-mono">
                                <Link href={`/admin-order/${order.id}`} className="text-primary hover:underline" data-testid={`link-order-${order.id}`}>
                                  {order.id}
                                </Link>
                              </TableCell>
                              <TableCell>{order.customer?.displayName || order.customerId}</TableCell>
                              <TableCell>
                                <Badge variant={order.isDeleted ? 'destructive' : 'outline'}>
                                  {statusLabels[language][displayStatus as keyof typeof statusLabels['ru']] || displayStatus}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{order.offersCount || 0}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{order.priceWithVat ? formatMoney(order.priceWithVat) : '-'}</TableCell>
                              <TableCell>{order.createdAt ? formatDate(order.createdAt) : '-'}</TableCell>
                              <TableCell>
                                {!order.isDeleted && order.status !== 'assigned' && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setDeleteOrderId(order.id)}
                                    data-testid={`button-delete-order-${order.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">{t.noData}</div>
                  )}
                  {ordersReport.data.totalPages > 1 && (
                    <div className="flex items-center justify-center mt-4 gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={ordersPage <= 1}
                        onClick={() => setOrdersPage(1)}
                        data-testid="button-orders-first"
                      >
                        «
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={ordersPage <= 1}
                        onClick={() => setOrdersPage(p => p - 1)}
                        data-testid="button-orders-prev"
                      >
                        ‹
                      </Button>
                      {(() => {
                        const totalPages = ordersReport.data.totalPages;
                        const currentPage = ordersPage;
                        const pages: (number | string)[] = [];
                        
                        if (totalPages <= 7) {
                          for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else {
                          if (currentPage <= 4) {
                            for (let i = 1; i <= 5; i++) pages.push(i);
                            pages.push('...');
                            pages.push(totalPages);
                          } else if (currentPage >= totalPages - 3) {
                            pages.push(1);
                            pages.push('...');
                            for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
                          } else {
                            pages.push(1);
                            pages.push('...');
                            for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                            pages.push('...');
                            pages.push(totalPages);
                          }
                        }
                        
                        return pages.map((page, idx) => (
                          page === '...' ? (
                            <span key={`dots-${idx}`} className="px-2 text-muted-foreground">...</span>
                          ) : (
                            <Button
                              key={page}
                              variant={currentPage === page ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setOrdersPage(page as number)}
                              data-testid={`button-orders-page-${page}`}
                              className="min-w-[36px]"
                            >
                              {page}
                            </Button>
                          )
                        ));
                      })()}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={ordersPage >= ordersReport.data.totalPages}
                        onClick={() => setOrdersPage(p => p + 1)}
                        data-testid="button-orders-next"
                      >
                        ›
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={ordersPage >= ordersReport.data.totalPages}
                        onClick={() => setOrdersPage(ordersReport.data.totalPages)}
                        data-testid="button-orders-last"
                      >
                        »
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">{t.noData}</div>
              )}
            </CardContent>
          </Card>
          
          <AlertDialog open={!!deleteOrderId} onOpenChange={(open) => !open && setDeleteOrderId(null)}>
            <AlertDialogContent data-testid="dialog-delete-order">
              <AlertDialogHeader>
                <AlertDialogTitle>{t.confirmDeleteOrder}</AlertDialogTitle>
                <AlertDialogDescription>{t.confirmDeleteOrderDesc}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting} data-testid="button-cancel-delete">
                  {t.cancel}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteOrder}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  data-testid="button-confirm-delete"
                >
                  {isDeleting ? t.loading : t.delete}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.contracts}</CardTitle>
              <div className="flex flex-wrap items-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t.from}</span>
                  <Input
                    type="date"
                    value={contractsStartDate}
                    onChange={(e) => { setContractsStartDate(e.target.value); setContractsPage(1); }}
                    className="w-40"
                    data-testid="input-contracts-start"
                  />
                  <span className="text-sm text-muted-foreground">{t.to}</span>
                  <Input
                    type="date"
                    value={contractsEndDate}
                    onChange={(e) => { setContractsEndDate(e.target.value); setContractsPage(1); }}
                    className="w-40"
                    data-testid="input-contracts-end"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t.search}
                    value={contractsSearch}
                    onChange={(e) => setContractsSearch(e.target.value)}
                    className="w-64"
                    data-testid="input-contracts-search"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-sm text-muted-foreground mr-2">{t.filterByStatus}:</span>
                {contractStatuses.map(status => (
                  <Badge
                    key={status}
                    variant={contractsStatus.includes(status) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => toggleContractStatus(status)}
                    data-testid={`filter-contract-status-${status}`}
                  >
                    {statusLabels[language][status as keyof typeof statusLabels['ru']]}
                  </Badge>
                ))}
                {contractsStatus.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setContractsStatus([]); setContractsPage(1); }}
                    data-testid="button-clear-contracts-status"
                  >
                    {t.clear}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {contractsReport.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : contractsReport.data?.contracts?.length > 0 ? (
                <>
                  <div className="mb-4 text-sm text-muted-foreground">
                    {t.totalContracts}: <span className="font-bold">{contractsReport.data.total}</span>
                  </div>
                  {filteredContracts.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.contractId}</TableHead>
                          <TableHead>{t.orderId}</TableHead>
                          <TableHead>{t.customer}</TableHead>
                          <TableHead>{t.carrier}</TableHead>
                          <TableHead>{t.status}</TableHead>
                          <TableHead className="text-right">{t.price}</TableHead>
                          <TableHead>{t.signedAt}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredContracts.map((contract: any) => (
                          <TableRow key={contract.id} data-testid={`row-contract-${contract.id}`}>
                            <TableCell className="font-mono">{contract.id}</TableCell>
                            <TableCell>{contract.orderId}</TableCell>
                            <TableCell>{contract.customer?.displayName || contract.customerId}</TableCell>
                            <TableCell>{contract.carrier?.displayName || contract.carrierId}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{statusLabels[language][contract.status as keyof typeof statusLabels['ru']] || contract.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{contract.totalPrice ? formatMoney(contract.totalPrice) : '-'}</TableCell>
                            <TableCell>{contract.signedAt ? formatDate(contract.signedAt) : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">{t.noData}</div>
                  )}
                  {contractsReport.data.totalPages > 1 && (
                    <div className="flex items-center justify-center mt-4 gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={contractsPage <= 1}
                        onClick={() => setContractsPage(1)}
                        data-testid="button-contracts-first"
                      >
                        «
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={contractsPage <= 1}
                        onClick={() => setContractsPage(p => p - 1)}
                        data-testid="button-contracts-prev"
                      >
                        ‹
                      </Button>
                      {(() => {
                        const totalPages = contractsReport.data.totalPages;
                        const currentPage = contractsPage;
                        const pages: (number | string)[] = [];
                        
                        if (totalPages <= 7) {
                          for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else {
                          if (currentPage <= 4) {
                            for (let i = 1; i <= 5; i++) pages.push(i);
                            pages.push('...');
                            pages.push(totalPages);
                          } else if (currentPage >= totalPages - 3) {
                            pages.push(1);
                            pages.push('...');
                            for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
                          } else {
                            pages.push(1);
                            pages.push('...');
                            for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                            pages.push('...');
                            pages.push(totalPages);
                          }
                        }
                        
                        return pages.map((page, idx) => (
                          page === '...' ? (
                            <span key={`dots-${idx}`} className="px-2 text-muted-foreground">...</span>
                          ) : (
                            <Button
                              key={page}
                              variant={currentPage === page ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setContractsPage(page as number)}
                              data-testid={`button-contracts-page-${page}`}
                              className="min-w-[36px]"
                            >
                              {page}
                            </Button>
                          )
                        ));
                      })()}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={contractsPage >= contractsReport.data.totalPages}
                        onClick={() => setContractsPage(p => p + 1)}
                        data-testid="button-contracts-next"
                      >
                        ›
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={contractsPage >= contractsReport.data.totalPages}
                        onClick={() => setContractsPage(contractsReport.data.totalPages)}
                        data-testid="button-contracts-last"
                      >
                        »
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">{t.noData}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="partner-rewards" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle>{t.partnerRewards}</CardTitle>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t.from}:</span>
                  <Input
                    type="date"
                    value={rewardsStartDate}
                    onChange={(e) => { setRewardsStartDate(e.target.value); setRewardsPage(1); }}
                    className="w-auto"
                    data-testid="input-rewards-start-date"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t.to}:</span>
                  <Input
                    type="date"
                    value={rewardsEndDate}
                    onChange={(e) => { setRewardsEndDate(e.target.value); setRewardsPage(1); }}
                    className="w-auto"
                    data-testid="input-rewards-end-date"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleExportExcel}
                  disabled={isExportingExcel || !rewardsReport.data?.rewards?.length}
                  data-testid="button-export-excel"
                >
                  {isExportingExcel ? t.loading : t.exportExcel}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {rewardsReport.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : rewardsReport.data?.rewards?.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => scrollTable(rewardsScrollRef, 'left')}
                      data-testid="button-scroll-rewards-left"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {language === 'uz' ? 'Jadvalni aylantirish' : 'Прокрутка таблицы'}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => scrollTable(rewardsScrollRef, 'right')}
                      data-testid="button-scroll-rewards-right"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div 
                    ref={rewardsScrollRef}
                    className="overflow-x-auto rounded-md"
                    data-testid="scroll-rewards-table"
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.lastName}</TableHead>
                          <TableHead>{t.firstName}</TableHead>
                          <TableHead>{t.middleName}</TableHead>
                          <TableHead>{t.companyName}</TableHead>
                          <TableHead>{t.inn}</TableHead>
                          <TableHead>{t.pinfl}</TableHead>
                          <TableHead>{t.customer}</TableHead>
                          <TableHead>{t.carrier}</TableHead>
                          <TableHead>{t.contractNumber}</TableHead>
                          <TableHead>{t.contractDate}</TableHead>
                          <TableHead className="text-right">{t.contractAmount}</TableHead>
                          <TableHead>{t.contractStatus}</TableHead>
                          <TableHead className="text-right">{t.rewardAmount}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rewardsReport.data.rewards.map((reward: any) => (
                          <TableRow key={reward.id} data-testid={`row-reward-${reward.id}`}>
                            <TableCell>{reward.partner?.lastName || '-'}</TableCell>
                            <TableCell>{reward.partner?.firstName || '-'}</TableCell>
                            <TableCell>{reward.partner?.middleName || '-'}</TableCell>
                            <TableCell>{reward.partner?.companyName || '-'}</TableCell>
                            <TableCell>{reward.partner?.inn || '-'}</TableCell>
                            <TableCell>{reward.partner?.pinfl || '-'}</TableCell>
                            <TableCell>{reward.customer?.companyName || reward.customer?.displayName || '-'}</TableCell>
                            <TableCell>{reward.carrier?.companyName || reward.carrier?.displayName || '-'}</TableCell>
                            <TableCell>{reward.contract?.id ? `№${reward.contract.id}` : '-'}</TableCell>
                            <TableCell>{reward.contract?.generatedAt ? formatDate(reward.contract.generatedAt) : '-'}</TableCell>
                            <TableCell className="text-right">{reward.contract?.amount ? formatMoney(reward.contract.amount) : '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{statusLabels[language][reward.contract?.status as keyof typeof statusLabels['ru']] || reward.contract?.status || '-'}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatMoney(reward.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {rewardsReport.data.totalPages > 1 && (
                    <div className="flex items-center justify-center mt-4 gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={rewardsPage <= 1}
                        onClick={() => setRewardsPage(1)}
                        data-testid="button-rewards-first"
                      >
                        «
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={rewardsPage <= 1}
                        onClick={() => setRewardsPage(p => p - 1)}
                        data-testid="button-rewards-prev"
                      >
                        ‹
                      </Button>
                      {(() => {
                        const totalPages = rewardsReport.data.totalPages;
                        const currentPage = rewardsPage;
                        const pages: (number | string)[] = [];
                        
                        if (totalPages <= 7) {
                          for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else {
                          if (currentPage <= 4) {
                            for (let i = 1; i <= 5; i++) pages.push(i);
                            pages.push('...');
                            pages.push(totalPages);
                          } else if (currentPage >= totalPages - 3) {
                            pages.push(1);
                            pages.push('...');
                            for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
                          } else {
                            pages.push(1);
                            pages.push('...');
                            for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                            pages.push('...');
                            pages.push(totalPages);
                          }
                        }
                        
                        return pages.map((page, idx) => (
                          page === '...' ? (
                            <span key={`dots-${idx}`} className="px-2 text-muted-foreground">...</span>
                          ) : (
                            <Button
                              key={page}
                              variant={currentPage === page ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setRewardsPage(page as number)}
                              data-testid={`button-rewards-page-${page}`}
                              className="min-w-[36px]"
                            >
                              {page}
                            </Button>
                          )
                        ));
                      })()}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={rewardsPage >= rewardsReport.data.totalPages}
                        onClick={() => setRewardsPage(p => p + 1)}
                        data-testid="button-rewards-next"
                      >
                        ›
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={rewardsPage >= rewardsReport.data.totalPages}
                        onClick={() => setRewardsPage(rewardsReport.data.totalPages)}
                        data-testid="button-rewards-last"
                      >
                        »
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">{t.noRewards}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="platform-commission" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle>{t.platformCommission}</CardTitle>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t.from}:</span>
                  <Input
                    type="date"
                    value={commissionStartDate}
                    onChange={(e) => { setCommissionStartDate(e.target.value); setCommissionPage(1); }}
                    className="w-auto"
                    data-testid="input-commission-start-date"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t.to}:</span>
                  <Input
                    type="date"
                    value={commissionEndDate}
                    onChange={(e) => { setCommissionEndDate(e.target.value); setCommissionPage(1); }}
                    className="w-auto"
                    data-testid="input-commission-end-date"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {contractStatuses.map(status => (
                    <Badge
                      key={status}
                      variant={commissionStatus.includes(status) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleCommissionStatus(status)}
                      data-testid={`badge-commission-status-${status}`}
                    >
                      {statusLabels[language][status as keyof typeof statusLabels['ru']]}
                    </Badge>
                  ))}
                </div>
                <Button
                  variant="outline"
                  onClick={handleExportCommissionExcel}
                  disabled={isExportingCommissionExcel || !commissionReport.data?.commissions?.length}
                  data-testid="button-export-commission-excel"
                >
                  {isExportingCommissionExcel ? t.loading : t.exportExcel}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {commissionReport.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : commissionReport.data?.commissions?.length > 0 ? (
                <>
                  <Card className="mb-4 bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">{t.totalCommission}:</span>
                        <span className="font-bold text-lg">{formatMoney(commissionReport.data.totalCommission)} UZS</span>
                      </div>
                    </CardContent>
                  </Card>
                  <div className="flex items-center gap-2 mb-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => scrollTable(commissionScrollRef, 'left')}
                      data-testid="button-scroll-commission-left"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {language === 'uz' ? 'Jadvalni aylantirish' : 'Прокрутка таблицы'}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => scrollTable(commissionScrollRef, 'right')}
                      data-testid="button-scroll-commission-right"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div 
                    ref={commissionScrollRef}
                    className="overflow-x-auto rounded-md"
                    data-testid="scroll-commission-table"
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.customer}</TableHead>
                          <TableHead>{t.carrier}</TableHead>
                          <TableHead>{t.carrierInnPinfl}</TableHead>
                          <TableHead>{t.orderNumber}</TableHead>
                          <TableHead>{t.orderDate}</TableHead>
                          <TableHead>{t.contractNumber}</TableHead>
                          <TableHead>{t.contractDate}</TableHead>
                          <TableHead className="text-right">{t.contractAmount}</TableHead>
                          <TableHead>{t.contractStatus}</TableHead>
                          <TableHead className="text-right">{t.commissionAmount}</TableHead>
                          <TableHead className="text-right">{t.commissionFromMain}</TableHead>
                          <TableHead className="text-right">{t.commissionFromBonus}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commissionReport.data.commissions.map((item: any) => (
                          <TableRow key={item.id} data-testid={`row-commission-${item.id}`}>
                            <TableCell>{item.customer?.companyName || item.customer?.displayName || '-'}</TableCell>
                            <TableCell>{item.carrier?.companyName || item.carrier?.displayName || '-'}</TableCell>
                            <TableCell>{item.carrier?.inn || item.carrier?.pinfl || '-'}</TableCell>
                            <TableCell>{item.order?.id ? `№${item.order.id}` : '-'}</TableCell>
                            <TableCell>{item.order?.createdAt ? formatDate(item.order.createdAt) : '-'}</TableCell>
                            <TableCell>{item.contract?.id ? `№${item.contract.id}` : '-'}</TableCell>
                            <TableCell>{item.contract?.generatedAt ? formatDate(item.contract.generatedAt) : '-'}</TableCell>
                            <TableCell className="text-right">{item.contract?.amount ? formatMoney(item.contract.amount) : '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{statusLabels[language][item.contract?.status as keyof typeof statusLabels['ru']] || item.contract?.status || '-'}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatMoney(item.commissionAmount)}</TableCell>
                            <TableCell className="text-right">{formatMoney(item.commissionFromMain || 0)}</TableCell>
                            <TableCell className="text-right">{formatMoney(item.commissionFromBonus || 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {commissionReport.data.totalPages > 1 && (
                    <div className="flex items-center justify-center mt-4 gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={commissionPage <= 1}
                        onClick={() => setCommissionPage(1)}
                        data-testid="button-commission-first"
                      >
                        «
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={commissionPage <= 1}
                        onClick={() => setCommissionPage(p => p - 1)}
                        data-testid="button-commission-prev"
                      >
                        ‹
                      </Button>
                      {(() => {
                        const totalPages = commissionReport.data.totalPages;
                        const currentPage = commissionPage;
                        const pages: (number | string)[] = [];
                        
                        if (totalPages <= 7) {
                          for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else {
                          if (currentPage <= 4) {
                            for (let i = 1; i <= 5; i++) pages.push(i);
                            pages.push('...');
                            pages.push(totalPages);
                          } else if (currentPage >= totalPages - 3) {
                            pages.push(1);
                            pages.push('...');
                            for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
                          } else {
                            pages.push(1);
                            pages.push('...');
                            for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                            pages.push('...');
                            pages.push(totalPages);
                          }
                        }
                        
                        return pages.map((page, idx) => (
                          page === '...' ? (
                            <span key={`dots-${idx}`} className="px-2 text-muted-foreground">...</span>
                          ) : (
                            <Button
                              key={page}
                              variant={currentPage === page ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setCommissionPage(page as number)}
                              data-testid={`button-commission-page-${page}`}
                              className="min-w-[36px]"
                            >
                              {page}
                            </Button>
                          )
                        ));
                      })()}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={commissionPage >= commissionReport.data.totalPages}
                        onClick={() => setCommissionPage(p => p + 1)}
                        data-testid="button-commission-next"
                      >
                        ›
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={commissionPage >= commissionReport.data.totalPages}
                        onClick={() => setCommissionPage(commissionReport.data.totalPages)}
                        data-testid="button-commission-last"
                      >
                        »
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">{t.noCommissions}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RewardStatementsSection({ language }: { language: 'ru' | 'uz' }) {
  const [selectedStatement, setSelectedStatement] = useState<number | null>(null);
  const [newPeriod, setNewPeriod] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();

  const texts = {
    ru: {
      title: 'Ведомости вознаграждений партнёров',
      createStatement: 'Создать ведомость',
      period: 'Период (ГГГГ-ММ)',
      status: 'Статус',
      totalAmount: 'Сумма к выплате',
      totalPaid: 'Оплачено',
      createdAt: 'Создана',
      actions: 'Действия',
      view: 'Просмотр',
      finalize: 'Утвердить',
      markPaid: 'Отметить оплаченной',
      delete: 'Удалить',
      noStatements: 'Ведомостей пока нет',
      draft: 'Черновик',
      finalized: 'Утверждена',
      paid: 'Оплачена',
      create: 'Создать',
      cancel: 'Отмена',
      back: 'Назад к списку',
      statementDetails: 'Детали ведомости',
      user: 'Пользователь',
      userType: 'Тип',
      innPinfl: 'ИНН/ПИНФЛ',
      bankAccount: 'Р/с',
      bankName: 'Банк',
      mfo: 'МФО',
      openingBalance: 'Сальдо на начало',
      accruedAmount: 'Начислено',
      previousPaid: 'Ранее оплачено',
      closingBalance: 'К выплате',
      paidAmount: 'Оплачено',
      paidAt: 'Дата выплаты',
      itemStatus: 'Статус',
      save: 'Сохранить',
      pending: 'Ожидает',
      partial: 'Частично',
      legal: 'Юр. лицо',
      ip: 'ИП',
      individual: 'Физ. лицо',
      exportExcel: 'Экспорт в Excel'
    },
    uz: {
      title: 'Hamkor mukofotlari vedomostlari',
      createStatement: 'Vedomost yaratish',
      period: 'Davr (YYYY-MM)',
      status: 'Holat',
      totalAmount: 'To\'lov summasi',
      totalPaid: 'To\'langan',
      createdAt: 'Yaratilgan',
      actions: 'Harakatlar',
      view: 'Ko\'rish',
      finalize: 'Tasdiqlash',
      markPaid: 'To\'langan deb belgilash',
      delete: 'O\'chirish',
      noStatements: 'Vedomostlar hali yo\'q',
      draft: 'Qoralama',
      finalized: 'Tasdiqlangan',
      paid: 'To\'langan',
      create: 'Yaratish',
      cancel: 'Bekor qilish',
      back: 'Ro\'yxatga qaytish',
      statementDetails: 'Vedomost tafsilotlari',
      user: 'Foydalanuvchi',
      userType: 'Turi',
      innPinfl: 'INN/PINFL',
      bankAccount: 'H/r',
      bankName: 'Bank',
      mfo: 'MFO',
      openingBalance: 'Boshlang\'ich qoldiq',
      accruedAmount: 'Hisoblangan',
      previousPaid: 'Oldin to\'langan',
      closingBalance: 'To\'lanishi kerak',
      paidAmount: 'To\'langan',
      paidAt: 'To\'lov sanasi',
      itemStatus: 'Holat',
      save: 'Saqlash',
      pending: 'Kutilmoqda',
      partial: 'Qisman',
      legal: 'Yur. shaxs',
      ip: 'YaTT',
      individual: 'Jis. shaxs',
      exportExcel: 'Excelga eksport'
    }
  };

  const t = texts[language];

  // Fetch all statements
  const { data: statements, isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/reward-statements'],
  });

  // Fetch single statement with items
  const { data: statementDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['/api/admin/reward-statements', selectedStatement],
    enabled: !!selectedStatement,
  });

  const createMutation = useMutation({
    mutationFn: async (periodMonth: string) => {
      const res = await fetch('/api/admin/reward-statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ periodMonth }),
      });
      if (!res.ok) throw new Error('Failed to create statement');
      return res.json();
    },
    onSuccess: () => {
      refetch();
      setShowCreateDialog(false);
      setNewPeriod('');
      toast({ title: language === 'uz' ? 'Vedomost yaratildi' : 'Ведомость создана' });
    },
    onError: () => {
      toast({ title: language === 'uz' ? 'Xato' : 'Ошибка', variant: 'destructive' });
    }
  });

  const finalizeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/reward-statements/${id}/finalize`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to finalize');
      return res.json();
    },
    onSuccess: () => refetch()
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/reward-statements/${id}/mark-paid`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to mark paid');
      return res.json();
    },
    onSuccess: () => refetch()
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/reward-statements/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => refetch()
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ statementId, itemId, paidAmount, status }: any) => {
      const res = await fetch(`/api/admin/reward-statements/${statementId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paidAmount, status }),
      });
      if (!res.ok) throw new Error('Failed to update item');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/reward-statements', selectedStatement] });
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="outline">{t.draft}</Badge>;
      case 'finalized': return <Badge className="bg-blue-500">{t.finalized}</Badge>;
      case 'paid': return <Badge className="bg-green-500">{t.paid}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline">{t.pending}</Badge>;
      case 'paid': return <Badge className="bg-green-500">{t.paid}</Badge>;
      case 'partial': return <Badge className="bg-yellow-500">{t.partial}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getUserTypeBadge = (userType: string) => {
    switch (userType) {
      case 'legal': return <Badge variant="outline">{t.legal}</Badge>;
      case 'ip': return <Badge variant="outline">{t.ip}</Badge>;
      case 'individual': return <Badge variant="outline">{t.individual}</Badge>;
      default: return <Badge variant="outline">{userType}</Badge>;
    }
  };

  // Detail view for a single statement
  if (selectedStatement && statementDetails) {
    const { statement, items } = statementDetails as any;
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setSelectedStatement(null)} data-testid="button-back">
              <ChevronLeft className="h-4 w-4 mr-1" /> {t.back}
            </Button>
            <h2 className="text-2xl font-semibold">{t.statementDetails}: {statement.periodMonth}</h2>
            {getStatusBadge(statement.status)}
          </div>
          <Button 
            variant="outline" 
            onClick={() => window.open(`/api/admin/reward-statements/${statement.id}/export?lang=${language}`, '_blank')}
            data-testid="button-export-excel"
          >
            {t.exportExcel}
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.user}</TableHead>
                  <TableHead>{t.userType}</TableHead>
                  <TableHead>{t.innPinfl}</TableHead>
                  <TableHead>{t.bankAccount}</TableHead>
                  <TableHead>{t.bankName}</TableHead>
                  <TableHead>{t.mfo}</TableHead>
                  <TableHead className="text-right">{t.openingBalance}</TableHead>
                  <TableHead className="text-right">{t.accruedAmount}</TableHead>
                  <TableHead className="text-right">{t.previousPaid}</TableHead>
                  <TableHead className="text-right">{t.closingBalance}</TableHead>
                  <TableHead className="text-right">{t.paidAmount}</TableHead>
                  <TableHead>{t.paidAt}</TableHead>
                  <TableHead>{t.itemStatus}</TableHead>
                  <TableHead>{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items && items.length > 0 ? items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.displayName}</TableCell>
                    <TableCell>{getUserTypeBadge(item.userType)}</TableCell>
                    <TableCell>{item.userType === 'legal' ? item.inn : item.pinfl}</TableCell>
                    <TableCell className="font-mono text-sm">{item.bankAccount || '-'}</TableCell>
                    <TableCell>{item.bankName || '-'}</TableCell>
                    <TableCell>{item.bankCode || '-'}</TableCell>
                    <TableCell className="text-right">{formatMoney(parseFloat(item.openingBalance || '0'))}</TableCell>
                    <TableCell className="text-right">{formatMoney(parseFloat(item.accruedAmount || '0'))}</TableCell>
                    <TableCell className="text-right">{formatMoney(parseFloat(item.previousPaidAmount || '0'))}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(parseFloat(item.closingBalance || '0'))}</TableCell>
                    <TableCell className="text-right">
                      {statement.status === 'draft' ? (
                        <Input 
                          type="number" 
                          className="w-28 text-right" 
                          defaultValue={item.paidAmount}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            if (val !== parseFloat(item.paidAmount)) {
                              updateItemMutation.mutate({
                                statementId: statement.id,
                                itemId: item.id,
                                paidAmount: val,
                                status: val >= parseFloat(item.closingBalance) ? 'paid' : val > 0 ? 'partial' : 'pending'
                              });
                            }
                          }}
                          data-testid={`input-paid-${item.id}`}
                        />
                      ) : (
                        formatMoney(parseFloat(item.paidAmount || '0'))
                      )}
                    </TableCell>
                    <TableCell>{item.paidAt ? formatDate(item.paidAt) : '-'}</TableCell>
                    <TableCell>{getItemStatusBadge(item.status)}</TableCell>
                    <TableCell>
                      {item.status !== 'paid' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const closingBalance = parseFloat(item.closingBalance || '0');
                            updateItemMutation.mutate({
                              statementId: statement.id,
                              itemId: item.id,
                              paidAmount: closingBalance,
                              status: 'paid'
                            });
                          }}
                          data-testid={`button-mark-item-paid-${item.id}`}
                        >
                          {t.markPaid}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center text-muted-foreground">
                      {language === 'uz' ? 'Ma\'lumot yo\'q' : 'Нет данных'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  // List of all statements
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-2xl font-semibold">{t.title}</h2>
        <AlertDialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-statement">
            {t.createStatement}
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.createStatement}</AlertDialogTitle>
              <AlertDialogDescription>
                <Input 
                  placeholder={t.period}
                  value={newPeriod}
                  onChange={(e) => setNewPeriod(e.target.value)}
                  className="mt-4"
                  data-testid="input-period"
                />
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => createMutation.mutate(newPeriod)}
                disabled={!newPeriod || !/^\d{4}-\d{2}$/.test(newPeriod)}
                data-testid="button-confirm-create"
              >
                {t.create}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : statements && (statements as any[]).length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.period}</TableHead>
                  <TableHead>{t.status}</TableHead>
                  <TableHead className="text-right">{t.totalAmount}</TableHead>
                  <TableHead className="text-right">{t.totalPaid}</TableHead>
                  <TableHead>{t.createdAt}</TableHead>
                  <TableHead>{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(statements as any[]).map((stmt) => (
                  <TableRow key={stmt.id}>
                    <TableCell className="font-medium">{stmt.periodMonth}</TableCell>
                    <TableCell>{getStatusBadge(stmt.status)}</TableCell>
                    <TableCell className="text-right">{formatMoney(parseFloat(stmt.totalAmount || '0'))}</TableCell>
                    <TableCell className="text-right">{formatMoney(parseFloat(stmt.totalPaid || '0'))}</TableCell>
                    <TableCell>{formatDate(stmt.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2 flex-wrap">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => setSelectedStatement(stmt.id)}
                          data-testid={`button-view-${stmt.id}`}
                        >
                          {t.view}
                        </Button>
                        {stmt.status === 'draft' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => finalizeMutation.mutate(stmt.id)}
                              data-testid={`button-finalize-${stmt.id}`}
                            >
                              {t.finalize}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => deleteMutation.mutate(stmt.id)}
                              data-testid={`button-delete-${stmt.id}`}
                            >
                              {t.delete}
                            </Button>
                          </>
                        )}
                        {stmt.status === 'finalized' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => markPaidMutation.mutate(stmt.id)}
                            data-testid={`button-mark-paid-${stmt.id}`}
                          >
                            {t.markPaid}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">{t.noStatements}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PushNotificationsSection({ language }: { language: 'ru' | 'uz' }) {
  const ru = language === 'ru';
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const t = {
    pageTitle: ru ? 'Push-уведомления' : 'Push-bildirishnomalar',
    pageDesc: ru ? 'Отправка разовых уведомлений всем пользователям приложения' : 'Barcha ilova foydalanuvchilariga bir martalik bildirishnoma yuborish',
    totalTokens: ru ? 'Устройств зарегистрировано' : 'Ro\'yxatdan o\'tgan qurilmalar',
    compose: ru ? 'Новое уведомление' : 'Yangi bildirishnoma',
    titleLabel: ru ? 'Заголовок' : 'Sarlavha',
    bodyLabel: ru ? 'Текст уведомления' : 'Bildirishnoma matni',
    titlePlaceholder: ru ? 'Например: Новая функция!' : 'Masalan: Yangi funksiya!',
    bodyPlaceholder: ru ? 'Текст, который увидит пользователь...' : 'Foydalanuvchi ko\'radigan matn...',
    send: ru ? 'Отправить всем' : 'Barchasiga yuborish',
    confirmTitle: ru ? 'Отправить уведомление?' : 'Bildirishnoma yuborilsinmi?',
    confirmDesc: (n: number) => ru ? `Уведомление будет отправлено ${n} устройствам. Это действие нельзя отменить.` : `Bildirishnoma ${n} ta qurilmaga yuboriladi. Bu amalni bekor qilib bo\'lmaydi.`,
    cancel: ru ? 'Отмена' : 'Bekor qilish',
    history: ru ? 'История рассылок' : 'Tarqatish tarixi',
    sent: ru ? 'Отправлено' : 'Yuborildi',
    errors: ru ? 'Ошибки' : 'Xatolar',
    devices: ru ? 'Устройств' : 'Qurilmalar',
    stale: ru ? 'Удалено устаревших' : 'Eskirgan o\'chirildi',
    noHistory: ru ? 'Рассылок пока не было' : 'Hali tarqatishlar bo\'lmagan',
    successSent: (sent: number, total: number) => ru ? `Отправлено ${sent} из ${total} устройств` : `${total} ta dan ${sent} ta qurilmaga yuborildi`,
  };

  const tokensQuery = useQuery<{ count: number }>({
    queryKey: ['/api/admin/push/token-count'],
    queryFn: async () => {
      const res = await fetch('/api/admin/push/token-count', { credentials: 'include' });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
  });

  const broadcastsQuery = useQuery<Array<{
    id: number; title: string; body: string;
    totalTokens: number; sentCount: number; errorCount: number; staleRemoved: number; createdAt: string;
  }>>({
    queryKey: ['/api/admin/push/broadcasts'],
  });

  const broadcastMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/admin/push/broadcast', { title, body })
        .then(r => r.json() as Promise<{ totalTokens: number; sent: number; errors: any[]; staleRemoved: number; expoApiError?: string }>),
    onSuccess: (data) => {
      setConfirmOpen(false);
      setTitle('');
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/push/broadcasts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/push/token-count'] });
      if (data.expoApiError) {
        toast({ title: ru ? 'Ошибка Expo API' : 'Expo API xatosi', variant: 'destructive' });
      } else {
        toast({ title: t.successSent(data.sent, data.totalTokens) });
      }
    },
    onError: () => {
      setConfirmOpen(false);
      toast({ title: ru ? 'Ошибка отправки' : 'Yuborishda xato', variant: 'destructive' });
    },
  });

  const tokenCount = tokensQuery.data?.count ?? 0;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t.pageTitle}</h1>
        <p className="text-muted-foreground mt-1">{t.pageDesc}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Bell className="h-8 w-8 text-primary opacity-80" />
              <div>
                <div className="text-2xl font-bold">{tokensQuery.isLoading ? '…' : tokenCount}</div>
                <div className="text-sm text-muted-foreground">{t.totalTokens}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Send className="h-8 w-8 text-primary opacity-80" />
              <div>
                <div className="text-2xl font-bold">{broadcastsQuery.data?.length ?? '…'}</div>
                <div className="text-sm text-muted-foreground">{ru ? 'Рассылок всего' : 'Jami tarqatishlar'}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500 opacity-80" />
              <div>
                <div className="text-2xl font-bold">
                  {broadcastsQuery.data ? broadcastsQuery.data.reduce((s, b) => s + b.sentCount, 0) : '…'}
                </div>
                <div className="text-sm text-muted-foreground">{ru ? 'Доставлено всего' : 'Jami yetkazildi'}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.compose}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t.titleLabel}</label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t.titlePlaceholder}
              maxLength={100}
              data-testid="input-push-title"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t.bodyLabel}</label>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={t.bodyPlaceholder}
              rows={3}
              maxLength={300}
              data-testid="input-push-body"
            />
          </div>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!title.trim() || !body.trim() || broadcastMutation.isPending}
            data-testid="button-push-send"
          >
            <Bell className="h-4 w-4 mr-2" />
            {t.send}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.history}</CardTitle>
        </CardHeader>
        <CardContent>
          {broadcastsQuery.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : !broadcastsQuery.data?.length ? (
            <div className="text-center py-8 text-muted-foreground">{t.noHistory}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.titleLabel}</TableHead>
                  <TableHead className="text-right">{t.devices}</TableHead>
                  <TableHead className="text-right">{t.sent}</TableHead>
                  <TableHead className="text-right">{t.errors}</TableHead>
                  <TableHead className="text-right">{ru ? 'Дата' : 'Sana'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {broadcastsQuery.data.map(b => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="font-medium">{b.title}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-xs">{b.body}</div>
                    </TableCell>
                    <TableCell className="text-right">{b.totalTokens}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-600 font-medium">{b.sentCount}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {b.errorCount > 0 ? <span className="text-destructive">{b.errorCount}</span> : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {formatDate(b.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.confirmDesc(tokenCount)}
              {title && <div className="mt-3 p-3 bg-muted rounded-md text-sm"><strong>{title}</strong><br />{body}</div>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => broadcastMutation.mutate()}
              disabled={broadcastMutation.isPending}
              data-testid="button-push-confirm"
            >
              {broadcastMutation.isPending ? (ru ? 'Отправка…' : 'Yuborilmoqda…') : t.send}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SettingsSection({ language }: { language: 'ru' | 'uz' }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pushMaxInput, setPushMaxInput] = useState('');
  const [testPushResult, setTestPushResult] = useState<{
    totalTokens: number;
    sent: number;
    errors: Array<{ token: string; error: string; code?: string }>;
    staleRemoved: number;
    expoApiError?: string;
  } | null>(null);
  const changePassword = useChangePassword();
  const { toast } = useToast();

  const pushSettingsQuery = useQuery<{ maxPerHour: number }>({
    queryKey: ['/api/admin/push-settings'],
  });

  const pushSettingsMutation = useMutation({
    mutationFn: (maxPerHour: number) =>
      apiRequest('PATCH', '/api/admin/push-settings', { maxPerHour }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/push-settings'] });
      toast({ title: language === 'ru' ? 'Настройки уведомлений сохранены' : 'Bildirishnoma sozlamalari saqlandi' });
    },
    onError: () => {
      toast({ title: language === 'ru' ? 'Ошибка при сохранении' : 'Saqlashda xato', variant: 'destructive' });
    },
  });

  const testPushMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/admin/push/test-send', {
        title: 'Тест push-уведомлений',
        body: 'Если вы видите это — уведомления работают!',
      }).then((r) => r.json() as Promise<{ totalTokens: number; sent: number; errors: Array<{ token: string; error: string; code?: string }>; staleRemoved: number; expoApiError?: string }>),
    onSuccess: (data) => {
      setTestPushResult(data);
      if (data.expoApiError) {
        toast({ title: language === 'ru' ? 'Ошибка Expo API' : 'Expo API xatosi', variant: 'destructive' });
      } else if (data.errors.length > 0 && data.sent === 0) {
        toast({ title: language === 'ru' ? 'Все токены вернули ошибку' : 'Barcha tokenlar xato qaytardi', variant: 'destructive' });
      } else {
        toast({ title: language === 'ru' ? `Отправлено ${data.sent} из ${data.totalTokens}` : `${data.totalTokens} dan ${data.sent} ta yuborildi` });
      }
    },
    onError: () => {
      toast({ title: language === 'ru' ? 'Ошибка отправки теста' : 'Test yuborishda xato', variant: 'destructive' });
    },
  });

  useEffect(() => {
    if (pushSettingsQuery.data) {
      setPushMaxInput(String(pushSettingsQuery.data.maxPerHour));
    }
  }, [pushSettingsQuery.data]);

  const handlePushSettingsSave = () => {
    const val = parseInt(pushMaxInput, 10);
    if (isNaN(val) || val < 0 || val > 10000) {
      toast({ title: language === 'ru' ? 'Введите число от 0 до 10000 (0 = без лимита)' : '0 dan 10000 gacha raqam kiriting (0 = chekovsiz)', variant: 'destructive' });
      return;
    }
    pushSettingsMutation.mutate(val);
  };

  const texts = {
    ru: {
      title: 'Настройки',
      changePassword: 'Изменить пароль',
      currentPassword: 'Текущий пароль',
      newPassword: 'Новый пароль',
      confirmPassword: 'Подтвердите пароль',
      save: 'Сохранить',
      passwordMismatch: 'Пароли не совпадают',
      passwordTooShort: 'Пароль должен содержать минимум 6 символов',
      success: 'Пароль успешно изменён',
      error: 'Ошибка при изменении пароля'
    },
    uz: {
      title: 'Sozlamalar',
      changePassword: 'Parolni o\'zgartirish',
      currentPassword: 'Joriy parol',
      newPassword: 'Yangi parol',
      confirmPassword: 'Parolni tasdiqlang',
      save: 'Saqlash',
      passwordMismatch: 'Parollar mos kelmaydi',
      passwordTooShort: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak',
      success: 'Parol muvaffaqiyatli o\'zgartirildi',
      error: 'Parolni o\'zgartirishda xato'
    }
  };

  const t = texts[language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({ title: t.passwordMismatch, variant: 'destructive' });
      return;
    }
    
    if (newPassword.length < 6) {
      toast({ title: t.passwordTooShort, variant: 'destructive' });
      return;
    }
    
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword, language });
      toast({ title: t.success });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({ 
        title: error.message || t.error, 
        variant: 'destructive' 
      });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold" data-testid="text-settings-title">{t.title}</h1>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t.changePassword}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.currentPassword}</label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  data-testid="input-current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  data-testid="button-toggle-current-password"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.newPassword}</label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  data-testid="input-new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  data-testid="button-toggle-new-password"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.confirmPassword}</label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  data-testid="input-confirm-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  data-testid="button-toggle-confirm-password"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={changePassword.isPending}
              data-testid="button-change-password"
            >
              {changePassword.isPending ? '...' : t.save}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {language === 'ru' ? 'Push-уведомления' : 'Push-bildirishnomalar'}
          </CardTitle>
          <CardDescription>
            {language === 'ru'
              ? 'Лимит уведомлений и диагностика доставки'
              : 'Bildirishnoma limiti va yetkazib berish diagnostikasi'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">
              {language === 'ru' ? 'Лимит на устройство (0 = без лимита)' : 'Qurilma limiti (0 = chekovsiz)'}
            </p>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                max={10000}
                value={pushMaxInput}
                onChange={(e) => setPushMaxInput(e.target.value)}
                disabled={pushSettingsQuery.isLoading}
                className="w-24"
                data-testid="input-push-max-per-hour"
              />
              <span className="text-sm text-muted-foreground">
                {language === 'ru' ? 'уведомлений / час' : 'bildirishnoma / soat'}
              </span>
              <Button
                onClick={handlePushSettingsSave}
                disabled={pushSettingsMutation.isPending || pushSettingsQuery.isLoading}
                data-testid="button-save-push-settings"
              >
                {pushSettingsMutation.isPending ? '...' : t.save}
              </Button>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              {language === 'ru' ? 'Тест-отправка' : 'Test yuborish'}
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              {language === 'ru'
                ? 'Отправляет тестовое уведомление на все зарегистрированные устройства (без учёта лимита). Позволяет проверить, работает ли FCM.'
                : 'Barcha ro\'yxatdan o\'tgan qurilmalarga test bildirishnoma yuboradi (limit hisoblanmaydi). FCM ishlayotganligini tekshirish imkonini beradi.'}
            </p>
            <Button
              variant="outline"
              onClick={() => { setTestPushResult(null); testPushMutation.mutate(); }}
              disabled={testPushMutation.isPending}
              data-testid="button-test-push"
            >
              <FlaskConical className="h-4 w-4 mr-2" />
              {testPushMutation.isPending
                ? (language === 'ru' ? 'Отправка...' : 'Yuborilmoqda...')
                : (language === 'ru' ? 'Отправить тест' : 'Test yuborish')}
            </Button>

            {testPushResult && (
              <div className="mt-3 rounded-md border p-3 space-y-1 text-sm" data-testid="div-test-push-result">
                {testPushResult.expoApiError ? (
                  <div className="flex items-start gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{language === 'ru' ? 'Ошибка Expo API: ' : 'Expo API xatosi: '}{testPushResult.expoApiError}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                    <span>
                      {language === 'ru'
                        ? `Токенов: ${testPushResult.totalTokens} | Доставлено: ${testPushResult.sent} | Ошибок: ${testPushResult.errors.length}`
                        : `Tokenlar: ${testPushResult.totalTokens} | Yetkazildi: ${testPushResult.sent} | Xatolar: ${testPushResult.errors.length}`}
                      {testPushResult.staleRemoved > 0 && ` | ${language === 'ru' ? 'Устаревших удалено' : 'Eskirganlar o\'chirildi'}: ${testPushResult.staleRemoved}`}
                    </span>
                  </div>
                )}
                {testPushResult.errors.length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-1 mt-2">
                    {testPushResult.errors.slice(0, 5).map((e, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="font-mono shrink-0">{e.token}</span>
                        <span>{e.code ? `[${e.code}] ` : ''}{e.error}</span>
                      </div>
                    ))}
                    {testPushResult.errors.length > 5 && (
                      <div>… и ещё {testPushResult.errors.length - 5}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              {language === 'ru' ? 'Настройка FCM (обязательно для Android)' : 'FCM sozlash (Android uchun majburiy)'}
            </p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>
                {language === 'ru'
                  ? 'Откройте Firebase Console → Project Settings → Cloud Messaging → скопируйте Server Key'
                  : 'Firebase Console → Project Settings → Cloud Messaging → Server Key ni nusxalang'}
              </li>
              <li>
                {language === 'ru'
                  ? 'Перейдите на expo.dev → ваш проект → Credentials → Android → добавьте FCM Server Key'
                  : 'expo.dev → loyiha → Credentials → Android → FCM Server Key qo\'shing'}
              </li>
              <li>
                {language === 'ru'
                  ? 'Пересоберите APK через EAS Build и загрузите в Play Console'
                  : 'EAS Build orqali APK ni qayta yarating va Play Console ga yuklang'}
              </li>
            </ol>
            <a
              href="https://expo.dev/accounts/yukbozor/projects/yukbozoruz/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              data-testid="link-expo-credentials"
            >
              <ExternalLink className="h-3 w-3" />
              expo.dev Credentials
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ChannelTypeSection - Subcomponent for managing channels of a specific type
function ChannelTypeSection({ 
  language, 
  channelType, 
  title, 
  description, 
  botName,
  showSchedule = false,
}: { 
  language: 'ru' | 'uz'; 
  channelType: 'orders' | 'announcements' | 'ai_source' | 'broadcast' | 'promo';
  title: string;
  description: string;
  botName: string;
  showSchedule?: boolean;
}) {
  const { toast } = useToast();
  const [newChatId, setNewChatId] = useState('');
  const [newName, setNewName] = useState('');
  const [newInterval, setNewInterval] = useState('5');
  const [newFrom, setNewFrom] = useState('9');
  const [newTo, setNewTo] = useState('21');
  const [newTimezone, setNewTimezone] = useState('Asia/Tashkent');
  const [editingChannel, setEditingChannel] = useState<{ id: number; name: string; isActive: boolean; intervalMinutes: number; activeHoursFrom: number; activeHoursTo: number; timezone: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [blockedUsersChannelId, setBlockedUsersChannelId] = useState<number | null>(null);
  const [blockedUsersText, setBlockedUsersText] = useState('');

  const texts = {
    ru: {
      chatId: 'ID канала',
      chatIdPlaceholder: '@channel_name или -1001234567890',
      name: 'Название',
      namePlaceholder: 'Название канала',
      add: 'Добавить',
      active: 'Активен',
      inactive: 'Неактивен',
      save: 'Сохранить',
      cancel: 'Отмена',
      confirmDelete: 'Подтвердите удаление',
      confirmDeleteText: 'Вы уверены, что хотите удалить этот канал?',
      noChannels: 'Каналы не настроены. Уведомления отправляются в канал по умолчанию.',
      error: 'Ошибка',
      success: 'Успешно',
      channelAdded: 'Канал успешно добавлен',
      channelUpdated: 'Канал успешно обновлён',
      channelDeleted: 'Канал удалён',
      delete: 'Удалить',
      status: 'Статус',
      actions: 'Действия',
      bot: 'Бот'
    },
    uz: {
      chatId: 'Kanal ID',
      chatIdPlaceholder: '@kanal_nomi yoki -1001234567890',
      name: 'Nomi',
      namePlaceholder: 'Kanal nomi',
      add: 'Qo\'shish',
      active: 'Faol',
      inactive: 'Faol emas',
      save: 'Saqlash',
      cancel: 'Bekor qilish',
      confirmDelete: 'O\'chirishni tasdiqlang',
      confirmDeleteText: 'Ushbu kanalni o\'chirishni xohlaysizmi?',
      noChannels: 'Kanallar sozlanmagan. Xabarlar standart kanalga yuboriladi.',
      error: 'Xato',
      success: 'Muvaffaqiyatli',
      channelAdded: 'Kanal muvaffaqiyatli qo\'shildi',
      channelUpdated: 'Kanal muvaffaqiyatli yangilandi',
      channelDeleted: 'Kanal o\'chirildi',
      delete: 'O\'chirish',
      status: 'Holat',
      actions: 'Amallar',
      bot: 'Bot'
    }
  };

  const t = texts[language];

  const { data: channels, isLoading, refetch } = useQuery<{ id: number; chatId: string; name: string; isActive: boolean; createdAt: string; channelType: string; intervalMinutes: number; activeHoursFrom: number; activeHoursTo: number; timezone: string; lastSentAt: string | null; blockedUserIds: string[] | null }[]>({
    queryKey: ['/api/admin/telegram-channels', channelType],
    queryFn: async () => {
      const res = await fetch(`/api/admin/telegram-channels?type=${channelType}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch channels');
      return res.json();
    }
  });

  const addChannel = useMutation({
    mutationFn: async (payload: { chatId: string; name: string; intervalMinutes?: number; activeHoursFrom?: number; activeHoursTo?: number }) => {
      const res = await fetch('/api/admin/telegram-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...payload, channelType })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to add channel');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t.success, description: t.channelAdded });
      setNewChatId('');
      setNewName('');
      refetch();
    },
    onError: (error: Error) => {
      toast({ title: t.error, description: error.message, variant: 'destructive' });
    }
  });

  const updateChannel = useMutation({
    mutationFn: async (payload: { id: number; name: string; isActive: boolean; intervalMinutes?: number; activeHoursFrom?: number; activeHoursTo?: number; blockedUserIds?: string[] }) => {
      const { id, ...rest } = payload;
      const res = await fetch(`/api/admin/telegram-channels/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(rest)
      });
      if (!res.ok) throw new Error('Failed to update channel');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t.success, description: t.channelUpdated });
      setEditingChannel(null);
      refetch();
    },
    onError: (error: Error) => {
      toast({ title: t.error, description: error.message, variant: 'destructive' });
    }
  });

  const deleteChannel = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/telegram-channels/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to delete channel');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t.success, description: t.channelDeleted });
      setDeleteConfirmId(null);
      refetch();
    },
    onError: (error: Error) => {
      toast({ title: t.error, description: error.message, variant: 'destructive' });
    }
  });

  const handleAddChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatId.trim() || !newName.trim()) return;
    const payload: { chatId: string; name: string; intervalMinutes?: number; activeHoursFrom?: number; activeHoursTo?: number; timezone?: string } = {
      chatId: newChatId.trim(),
      name: newName.trim(),
    };
    if (showSchedule) {
      payload.intervalMinutes = Math.max(1, parseInt(newInterval) || 5);
      payload.activeHoursFrom = Math.max(0, Math.min(23, parseInt(newFrom) || 0));
      payload.activeHoursTo = Math.max(0, Math.min(24, parseInt(newTo) || 24));
      payload.timezone = newTimezone.trim() || 'Asia/Tashkent';
    }
    addChannel.mutate(payload);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline" className="w-fit">
          {t.bot}: @{botName}
        </Badge>
      </div>

      <Card>
        <CardContent className="pt-4">
          <form onSubmit={handleAddChannel} className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <Input
                  placeholder={t.chatIdPlaceholder}
                  value={newChatId}
                  onChange={(e) => setNewChatId(e.target.value)}
                  data-testid={`input-channel-id-${channelType}`}
                />
              </div>
              <div className="flex-1">
                <Input
                  placeholder={t.namePlaceholder}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  data-testid={`input-channel-name-${channelType}`}
                />
              </div>
              {!showSchedule && (
                <Button 
                  type="submit" 
                  disabled={addChannel.isPending || !newChatId.trim() || !newName.trim()}
                  data-testid={`button-add-channel-${channelType}`}
                >
                  {t.add}
                </Button>
              )}
            </div>
            {showSchedule && (
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">
                    {language === 'ru' ? 'Интервал (мин)' : 'Interval (daq)'}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={newInterval}
                    onChange={(e) => setNewInterval(e.target.value)}
                    data-testid={`input-channel-interval-${channelType}`}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">
                    {language === 'ru' ? 'С (час, Ташкент)' : 'Dan (soat, Toshkent)'}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={newFrom}
                    onChange={(e) => setNewFrom(e.target.value)}
                    data-testid={`input-channel-from-${channelType}`}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">
                    {language === 'ru' ? 'По (час)' : 'Gacha (soat)'}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={24}
                    value={newTo}
                    onChange={(e) => setNewTo(e.target.value)}
                    data-testid={`input-channel-to-${channelType}`}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">
                    {language === 'ru' ? 'Таймзона' : 'Vaqt mintaqasi'}
                  </label>
                  <Input
                    type="text"
                    value={newTimezone}
                    onChange={(e) => setNewTimezone(e.target.value)}
                    placeholder="Asia/Tashkent"
                    data-testid={`input-channel-timezone-${channelType}`}
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    type="submit" 
                    disabled={addChannel.isPending || !newChatId.trim() || !newName.trim()}
                    data-testid={`button-add-channel-${channelType}`}
                  >
                    {t.add}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !channels?.length ? (
            <p className="text-muted-foreground text-center py-6">{t.noChannels}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.chatId}</TableHead>
                  <TableHead>{t.name}</TableHead>
                  {showSchedule && (
                    <TableHead className="text-center">
                      {language === 'ru' ? 'Расписание' : 'Jadval'}
                    </TableHead>
                  )}
                  <TableHead className="text-center">{t.status}</TableHead>
                  <TableHead className="text-right">{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((channel) => (
                  <TableRow key={channel.id} data-testid={`row-channel-${channelType}-${channel.id}`}>
                    <TableCell className="font-mono text-sm">{channel.chatId}</TableCell>
                    <TableCell>
                      {editingChannel?.id === channel.id ? (
                        <Input
                          value={editingChannel.name}
                          onChange={(e) => setEditingChannel({ ...editingChannel, name: e.target.value })}
                          className="w-full"
                        />
                      ) : (
                        channel.name
                      )}
                    </TableCell>
                    {showSchedule && (
                      <TableCell className="text-center text-sm">
                        {editingChannel?.id === channel.id ? (
                          <div className="flex gap-1 justify-center">
                            <Input
                              type="number"
                              min={1}
                              className="w-16 h-8 text-xs"
                              value={editingChannel.intervalMinutes}
                              onChange={(e) => setEditingChannel({ ...editingChannel, intervalMinutes: parseInt(e.target.value) || 5 })}
                            />
                            <Input
                              type="number"
                              min={0}
                              max={23}
                              className="w-12 h-8 text-xs"
                              value={editingChannel.activeHoursFrom}
                              onChange={(e) => setEditingChannel({ ...editingChannel, activeHoursFrom: parseInt(e.target.value) || 0 })}
                            />
                            <Input
                              type="number"
                              min={0}
                              max={24}
                              className="w-12 h-8 text-xs"
                              value={editingChannel.activeHoursTo}
                              onChange={(e) => setEditingChannel({ ...editingChannel, activeHoursTo: parseInt(e.target.value) || 24 })}
                            />
                            <Input
                              type="text"
                              className="w-28 h-8 text-xs"
                              value={editingChannel.timezone}
                              onChange={(e) => setEditingChannel({ ...editingChannel, timezone: e.target.value })}
                              placeholder="Asia/Tashkent"
                              data-testid={`input-edit-timezone-${channel.id}`}
                            />
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            {channel.intervalMinutes}{language === 'ru' ? 'м' : 'd'} · {channel.activeHoursFrom}-{channel.activeHoursTo}h · {channel.timezone || 'Asia/Tashkent'}
                          </span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-center">
                      {editingChannel?.id === channel.id ? (
                        <Button
                          variant={editingChannel.isActive ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setEditingChannel({ ...editingChannel, isActive: !editingChannel.isActive })}
                        >
                          {editingChannel.isActive ? t.active : t.inactive}
                        </Button>
                      ) : (
                        <Badge variant={channel.isActive ? 'default' : 'secondary'}>
                          {channel.isActive ? t.active : t.inactive}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingChannel?.id === channel.id ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateChannel.mutate({
                              id: editingChannel.id,
                              name: editingChannel.name,
                              isActive: editingChannel.isActive,
                              ...(showSchedule ? {
                                intervalMinutes: editingChannel.intervalMinutes,
                                activeHoursFrom: editingChannel.activeHoursFrom,
                                activeHoursTo: editingChannel.activeHoursTo,
                                timezone: editingChannel.timezone,
                              } : {}),
                            })}
                            disabled={updateChannel.isPending}
                          >
                            {t.save}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingChannel(null)}>
                            {t.cancel}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          {channelType === 'ai_source' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title={language === 'ru' ? 'Заблокированные пользователи' : 'Bloklangan foydalanuvchilar'}
                              onClick={() => {
                                setBlockedUsersChannelId(channel.id);
                                setBlockedUsersText((channel.blockedUserIds || []).join('\n'));
                              }}
                              data-testid={`button-blocked-users-${channel.id}`}
                            >
                              <ShieldOff className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditingChannel({
                              id: channel.id,
                              name: channel.name,
                              isActive: channel.isActive,
                              intervalMinutes: channel.intervalMinutes,
                              activeHoursFrom: channel.activeHoursFrom,
                              activeHoursTo: channel.activeHoursTo,
                              timezone: channel.timezone || 'Asia/Tashkent',
                            })}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirmId(channel.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmDelete}</AlertDialogTitle>
            <AlertDialogDescription>{t.confirmDeleteText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteChannel.mutate(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Blocked Users Dialog (ai_source only) */}
      <Dialog open={blockedUsersChannelId !== null} onOpenChange={(open) => { if (!open) setBlockedUsersChannelId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === 'ru' ? 'Заблокированные пользователи' : 'Bloklangan foydalanuvchilar'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ru'
                ? 'Telegram ID или username (по одному на строку). Сообщения от этих пользователей будут молча проигнорированы.'
                : 'Telegram ID yoki username (har qatorga bittadan). Bu foydalanuvchilardan kelgan xabarlar o\'tkazib yuboriladi.'}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="min-h-[120px] font-mono text-sm"
            placeholder={language === 'ru' ? '123456789\n@somebot\n987654321' : '123456789\n@somebot\n987654321'}
            value={blockedUsersText}
            onChange={(e) => setBlockedUsersText(e.target.value)}
            data-testid="textarea-blocked-users"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockedUsersChannelId(null)}>{t.cancel}</Button>
            <Button
              onClick={() => {
                if (blockedUsersChannelId === null) return;
                const list = blockedUsersText
                  .split(/[\n,]+/)
                  .map(s => s.trim())
                  .filter(Boolean);
                updateChannel.mutate({
                  id: blockedUsersChannelId,
                  name: channels?.find(c => c.id === blockedUsersChannelId)?.name || '',
                  isActive: channels?.find(c => c.id === blockedUsersChannelId)?.isActive ?? true,
                  blockedUserIds: list,
                });
                setBlockedUsersChannelId(null);
              }}
              disabled={updateChannel.isPending}
            >
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// PromoChannelPreviewSection - Preview next promo per channel + send test now
function PromoChannelPreviewSection({ language }: { language: 'ru' | 'uz' }) {
  const { toast } = useToast();
  const t = {
    ru: {
      title: 'Предпросмотр следующей промо-рассылки',
      description: 'Что отправит планировщик в каждый промо-канал следующим (по очереди шаблонов).',
      noChannels: 'Промо-каналы не настроены.',
      noPromo: 'Нет активных промо-сообщений.',
      sendTest: 'Отправить тест сейчас',
      sending: 'Отправка…',
      sent: 'Отправлено',
      error: 'Ошибка',
      ru: 'RU', uz: 'UZ',
    },
    uz: {
      title: 'Keyingi promo rassilkani ko\'rish',
      description: 'Rejalashtiruvchi har bir promo kanaliga keyingi qanday xabarni yuborishini ko\'rsatadi.',
      noChannels: 'Promo kanallar sozlanmagan.',
      noPromo: 'Faol promo xabarlar yo\'q.',
      sendTest: 'Test yuborish',
      sending: 'Yuborilmoqda…',
      sent: 'Yuborildi',
      error: 'Xato',
      ru: 'RU', uz: 'UZ',
    },
  }[language];

  const { data: channels, isLoading } = useQuery<{ id: number; name: string; chatId: string; isActive: boolean }[]>({
    queryKey: ['/api/admin/telegram-channels', 'promo'],
    queryFn: async () => {
      const res = await fetch('/api/admin/telegram-channels?type=promo', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold" data-testid="text-promo-preview-title">{t.title}</h3>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </div>
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : !channels?.length ? (
        <Card><CardContent className="pt-4 text-center text-muted-foreground">{t.noChannels}</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {channels.map((ch) => (
            <PromoChannelPreviewCard
              key={ch.id}
              channel={ch}
              labels={t}
              onError={(msg) => toast({ title: t.error, description: msg, variant: 'destructive' })}
              onSent={() => toast({ title: t.sent })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PromoChannelPreviewCard({
  channel,
  labels,
  onError,
  onSent,
}: {
  channel: { id: number; name: string; chatId: string; isActive: boolean };
  labels: { noPromo: string; sendTest: string; sending: string; ru: string; uz: string };
  onError: (msg: string) => void;
  onSent: () => void;
}) {
  const { data, isLoading, refetch } = useQuery<{ promo: { id: number; textRu: string; textUz: string } | null }>({
    queryKey: ['/api/admin/telegram-channels', channel.id, 'next-promo'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/telegram-channels/${channel.id}/next-promo`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const sendTest = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/telegram-channels/${channel.id}/send-test-promo`, {
        method: 'POST',
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Failed');
      return body;
    },
    onSuccess: () => { onSent(); refetch(); },
    onError: (e: Error) => onError(e.message),
  });

  const promo = data?.promo;

  return (
    <Card data-testid={`card-promo-preview-${channel.id}`}>
      <CardContent className="pt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium truncate" data-testid={`text-promo-channel-name-${channel.id}`}>{channel.name}</div>
            <div className="font-mono text-xs text-muted-foreground truncate">{channel.chatId}</div>
          </div>
          <Button
            size="sm"
            onClick={() => sendTest.mutate()}
            disabled={sendTest.isPending || !promo}
            data-testid={`button-send-test-promo-${channel.id}`}
          >
            <Send className="h-4 w-4 mr-1" />
            {sendTest.isPending ? labels.sending : labels.sendTest}
          </Button>
        </div>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : !promo ? (
          <p className="text-sm text-muted-foreground">{labels.noPromo}</p>
        ) : (
          <div className="space-y-2" data-testid={`preview-next-promo-${channel.id}`}>
            <div>
              <Badge variant="outline" className="mb-1">{labels.ru}</Badge>
              <div className="text-sm whitespace-pre-wrap" data-testid={`text-next-promo-ru-${channel.id}`}>{promo.textRu}</div>
            </div>
            <div className="border-t pt-2">
              <Badge variant="outline" className="mb-1">{labels.uz}</Badge>
              <div className="text-sm whitespace-pre-wrap text-muted-foreground" data-testid={`text-next-promo-uz-${channel.id}`}>{promo.textUz}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// PromoMessagesSection - CRUD for promo message templates used by promo scheduler
function PromoMessagesSection({ language }: { language: 'ru' | 'uz' }) {
  const { toast } = useToast();
  const [textRu, setTextRu] = useState('');
  const [textUz, setTextUz] = useState('');
  const [editing, setEditing] = useState<{ id: number; textRu: string; textUz: string; isActive: boolean } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const t = {
    ru: {
      title: 'Промо-сообщения',
      description: 'Шаблоны для рассылки в промо-каналы (рандомизируется по очереди)',
      placeholderRu: 'Текст на русском…',
      placeholderUz: 'Matn o\'zbek tilida…',
      add: 'Добавить', save: 'Сохранить', cancel: 'Отмена', delete: 'Удалить',
      empty: 'Нет промо-сообщений.', active: 'Активно', inactive: 'Не активно',
      success: 'Готово', error: 'Ошибка',
      confirmTitle: 'Удалить сообщение?',
      confirmText: 'Это действие необратимо.',
    },
    uz: {
      title: 'Promo xabarlar',
      description: 'Promo kanallariga yuborish uchun shablonlar (navbatma-navbat)',
      placeholderRu: 'Rus tilida matn…',
      placeholderUz: 'O\'zbek tilida matn…',
      add: 'Qo\'shish', save: 'Saqlash', cancel: 'Bekor qilish', delete: 'O\'chirish',
      empty: 'Promo xabarlar yo\'q.', active: 'Faol', inactive: 'Faol emas',
      success: 'Bajarildi', error: 'Xato',
      confirmTitle: 'Xabarni o\'chirasizmi?',
      confirmText: 'Bu amalni qaytarib bo\'lmaydi.',
    }
  }[language];

  const { data: messages, isLoading, refetch } = useQuery<{ id: number; textRu: string; textUz: string; isActive: boolean }[]>({
    queryKey: ['/api/admin/telegram-promo-messages'],
  });

  const addMutation = useMutation({
    mutationFn: async (payload: { textRu: string; textUz: string }) => {
      const res = await fetch('/api/admin/telegram-promo-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => { toast({ title: t.success }); setTextRu(''); setTextUz(''); refetch(); },
    onError: (e: Error) => toast({ title: t.error, description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: number; textRu: string; textUz: string; isActive: boolean }) => {
      const { id, ...rest } = payload;
      const res = await fetch(`/api/admin/telegram-promo-messages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(rest),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => { toast({ title: t.success }); setEditing(null); refetch(); },
    onError: (e: Error) => toast({ title: t.error, description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/telegram-promo-messages/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => { toast({ title: t.success }); setDeleteConfirmId(null); refetch(); },
    onError: (e: Error) => toast({ title: t.error, description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{t.title}</h3>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </div>
      <Card>
        <CardContent className="pt-4 space-y-3">
          <Textarea
            placeholder={t.placeholderRu}
            value={textRu}
            onChange={(e) => setTextRu(e.target.value)}
            rows={3}
            data-testid="input-promo-textRu"
          />
          <Textarea
            placeholder={t.placeholderUz}
            value={textUz}
            onChange={(e) => setTextUz(e.target.value)}
            rows={3}
            data-testid="input-promo-textUz"
          />
          <div className="flex justify-end">
            <Button
              onClick={() => addMutation.mutate({ textRu: textRu.trim(), textUz: textUz.trim() })}
              disabled={addMutation.isPending || !textRu.trim() || !textUz.trim()}
              data-testid="button-add-promo"
            >
              {t.add}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : !messages?.length ? (
            <p className="text-muted-foreground text-center py-6">{t.empty}</p>
          ) : (
            <div className="space-y-3">
              {messages.map((m) => (
                <div key={m.id} className="border rounded-md p-3 space-y-2" data-testid={`row-promo-${m.id}`}>
                  {editing?.id === m.id ? (
                    <>
                      <Textarea
                        value={editing.textRu}
                        onChange={(e) => setEditing({ ...editing, textRu: e.target.value })}
                        rows={3}
                      />
                      <Textarea
                        value={editing.textUz}
                        onChange={(e) => setEditing({ ...editing, textUz: e.target.value })}
                        rows={3}
                      />
                      <div className="flex justify-between items-center">
                        <Button
                          variant={editing.isActive ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setEditing({ ...editing, isActive: !editing.isActive })}
                        >
                          {editing.isActive ? t.active : t.inactive}
                        </Button>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditing(null)}>{t.cancel}</Button>
                          <Button size="sm" onClick={() => updateMutation.mutate(editing)} disabled={updateMutation.isPending}>{t.save}</Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm whitespace-pre-wrap">{m.textRu}</div>
                      <div className="text-sm whitespace-pre-wrap text-muted-foreground border-t pt-2">{m.textUz}</div>
                      <div className="flex justify-between items-center pt-1">
                        <Badge variant={m.isActive ? 'default' : 'secondary'}>
                          {m.isActive ? t.active : t.inactive}
                        </Badge>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" onClick={() => setEditing({ id: m.id, textRu: m.textRu, textUz: m.textUz, isActive: m.isActive })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteConfirmId(m.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.confirmText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// SkippedMessagesSection - Admin UI listing Telegram messages from ai_source
// channels that were not converted into announcements. Shows the original
// text and reason; admins can clear or retry.
type SkippedMessage = {
  id: number;
  chatId: string;
  chatTitle: string | null;
  messageId: number;
  text: string;
  reason: 'not_cargo' | 'parser_error' | 'insert_error';
  errorDetail: string | null;
  createdAt: string;
};

function SkippedMessagesSection({ language }: { language: 'ru' | 'uz' }) {
  const { toast } = useToast();
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  const t = {
    ru: {
      title: 'Пропущенные сообщения AI-источников',
      description: 'Сообщения из AI-источников, которые ИИ не смог распознать или сохранить как объявление.',
      empty: 'Пропущенных сообщений нет.',
      reasonNotCargo: 'Не груз',
      reasonParserError: 'Ошибка парсера',
      reasonInsertError: 'Ошибка сохранения',
      retry: 'Повторить',
      edit: 'Редактировать',
      clear: 'Удалить',
      retried: 'Сообщение успешно обработано',
      retryFailed: 'Повтор не удался',
      cleared: 'Удалено',
      error: 'Ошибка',
      confirmTitle: 'Удалить запись?',
      confirmText: 'Сообщение будет удалено из списка пропущенных. Это действие необратимо.',
      cancel: 'Отмена',
      delete: 'Удалить',
      from: 'Из',
      msg: 'msg',
      editTitle: 'Редактировать и повторить',
      editDescription: 'Исправьте текст сообщения и нажмите «Сохранить и повторить». Если разбор пройдёт успешно, объявление будет создано, а запись удалена из списка.',
      saveAndRetry: 'Сохранить и повторить',
      tooShort: 'Текст слишком короткий',
    },
    uz: {
      title: 'AI-manbalardan o\'tkazib yuborilgan xabarlar',
      description: 'AI-manbalardan AI tan ololmagan yoki e\'lon sifatida saqlay olmagan xabarlar.',
      empty: 'O\'tkazib yuborilgan xabarlar yo\'q.',
      reasonNotCargo: 'Yuk emas',
      reasonParserError: 'Parser xatosi',
      reasonInsertError: 'Saqlash xatosi',
      retry: 'Qayta urinish',
      edit: 'Tahrirlash',
      clear: 'O\'chirish',
      retried: 'Xabar muvaffaqiyatli qayta ishlandi',
      retryFailed: 'Qayta urinish muvaffaqiyatsiz',
      cleared: 'O\'chirildi',
      error: 'Xato',
      confirmTitle: 'Yozuvni o\'chirasizmi?',
      confirmText: 'Xabar o\'tkazib yuborilganlar ro\'yxatidan o\'chiriladi. Bu amalni qaytarib bo\'lmaydi.',
      cancel: 'Bekor qilish',
      delete: 'O\'chirish',
      from: 'Manba',
      msg: 'msg',
      editTitle: 'Tahrirlash va qayta urinish',
      editDescription: 'Xabar matnini tuzating va «Saqlash va qayta urinish» tugmasini bosing. Tahlil muvaffaqiyatli bo\'lsa, e\'lon yaratiladi va yozuv ro\'yxatdan o\'chiriladi.',
      saveAndRetry: 'Saqlash va qayta urinish',
      tooShort: 'Matn juda qisqa',
    },
  }[language];

  const reasonLabel = (r: SkippedMessage['reason']) => {
    if (r === 'not_cargo') return t.reasonNotCargo;
    if (r === 'parser_error') return t.reasonParserError;
    return t.reasonInsertError;
  };
  const reasonVariant = (r: SkippedMessage['reason']): 'secondary' | 'destructive' =>
    r === 'not_cargo' ? 'secondary' : 'destructive';

  const { data: items, isLoading, refetch } = useQuery<SkippedMessage[]>({
    queryKey: ['/api/admin/telegram-skipped-messages'],
  });

  const retryMutation = useMutation({
    mutationFn: async (vars: { id: number; text?: string }) => {
      const hasText = typeof vars.text === 'string';
      const res = await fetch(`/api/admin/telegram-skipped-messages/${vars.id}/retry`, {
        method: 'POST',
        credentials: 'include',
        headers: hasText ? { 'Content-Type': 'application/json' } : undefined,
        body: hasText ? JSON.stringify({ text: vars.text }) : undefined,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || body?.reason || 'Failed');
      return body;
    },
    onSuccess: () => {
      toast({ title: t.retried });
      setEditingId(null);
      setEditingText('');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/telegram-skipped-messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/telegram-skipped-messages/count'] });
      refetch();
    },
    onError: (e: Error) => toast({ title: t.retryFailed, description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/telegram-skipped-messages/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t.cleared });
      setConfirmId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/telegram-skipped-messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/telegram-skipped-messages/count'] });
      refetch();
    },
    onError: (e: Error) => toast({ title: t.error, description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold" data-testid="text-skipped-messages-title">{t.title}</h3>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </div>
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : !items?.length ? (
            <p className="text-muted-foreground text-center py-6" data-testid="text-skipped-empty">{t.empty}</p>
          ) : (
            <div className="space-y-3">
              {items.map((m) => (
                <div
                  key={m.id}
                  className="border rounded-md p-3 space-y-2"
                  data-testid={`row-skipped-${m.id}`}
                >
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={reasonVariant(m.reason)} data-testid={`badge-skipped-reason-${m.id}`}>
                        {reasonLabel(m.reason)}
                      </Badge>
                      <span className="text-xs text-muted-foreground" data-testid={`text-skipped-source-${m.id}`}>
                        {t.from}: {m.chatTitle || m.chatId} · {t.msg} #{m.messageId}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(new Date(m.createdAt))}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => retryMutation.mutate({ id: m.id })}
                        disabled={retryMutation.isPending}
                        data-testid={`button-retry-skipped-${m.id}`}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        {t.retry}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setEditingId(m.id); setEditingText(m.text); }}
                        disabled={retryMutation.isPending}
                        data-testid={`button-edit-skipped-${m.id}`}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        {t.edit}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setConfirmId(m.id)}
                        data-testid={`button-clear-skipped-${m.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {t.clear}
                      </Button>
                    </div>
                  </div>
                  <div
                    className="text-sm whitespace-pre-wrap break-words bg-muted/30 rounded-md p-2 max-h-40 overflow-auto"
                    data-testid={`text-skipped-content-${m.id}`}
                  >
                    {m.text}
                  </div>
                  {m.errorDetail && (
                    <div
                      className="text-xs text-destructive whitespace-pre-wrap break-words"
                      data-testid={`text-skipped-error-${m.id}`}
                    >
                      {m.errorDetail}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmId !== null} onOpenChange={(open) => !open && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.confirmText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmId !== null && deleteMutation.mutate(confirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-clear-skipped"
            >
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={editingId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingId(null);
            setEditingText('');
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.editTitle}</DialogTitle>
            <DialogDescription>{t.editDescription}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            rows={10}
            maxLength={4000}
            className="font-mono text-sm"
            data-testid="textarea-edit-skipped"
          />
          <div className="text-xs text-muted-foreground text-right" data-testid="text-edit-skipped-counter">
            {editingText.length} / 4000
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => { setEditingId(null); setEditingText(''); }}
              data-testid="button-cancel-edit-skipped"
            >
              {t.cancel}
            </Button>
            <Button
              onClick={() => {
                if (editingId === null) return;
                if (editingText.trim().length < 10) {
                  toast({ title: t.tooShort, variant: 'destructive' });
                  return;
                }
                retryMutation.mutate({ id: editingId, text: editingText });
              }}
              disabled={retryMutation.isPending}
              data-testid="button-save-and-retry-skipped"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              {t.saveAndRetry}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// BotChannelSettingsCard - Toggle for bot-created announcement channel posting
function BotChannelSettingsCard({ language }: { language: 'ru' | 'uz' }) {
  const { toast } = useToast();
  const texts = {
    ru: {
      title: 'Постинг объявлений от бота',
      description: 'Разрешить боту отправлять созданные им объявления в каналы для объявлений. Если выключено — объявления от AI-источников создаются в системе, но не публикуются в Telegram-каналах.',
      enabled: 'Включено',
      disabled: 'Выключено',
      saved: 'Настройка сохранена',
      error: 'Ошибка при сохранении',
    },
    uz: {
      title: 'Bot e\'lonlarini kanallarga joylash',
      description: 'Botga AI manbalardan yaratilgan e\'lonlarni e\'lonlar kanallariga yuborishga ruxsat. O\'chirilsa — e\'lonlar tizimda yaratiladi, lekin Telegram kanallariga chiqarilmaydi.',
      enabled: 'Yoqilgan',
      disabled: 'O\'chirilgan',
      saved: 'Sozlama saqlandi',
      error: 'Saqlashda xato',
    },
  };
  const t = texts[language];

  const { data, isLoading } = useQuery<{ postToChannels: boolean }>({
    queryKey: ['/api/admin/bot-channel-settings'],
  });

  const mutation = useMutation({
    mutationFn: (postToChannels: boolean) =>
      apiRequest('PATCH', '/api/admin/bot-channel-settings', { postToChannels }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bot-channel-settings'] });
      toast({ title: t.saved });
    },
    onError: () => {
      toast({ title: t.error, variant: 'destructive' });
    },
  });

  const enabled = data?.postToChannels ?? true;

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-medium">{t.title}</div>
            <div className="text-sm text-muted-foreground mt-1">{t.description}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-muted-foreground">
              {enabled ? t.enabled : t.disabled}
            </span>
            <Switch
              data-testid="switch-bot-post-to-channels"
              checked={enabled}
              disabled={isLoading || mutation.isPending}
              onCheckedChange={(val) => mutation.mutate(val)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// TelegramBroadcastSection - Send a message to all Telegram-registered users
function TelegramBroadcastSection({ language }: { language: 'ru' | 'uz' }) {
  const t = {
    ru: {
      title: 'Рассылка в Telegram',
      description: 'Отправить сообщение всем пользователям, которые хотя бы раз использовали бот @Yukbozor_orders_bot',
      audienceLabel: 'Аудитория',
      audienceHint: 'пользователей с Telegram',
      loading: 'Загрузка...',
      messagePlaceholder: 'Текст сообщения (поддерживается HTML: <b>жирный</b>, <i>курсив</i>, <a href="url">ссылка</a>)',
      htmlMode: 'HTML-форматирование',
      send: 'Отправить всем',
      sending: 'Отправляется...',
      confirmTitle: 'Подтверждение рассылки',
      confirmText: (n: number) => `Вы уверены? Сообщение будет отправлено ${n} пользователям в Telegram.`,
      confirm: 'Отправить',
      cancel: 'Отмена',
      resultSent: 'Отправлено',
      resultFailed: 'Ошибок',
      resultTotal: 'Всего',
      resultDesc: (s: number, f: number) => f > 0 ? `${s} доставлено, ${f} не удалось (пользователь заблокировал бот или удалил чат)` : `Все ${s} сообщений доставлено успешно`,
      errorEmpty: 'Введите текст сообщения',
    },
    uz: {
      title: 'Telegram xabar tarqatish',
      description: 'Kamida bir marta @Yukbozor_orders_bot botidan foydalangan barcha foydalanuvchilarga xabar yuborish',
      audienceLabel: 'Auditoriya',
      audienceHint: 'Telegramli foydalanuvchi',
      loading: 'Yuklanmoqda...',
      messagePlaceholder: 'Xabar matni (HTML qo\'llab-quvvatlanadi: <b>qalin</b>, <i>kursiv</i>, <a href="url">havola</a>)',
      htmlMode: 'HTML formatlash',
      send: 'Barchaga yuborish',
      sending: 'Yuborilmoqda...',
      confirmTitle: 'Tarqatishni tasdiqlash',
      confirmText: (n: number) => `Ishonchingiz komilmi? Xabar ${n} ta Telegram foydalanuvchisiga yuboriladi.`,
      confirm: 'Yuborish',
      cancel: 'Bekor qilish',
      resultSent: 'Yuborildi',
      resultFailed: 'Xato',
      resultTotal: 'Jami',
      resultDesc: (s: number, f: number) => f > 0 ? `${s} ta yetkazildi, ${f} ta yetkazilmadi (foydalanuvchi botni bloklagan yoki chatni o\'chirgan)` : `Barcha ${s} ta xabar muvaffaqiyatli yetkazildi`,
      errorEmpty: 'Xabar matnini kiriting',
    },
  }[language];

  const { data: countData, isLoading: countLoading } = useQuery<{ count: number }>({
    queryKey: ['/api/admin/telegram/users-count'],
    queryFn: async () => {
      const res = await fetch('/api/admin/telegram/users-count', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const [message, setMessage] = useState('');
  const [htmlMode, setHtmlMode] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const { toast } = useToast();

  const handleSend = async () => {
    if (!message.trim()) { setErrorMsg(t.errorEmpty); return; }
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setShowConfirm(false);
    setIsSending(true);
    setResult(null);
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/telegram/broadcast', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, parseMode: htmlMode ? 'HTML' : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setResult(data);
      toast({ title: t.resultSent, description: `${data.sent} / ${data.total}` });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t.title}</h1>
        <p className="text-muted-foreground mt-1">{t.description}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t.audienceLabel}</CardTitle>
          <Send className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {countLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{countData?.count ?? 0}</span>
              <span className="text-muted-foreground text-sm">{t.audienceHint}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="htmlMode"
              checked={htmlMode}
              onChange={e => setHtmlMode(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="htmlMode" className="text-sm font-medium cursor-pointer">{t.htmlMode}</label>
          </div>

          <Textarea
            value={message}
            onChange={e => { setMessage(e.target.value); setErrorMsg(''); }}
            placeholder={t.messagePlaceholder}
            rows={8}
            className="font-mono text-sm"
            data-testid="textarea-broadcast-message"
          />

          {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

          {result && (
            <div className="rounded-md border p-4 space-y-2">
              <div className="flex gap-6 text-sm">
                <span><strong className="text-green-600">{t.resultSent}:</strong> {result.sent}</span>
                {result.failed > 0 && <span><strong className="text-destructive">{t.resultFailed}:</strong> {result.failed}</span>}
                <span><strong>{t.resultTotal}:</strong> {result.total}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t.resultDesc(result.sent, result.failed)}</p>
            </div>
          )}

          <Button
            onClick={handleSend}
            disabled={isSending || !message.trim()}
            data-testid="button-broadcast-send"
          >
            {isSending ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{t.sending}</>
            ) : (
              <><Send className="h-4 w-4 mr-2" />{t.send}</>
            )}
          </Button>
        </CardContent>
      </Card>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <CardHeader>
              <CardTitle>{t.confirmTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">{t.confirmText(countData?.count ?? 0)}</p>
              <div className="bg-muted rounded-md p-3 text-sm font-mono max-h-32 overflow-auto whitespace-pre-wrap">
                {message}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowConfirm(false)}>{t.cancel}</Button>
                <Button onClick={handleConfirm} data-testid="button-broadcast-confirm">{t.confirm}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// TelegramChannelsSection - Admin UI for managing Telegram channels (orders + announcements + AI/broadcast/promo)
function TelegramChannelsSection({ language }: { language: 'ru' | 'uz' }) {
  const texts = {
    ru: {
      title: 'Telegram каналы',
      description: 'Управление каналами для отправки уведомлений и AI-импорта',
      ordersTitle: 'Каналы для заказов',
      ordersDescription: 'Уведомления о новых заказах (yukbozor_orders_bot)',
      announcementsTitle: 'Каналы для объявлений',
      announcementsDescription: 'Уведомления о новых объявлениях (yukbozor_elon_bot)',
      aiSourceTitle: 'AI-источники (входящие)',
      aiSourceDescription: 'Группы Telegram, откуда бот читает чужие сообщения и создаёт объявления через ИИ. Бот должен быть участником группы.',
      broadcastTitle: 'Рассылка открытых грузов',
      broadcastDescription: 'Каналы, куда регулярно отправляется список открытых объявлений с сайта.',
      promoTitle: 'Промо-каналы',
      promoDescription: 'Каналы, куда по расписанию отправляются промо-сообщения (см. ниже).',
    },
    uz: {
      title: 'Telegram kanallari',
      description: 'Xabarlar va AI-import uchun kanallarni boshqarish',
      ordersTitle: 'Buyurtmalar kanallari',
      ordersDescription: 'Yangi buyurtmalar haqida xabarlar (yukbozor_orders_bot)',
      announcementsTitle: 'E\'lonlar kanallari',
      announcementsDescription: 'Yangi e\'lonlar haqida xabarlar (yukbozor_elon_bot)',
      aiSourceTitle: 'AI manbalar (kiruvchi)',
      aiSourceDescription: 'Bot xabarlarni o\'qib, AI orqali e\'lon yaratadigan Telegram guruhlari. Bot guruh a\'zosi bo\'lishi kerak.',
      broadcastTitle: 'Ochiq yuklar tarqatish',
      broadcastDescription: 'Saytdagi ochiq e\'lonlar ro\'yxati muntazam yuboriladigan kanallar.',
      promoTitle: 'Promo kanallar',
      promoDescription: 'Jadval bo\'yicha promo xabarlar yuboriladigan kanallar (quyida).',
    }
  };

  const t = texts[language];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-telegram-channels-title">{t.title}</h1>
        <p className="text-muted-foreground">{t.description}</p>
      </div>

      <ChannelTypeSection
        language={language}
        channelType="orders"
        title={t.ordersTitle}
        description={t.ordersDescription}
        botName="yukbozor_orders_bot"
      />

      <ChannelTypeSection
        language={language}
        channelType="announcements"
        title={t.announcementsTitle}
        description={t.announcementsDescription}
        botName="yukbozor_elon_bot"
      />

      <ChannelTypeSection
        language={language}
        channelType="ai_source"
        title={t.aiSourceTitle}
        description={t.aiSourceDescription}
        botName="yukbozor_elon_bot"
      />

      <BotChannelSettingsCard language={language} />

      <SkippedMessagesSection language={language} />

      <ChannelTypeSection
        language={language}
        channelType="broadcast"
        title={t.broadcastTitle}
        description={t.broadcastDescription}
        botName="yukbozor_elon_bot"
        showSchedule
      />

      <ChannelTypeSection
        language={language}
        channelType="promo"
        title={t.promoTitle}
        description={t.promoDescription}
        botName="yukbozor_elon_bot"
        showSchedule
      />

      <PromoChannelPreviewSection language={language} />

      <PromoMessagesSection language={language} />
    </div>
  );
}

const TRANSPORT_LABELS: Record<string, { ru: string; uz: string }> = {
  labo: { ru: 'Лабо', uz: 'Labo' },
  bongo: { ru: 'Бонго', uz: 'Bongo' },
  furgon: { ru: 'Фургон', uz: 'Furgon' },
  isuzu5: { ru: 'Исузу 5т', uz: 'Isuzu 5t' },
  isuzu10: { ru: 'Исузу 10т', uz: 'Isuzu 10t' },
  gruzovik: { ru: 'Грузовик', uz: 'Yuk mashina' },
  fura_tent: { ru: 'Фура тент', uz: 'Fura tent' },
  fura_ref: { ru: 'Фура реф', uz: 'Fura ref' },
  paravoz: { ru: 'Паровоз', uz: 'Paravoz' },
  shalanda: { ru: 'Шаланда', uz: 'Shalanda' },
  traller: { ru: 'Траллер', uz: 'Traller' },
  tonar: { ru: 'Тонар', uz: 'Tonar' },
  benzovoz: { ru: 'Бензовоз', uz: 'Benzovoz' },
  konteynerovoz: { ru: 'Контейнеровоз', uz: 'Konteynerovoz' },
  other: { ru: 'Другое', uz: 'Boshqa' },
};

function AdminOrdersSection({ language }: { language: 'ru' | 'uz' }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [editOrder, setEditOrder] = useState<any | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const { toast } = useToast();

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (editOrder) {
      setEditForm({
        title: editOrder.title || '',
        transportType: editOrder.transportType || '',
        weightTons: editOrder.weightTons || '',
        priceWithVat: editOrder.priceWithVat || '',
        loadDate: editOrder.loadDate || '',
        loadingTime: editOrder.loadingTime || '',
      });
    }
  }, [editOrder]);

  const queryKey = ['/api/admin/orders', statusFilter, debouncedSearch, page];
  const { data, isLoading } = useQuery<any>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await apiRequest('GET', `/api/admin/orders?${params}`);
      return res.json();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest('PATCH', `/api/admin/orders/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/orders'] });
      toast({ description: language === 'ru' ? 'Статус обновлён' : 'Holat yangilandi' });
    },
    onError: (e: any) => toast({ variant: 'destructive', description: e.message }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest('PATCH', `/api/admin/orders/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/orders'] });
      setEditOrder(null);
      toast({ description: language === 'ru' ? 'Заказ обновлён' : 'Buyurtma yangilandi' });
    },
    onError: (e: any) => toast({ variant: 'destructive', description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/admin/orders/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/orders'] });
      setDeleteOrder(null);
      toast({ description: language === 'ru' ? 'Заказ удалён' : 'Buyurtma o\'chirildi' });
    },
    onError: (e: any) => toast({ variant: 'destructive', description: e.message }),
  });

  const t = language === 'ru' ? {
    title: 'Управление заказами',
    search: 'Поиск по названию, клиенту...',
    allStatuses: 'Все статусы',
    id: '#',
    customer: 'Заказчик',
    route: 'Маршрут',
    details: 'Тип / Вес / Цена',
    loadDate: 'Дата',
    status: 'Статус',
    actions: 'Действия',
    edit: 'Редактировать',
    delete: 'Удалить',
    deleteConfirm: 'Удалить заказ?',
    deleteDesc: 'Это действие нельзя отменить. Заказ',
    cancel: 'Отмена',
    save: 'Сохранить',
    noData: 'Заказы не найдены',
    records: 'записей',
    name: 'Название',
    transportType: 'Тип транспорта',
    weight: 'Вес (т)',
    price: 'Цена (с НДС)',
    statuses: { new: 'Новый', assigned: 'Назначен', completed: 'Завершён', cancelled: 'Отменён' },
  } : {
    title: 'Buyurtmalarni boshqarish',
    search: 'Nomi, mijoz bo\'yicha qidirish...',
    allStatuses: 'Barcha holat',
    id: '#',
    customer: 'Buyurtmachi',
    route: 'Marshrut',
    details: 'Tur / Og\'irlik / Narx',
    loadDate: 'Sana',
    status: 'Holat',
    actions: 'Amallar',
    edit: 'Tahrirlash',
    delete: 'O\'chirish',
    deleteConfirm: 'Buyurtmani o\'chirish?',
    deleteDesc: 'Bu amal bekor qilinmaydi. Buyurtma',
    cancel: 'Bekor qilish',
    save: 'Saqlash',
    noData: 'Buyurtmalar topilmadi',
    records: 'yozuv',
    name: 'Nomi',
    transportType: 'Transport turi',
    weight: 'Og\'irlik (t)',
    price: 'Narx (QQS bilan)',
    statuses: { new: 'Yangi', assigned: 'Tayinlangan', completed: 'Yakunlangan', cancelled: 'Bekor qilingan' },
  };

  const orders = data?.orders || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{t.title}</h2>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={t.search}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            data-testid="input-orders-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44" data-testid="select-orders-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allStatuses}</SelectItem>
            <SelectItem value="new">{t.statuses.new}</SelectItem>
            <SelectItem value="assigned">{t.statuses.assigned}</SelectItem>
            <SelectItem value="completed">{t.statuses.completed}</SelectItem>
            <SelectItem value="cancelled">{t.statuses.cancelled}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">{t.id}</TableHead>
                <TableHead>{t.customer}</TableHead>
                <TableHead>{t.route}</TableHead>
                <TableHead>{t.details}</TableHead>
                <TableHead>{t.loadDate}</TableHead>
                <TableHead>{t.status}</TableHead>
                <TableHead className="w-24">{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t.noData}</TableCell>
                </TableRow>
              ) : orders.map((order: any) => (
                <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{order.id}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{order.customerName || '—'}</div>
                    <div className="text-xs text-muted-foreground">{order.customerPhone}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{order.originRegion} → {order.destinationRegion}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-40">{order.title}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{TRANSPORT_LABELS[order.transportType]?.[language] || order.transportType}</div>
                    <div className="text-xs text-muted-foreground">{order.weightTons} т · {formatMoney(order.priceWithVat)}</div>
                  </TableCell>
                  <TableCell className="text-sm">{order.loadDate}</TableCell>
                  <TableCell>
                    <Select
                      value={order.status}
                      onValueChange={v => statusMutation.mutate({ id: order.id, status: v })}
                    >
                      <SelectTrigger className="h-7 text-xs w-32" data-testid={`select-status-order-${order.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">{t.statuses.new}</SelectItem>
                        <SelectItem value="assigned">{t.statuses.assigned}</SelectItem>
                        <SelectItem value="completed">{t.statuses.completed}</SelectItem>
                        <SelectItem value="cancelled">{t.statuses.cancelled}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditOrder(order)} data-testid={`button-edit-order-${order.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteOrder(order)} data-testid={`button-delete-order-${order.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{total} {t.records}</span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 py-1 text-sm">{page} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!editOrder} onOpenChange={open => !open && setEditOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.edit} — #{editOrder?.id}</DialogTitle>
            <DialogDescription>{editOrder?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">{t.name}</label>
              <Input value={editForm.title || ''} onChange={e => setEditForm((f: any) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{t.transportType}</label>
                <Select value={editForm.transportType || ''} onValueChange={v => setEditForm((f: any) => ({ ...f, transportType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRANSPORT_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v[language]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">{t.weight}</label>
                <Input type="number" value={editForm.weightTons || ''} onChange={e => setEditForm((f: any) => ({ ...f, weightTons: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{t.price}</label>
                <Input type="number" value={editForm.priceWithVat || ''} onChange={e => setEditForm((f: any) => ({ ...f, priceWithVat: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">{language === 'ru' ? 'Дата загрузки' : 'Yuklash sanasi'}</label>
                <Input value={editForm.loadDate || ''} onChange={e => setEditForm((f: any) => ({ ...f, loadDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOrder(null)}>{t.cancel}</Button>
            <Button onClick={() => editMutation.mutate({ id: editOrder.id, data: editForm })} disabled={editMutation.isPending}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteOrder} onOpenChange={open => !open && setDeleteOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteConfirm}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteDesc} #{deleteOrder?.id}: {deleteOrder?.title}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteOrder.id)} className="bg-destructive text-destructive-foreground">
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AdminAnnouncementsSection({ language }: { language: 'ru' | 'uz' }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createdByFilter, setCreatedByFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [editAnn, setEditAnn] = useState<any | null>(null);
  const [deleteAnn, setDeleteAnn] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [annPriceNegotiable, setAnnPriceNegotiable] = useState(false);
  const { toast } = useToast();

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (editAnn) {
      const negotiable = editAnn.price === null || editAnn.price === undefined || Number(editAnn.price) === 0;
      setAnnPriceNegotiable(negotiable);
      setEditForm({
        title: editAnn.title || '',
        transportType: editAnn.transportType || '',
        weightTons: editAnn.weightTons || '',
        price: negotiable ? '' : (editAnn.price || ''),
        loadDate: editAnn.loadDate || '',
        loadingTime: editAnn.loadingTime || '',
        contactPhone: editAnn.contactPhone || '',
        notes: editAnn.notes || '',
        vehicleCount: editAnn.vehicleCount || '',
      });
    }
  }, [editAnn]);

  const queryKey = ['/api/admin/announcements', statusFilter, createdByFilter, debouncedSearch, page];
  const { data, isLoading } = useQuery<any>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (createdByFilter !== 'all') params.set('createdBy', createdByFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await apiRequest('GET', `/api/admin/announcements?${params}`);
      return res.json();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest('PATCH', `/api/admin/announcements/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/announcements'] });
      toast({ description: language === 'ru' ? 'Статус обновлён' : 'Holat yangilandi' });
    },
    onError: (e: any) => toast({ variant: 'destructive', description: e.message }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest('PATCH', `/api/admin/announcements/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/announcements'] });
      setEditAnn(null);
      toast({ description: language === 'ru' ? 'Объявление обновлено' : 'E\'lon yangilandi' });
    },
    onError: (e: any) => toast({ variant: 'destructive', description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/admin/announcements/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/announcements'] });
      setDeleteAnn(null);
      toast({ description: language === 'ru' ? 'Объявление удалено' : 'E\'lon o\'chirildi' });
    },
    onError: (e: any) => toast({ variant: 'destructive', description: e.message }),
  });

  const t = language === 'ru' ? {
    title: 'Управление объявлениями',
    search: 'Поиск по описанию, телефону...',
    allStatuses: 'Все статусы',
    allCreators: 'Все создатели',
    creatorBot: 'Бот',
    creatorUser: 'Пользователь',
    id: '#',
    owner: 'Владелец',
    details: 'Тип / Вес / Цена',
    route: 'Маршрут',
    loadDate: 'Дата',
    status: 'Статус',
    actions: 'Действия',
    edit: 'Редактировать',
    delete: 'Удалить',
    deleteConfirm: 'Удалить объявление?',
    deleteDesc: 'Это действие нельзя отменить. Объявление',
    cancel: 'Отмена',
    save: 'Сохранить',
    noData: 'Объявления не найдены',
    records: 'записей',
    name: 'Описание',
    transportType: 'Тип транспорта',
    weight: 'Вес (т)',
    price: 'Цена',
    phone: 'Телефон',
    notes: 'Заметки',
    vehicles: 'Кол-во машин',
    bot: 'Бот',
    statuses: { new: 'Новый', active: 'Активный', closed: 'Закрыт', completed: 'Завершён', cancelled: 'Отменён' },
  } : {
    title: 'E\'lonlarni boshqarish',
    search: 'Tavsif, telefon bo\'yicha qidirish...',
    allStatuses: 'Barcha holat',
    allCreators: 'Barcha yaratuvchilar',
    creatorBot: 'Bot',
    creatorUser: 'Foydalanuvchi',
    id: '#',
    owner: 'Egasi',
    details: 'Tur / Og\'irlik / Narx',
    route: 'Marshrut',
    loadDate: 'Sana',
    status: 'Holat',
    actions: 'Amallar',
    edit: 'Tahrirlash',
    delete: 'O\'chirish',
    deleteConfirm: 'E\'lonni o\'chirish?',
    deleteDesc: 'Bu amal bekor qilinmaydi. E\'lon',
    cancel: 'Bekor qilish',
    save: 'Saqlash',
    noData: 'E\'lonlar topilmadi',
    records: 'yozuv',
    name: 'Tavsif',
    transportType: 'Transport turi',
    weight: 'Og\'irlik (t)',
    price: 'Narx',
    phone: 'Telefon',
    notes: 'Izohlar',
    vehicles: 'Mashina soni',
    bot: 'Bot',
    statuses: { new: 'Yangi', active: 'Faol', closed: 'Yopilgan', completed: 'Yakunlangan', cancelled: 'Bekor qilingan' },
  };

  const announcements = data?.announcements || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{t.title}</h2>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={t.search}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            data-testid="input-announcements-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44" data-testid="select-announcements-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allStatuses}</SelectItem>
            <SelectItem value="new">{t.statuses.new}</SelectItem>
            <SelectItem value="active">{t.statuses.active}</SelectItem>
            <SelectItem value="closed">{t.statuses.closed}</SelectItem>
            <SelectItem value="completed">{t.statuses.completed}</SelectItem>
            <SelectItem value="cancelled">{t.statuses.cancelled}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={createdByFilter} onValueChange={v => { setCreatedByFilter(v); setPage(1); }}>
          <SelectTrigger className="w-48" data-testid="select-announcements-creator">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allCreators}</SelectItem>
            <SelectItem value="bot">{t.creatorBot}</SelectItem>
            <SelectItem value="user">{t.creatorUser}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">{t.id}</TableHead>
                <TableHead>{t.owner}</TableHead>
                <TableHead>{t.route}</TableHead>
                <TableHead>{t.details}</TableHead>
                <TableHead>{t.loadDate}</TableHead>
                <TableHead>{t.status}</TableHead>
                <TableHead className="w-24">{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : announcements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t.noData}</TableCell>
                </TableRow>
              ) : announcements.map((ann: any) => (
                <TableRow key={ann.id} data-testid={`row-announcement-${ann.id}`}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {ann.id}
                    {ann.createdByBot && <Badge variant="secondary" className="ml-1 text-xs">{t.bot}</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{ann.ownerName || '—'}</div>
                    <div className="text-xs text-muted-foreground">{ann.contactPhone}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{ann.originRegion || '—'} → {ann.destinationRegion || '—'}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-40">{ann.title}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{TRANSPORT_LABELS[ann.transportType]?.[language] || ann.transportType || '—'}</div>
                    <div className="text-xs text-muted-foreground">{ann.weightTons ? `${ann.weightTons} т` : '—'} {ann.price ? `· ${formatMoney(ann.price)}` : ''}</div>
                  </TableCell>
                  <TableCell className="text-sm">{ann.loadDate || '—'}</TableCell>
                  <TableCell>
                    <Select
                      value={ann.status}
                      onValueChange={v => statusMutation.mutate({ id: ann.id, status: v })}
                    >
                      <SelectTrigger className="h-7 text-xs w-32" data-testid={`select-status-announcement-${ann.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">{t.statuses.new}</SelectItem>
                        <SelectItem value="active">{t.statuses.active}</SelectItem>
                        <SelectItem value="closed">{t.statuses.closed}</SelectItem>
                        <SelectItem value="completed">{t.statuses.completed}</SelectItem>
                        <SelectItem value="cancelled">{t.statuses.cancelled}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditAnn(ann)} data-testid={`button-edit-announcement-${ann.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteAnn(ann)} data-testid={`button-delete-announcement-${ann.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{total} {t.records}</span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 py-1 text-sm">{page} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!editAnn} onOpenChange={open => !open && setEditAnn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.edit} — #{editAnn?.id}</DialogTitle>
            <DialogDescription>{editAnn?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">{t.name}</label>
              <Textarea value={editForm.title || ''} onChange={e => setEditForm((f: any) => ({ ...f, title: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{t.transportType}</label>
                <Select value={editForm.transportType || ''} onValueChange={v => setEditForm((f: any) => ({ ...f, transportType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRANSPORT_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v[language]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">{t.weight}</label>
                <Input type="number" value={editForm.weightTons || ''} onChange={e => setEditForm((f: any) => ({ ...f, weightTons: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">{t.price}</label>
                  <label className="flex items-center gap-1.5 cursor-pointer" data-testid="label-ann-negotiable">
                    <Checkbox
                      checked={annPriceNegotiable}
                      onCheckedChange={(checked) => {
                        setAnnPriceNegotiable(!!checked);
                        if (checked) setEditForm((f: any) => ({ ...f, price: '' }));
                      }}
                      data-testid="checkbox-ann-negotiable"
                    />
                    <span className="text-sm text-muted-foreground">
                      {language === 'ru' ? 'Договорная' : 'Kelishiladi'}
                    </span>
                  </label>
                </div>
                <Input
                  type="number"
                  disabled={annPriceNegotiable}
                  placeholder={annPriceNegotiable ? (language === 'ru' ? 'Договорная' : 'Kelishiladi') : ''}
                  value={annPriceNegotiable ? '' : (editForm.price || '')}
                  onChange={e => { if (!annPriceNegotiable) setEditForm((f: any) => ({ ...f, price: e.target.value })); }}
                  className={annPriceNegotiable ? 'opacity-40 pointer-events-none' : ''}
                  data-testid="input-ann-price"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t.phone}</label>
                <Input value={editForm.contactPhone || ''} onChange={e => setEditForm((f: any) => ({ ...f, contactPhone: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{language === 'ru' ? 'Дата загрузки' : 'Yuklash sanasi'}</label>
                <Input value={editForm.loadDate || ''} onChange={e => setEditForm((f: any) => ({ ...f, loadDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">{t.vehicles}</label>
                <Input type="number" value={editForm.vehicleCount || ''} onChange={e => setEditForm((f: any) => ({ ...f, vehicleCount: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{t.notes}</label>
              <Textarea value={editForm.notes || ''} onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAnn(null)}>{t.cancel}</Button>
            <Button onClick={() => editMutation.mutate({ id: editAnn.id, data: { ...editForm, price: annPriceNegotiable ? null : (editForm.price || null) } })} disabled={editMutation.isPending}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteAnn} onOpenChange={open => !open && setDeleteAnn(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteConfirm}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteDesc} #{deleteAnn?.id}: {deleteAnn?.title}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteAnn.id)} className="bg-destructive text-destructive-foreground">
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const ACTION_EVENT_NAMES = ['login', 'logout', 'create_order', 'create_announcement', 'submit_offer', 'open_announcement', 'open_order'];

function AnalyticsSection({ language }: { language: 'ru' | 'uz' }) {
  const [tab, setTab] = useState<'errors' | 'sessions' | 'actions'>('errors');
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [summaryDateFrom, setSummaryDateFrom] = useState('');
  const [summaryDateTo, setSummaryDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const t = {
    ru: {
      title: 'Аналитика мобильного приложения',
      errors: 'Ошибки',
      sessions: 'Сессии',
      actions: 'Действия',
      dateFrom: 'С',
      dateTo: 'По',
      summaryPeriodLabel: 'Период сводки',
      summaryFrom: 'С',
      summaryTo: 'По',
      search: 'Пользователь / текст...',
      actionType: 'Тип действия',
      allActions: 'Все действия',
      apply: 'Найти',
      reset: 'Сбросить',
      noData: 'Нет данных',
      user: 'Пользователь',
      screen: 'Экран',
      device: 'Устройство',
      os: 'ОС',
      version: 'Версия',
      time: 'Начало',
      endTime: 'Конец',
      errorMsg: 'Ошибка',
      stack: 'Стек',
      action: 'Действие',
      duration: 'Длит-ть',
      screens: 'Экранов',
      total: 'Всего',
      prev: 'Назад',
      next: 'Вперёд',
      guest: 'Гость',
      active: 'активна',
      statTotalErrors: 'Ошибок',
      statUniqueUsers: 'Пользователей с ошибками',
      statCrashFree: 'Без сбоев',
      statSessions: 'Сессий',
      statTopScreen: 'Частый экран с ошибкой',
      statPeriod: 'За выбранный период',
      statNone: 'Нет данных',
      statNoActiveUsers: 'Нет данных',
    },
    uz: {
      title: 'Mobil ilova tahlili',
      errors: 'Xatolar',
      sessions: 'Sessiyalar',
      actions: 'Harakatlar',
      dateFrom: 'Dan',
      dateTo: 'Gacha',
      summaryPeriodLabel: 'Xulosa davri',
      summaryFrom: 'Dan',
      summaryTo: 'Gacha',
      search: 'Foydalanuvchi / matn...',
      actionType: 'Harakat turi',
      allActions: 'Barcha harakatlar',
      apply: 'Qidirish',
      reset: 'Tozalash',
      noData: 'Ma\'lumot yo\'q',
      user: 'Foydalanuvchi',
      screen: 'Ekran',
      device: 'Qurilma',
      os: 'OS',
      version: 'Versiya',
      time: 'Boshlandi',
      endTime: 'Tugadi',
      errorMsg: 'Xato',
      stack: 'Stek',
      action: 'Harakat',
      duration: 'Davom.',
      screens: 'Ekranlar',
      total: 'Jami',
      prev: 'Oldingi',
      next: 'Keyingi',
      guest: 'Mehmon',
      active: 'faol',
      statTotalErrors: 'Xatolar',
      statUniqueUsers: 'Xatolari bor foydalanuvchilar',
      statCrashFree: 'Xatosiz foydalanuvchilar',
      statSessions: 'Sessiyalar',
      statTopScreen: 'Ko\'p xato bo\'lgan ekran',
      statPeriod: 'Tanlangan davr uchun',
      statNone: 'Ma\'lumot yo\'q',
      statNoActiveUsers: 'Ma\'lumot yo\'q',
    }
  }[language];

  const LIMIT = 50;

  const buildQuery = (extra?: Record<string, string>) => {
    const params: Record<string, string> = { page: String(page), limit: String(LIMIT) };
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    if (search) params.search = search;
    if (extra) Object.assign(params, extra);
    return new URLSearchParams(params).toString();
  };

  const errorsQuery = useQuery<{ errors: any[]; total: number }>({
    queryKey: ['/api/admin/analytics/errors', page, dateFrom, dateTo, search],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/errors?${buildQuery()}`, { credentials: 'include' });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
      return res.json();
    },
    enabled: tab === 'errors',
  });

  const sessionsQuery = useQuery<{ sessions: any[]; total: number }>({
    queryKey: ['/api/admin/analytics/sessions', page, dateFrom, dateTo, search],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/sessions?${buildQuery()}`, { credentials: 'include' });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
      return res.json();
    },
    enabled: tab === 'sessions',
  });

  const actionsQuery = useQuery<{ events: any[]; total: number }>({
    queryKey: ['/api/admin/analytics/events', page, dateFrom, dateTo, search, actionFilter, 'actions'],
    queryFn: async () => {
      const extra: Record<string, string> = actionFilter
        ? { eventName: actionFilter }
        : { eventNames: ACTION_EVENT_NAMES.join(',') };
      const qs = buildQuery(extra);
      const res = await fetch(`/api/admin/analytics/events?${qs}`, { credentials: 'include' });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
      return res.json();
    },
    enabled: tab === 'actions',
  });

  const summaryQuery = useQuery<{
    totalErrors: number;
    uniqueUsersWithErrors: number;
    totalSessions: number;
    totalActiveUsers: number;
    crashFreeRate: number | null;
    topErrorScreen: string | null;
  }>({
    queryKey: ['/api/admin/analytics/summary', summaryDateFrom, summaryDateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (summaryDateFrom) params.set('dateFrom', summaryDateFrom);
      if (summaryDateTo) params.set('dateTo', summaryDateTo);
      const res = await fetch(`/api/admin/analytics/summary?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
      return res.json();
    },
  });

  const activeQuery = tab === 'errors' ? errorsQuery : tab === 'sessions' ? sessionsQuery : actionsQuery;
  const rows = tab === 'errors'
    ? (errorsQuery.data?.errors ?? [])
    : tab === 'sessions'
    ? (sessionsQuery.data?.sessions ?? [])
    : (actionsQuery.data?.events ?? []);
  const total = activeQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  function applyFilters() {
    setSearch(searchInput);
    setPage(1);
  }

  function resetFilters() {
    setSearchInput('');
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setActionFilter('');
    setPage(1);
  }

  function resetSummaryFilters() {
    setSummaryDateFrom('');
    setSummaryDateTo('');
  }

  function switchTab(v: 'errors' | 'sessions' | 'actions') {
    setTab(v);
    setPage(1);
  }

  function formatDuration(sec?: number | null) {
    if (sec == null) return '—';
    if (sec < 60) return `${sec}с`;
    return `${Math.floor(sec / 60)}м ${sec % 60}с`;
  }

  function UserCell({ row }: { row: any }) {
    return row.display_name || row.phone ? (
      <div>
        <div className="font-medium">{row.display_name || '—'}</div>
        <div className="text-muted-foreground">{row.phone || '—'}</div>
      </div>
    ) : <span className="text-muted-foreground">{t.guest}</span>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold" data-testid="text-analytics-title">{t.title}</h1>

      {/* API error banner */}
      {summaryQuery.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive" data-testid="alert-analytics-error">
          <strong>{language === 'uz' ? 'Server xatosi' : 'Ошибка сервера'}:</strong>{' '}
          {(summaryQuery.error as Error)?.message ?? (language === 'uz' ? 'Noma\'lum xato' : 'Неизвестная ошибка')}
        </div>
      )}

      {/* Summary cards date range picker */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <div className="text-xs text-muted-foreground mb-1">{t.summaryPeriodLabel}: {t.summaryFrom}</div>
          <Input
            type="date"
            value={summaryDateFrom}
            onChange={e => setSummaryDateFrom(e.target.value)}
            className="w-40"
            data-testid="input-summary-from"
          />
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">{t.summaryTo}</div>
          <Input
            type="date"
            value={summaryDateTo}
            onChange={e => setSummaryDateTo(e.target.value)}
            className="w-40"
            data-testid="input-summary-to"
          />
        </div>
        {(summaryDateFrom || summaryDateTo) && (
          <Button variant="outline" onClick={resetSummaryFilters} data-testid="button-summary-reset">
            {t.reset}
          </Button>
        )}
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card data-testid="card-stat-total-errors">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">{t.statTotalErrors}</div>
            {summaryQuery.isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-destructive" data-testid="text-stat-total-errors">
                {summaryQuery.data?.totalErrors ?? 0}
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">{t.statPeriod}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-crash-free">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">{t.statCrashFree}</div>
            {summaryQuery.isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : summaryQuery.data?.crashFreeRate != null ? (
              <div
                className={`text-2xl font-bold ${summaryQuery.data.crashFreeRate >= 99 ? 'text-green-600 dark:text-green-400' : summaryQuery.data.crashFreeRate >= 95 ? 'text-yellow-600 dark:text-yellow-400' : 'text-destructive'}`}
                data-testid="text-stat-crash-free-rate"
              >
                {summaryQuery.data.crashFreeRate.toFixed(1)}%
              </div>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground" data-testid="text-stat-crash-free-rate">
                {t.statNoActiveUsers}
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              {summaryQuery.data != null
                ? `${t.statUniqueUsers}: ${summaryQuery.data.uniqueUsersWithErrors} / ${summaryQuery.data.totalActiveUsers}`
                : t.statPeriod}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-sessions">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">{t.statSessions}</div>
            {summaryQuery.isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-stat-sessions">
                {summaryQuery.data?.totalSessions ?? 0}
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">{t.statPeriod}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-top-screen">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">{t.statTopScreen}</div>
            {summaryQuery.isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-lg font-semibold truncate" title={summaryQuery.data?.topErrorScreen ?? ''} data-testid="text-stat-top-screen">
                {summaryQuery.data?.topErrorScreen ?? t.statNone}
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">{t.statPeriod}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => switchTab(v as any)}>
        <TabsList>
          <TabsTrigger value="errors" data-testid="tab-analytics-errors">{t.errors}</TabsTrigger>
          <TabsTrigger value="sessions" data-testid="tab-analytics-sessions">{t.sessions}</TabsTrigger>
          <TabsTrigger value="actions" data-testid="tab-analytics-actions">{t.actions}</TabsTrigger>
        </TabsList>

        <div className="flex flex-wrap gap-3 mt-4 items-end">
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t.dateFrom}</div>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" data-testid="input-analytics-from" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t.dateTo}</div>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" data-testid="input-analytics-to" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs text-muted-foreground mb-1">{t.search}</div>
            <Input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder={t.search}
              data-testid="input-analytics-search" onKeyDown={e => e.key === 'Enter' && applyFilters()} />
          </div>
          {tab === 'actions' && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">{t.actionType}</div>
              <Select value={actionFilter || 'all'} onValueChange={v => { setActionFilter(v === 'all' ? '' : v); setPage(1); }}>
                <SelectTrigger className="w-48" data-testid="select-analytics-action">
                  <SelectValue placeholder={t.allActions} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allActions}</SelectItem>
                  {ACTION_EVENT_NAMES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={applyFilters} data-testid="button-analytics-search">{t.apply}</Button>
          <Button variant="outline" onClick={resetFilters} data-testid="button-analytics-reset">{t.reset}</Button>
        </div>

        {/* Errors tab */}
        <TabsContent value="errors" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {errorsQuery.isLoading ? (
                <div className="p-6 space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
              ) : errorsQuery.isError ? (
                <div className="p-6 text-sm text-destructive">{language === 'uz' ? 'Server xatosi' : 'Ошибка сервера'}: {(errorsQuery.error as Error)?.message}</div>
              ) : rows.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">{t.noData}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.time}</TableHead>
                      <TableHead>{t.user}</TableHead>
                      <TableHead>{t.screen}</TableHead>
                      <TableHead>{t.device}</TableHead>
                      <TableHead>{t.os}</TableHead>
                      <TableHead>{t.version}</TableHead>
                      <TableHead className="min-w-[300px]">{t.errorMsg}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row: any) => (
                      <TableRow key={row.id} data-testid={`row-error-${row.id}`}>
                        <TableCell className="whitespace-nowrap text-xs">{formatDate(row.created_at)}</TableCell>
                        <TableCell className="text-xs"><UserCell row={row} /></TableCell>
                        <TableCell className="text-xs">{row.screen || '—'}</TableCell>
                        <TableCell className="text-xs">{row.device_model || '—'}</TableCell>
                        <TableCell className="text-xs">{row.os_version || '—'}</TableCell>
                        <TableCell className="text-xs">{row.app_version || '—'}</TableCell>
                        <TableCell className="text-xs max-w-xs">
                          <div className="truncate font-medium text-destructive" title={row.error_message}>{row.error_message}</div>
                          {row.error_stack && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-muted-foreground text-xs">{t.stack}</summary>
                              <pre className="text-xs whitespace-pre-wrap break-all mt-1 text-muted-foreground max-h-40 overflow-auto">{row.error_stack}</pre>
                            </details>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sessions tab */}
        <TabsContent value="sessions" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {sessionsQuery.isLoading ? (
                <div className="p-6 space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
              ) : sessionsQuery.isError ? (
                <div className="p-6 text-sm text-destructive">{language === 'uz' ? 'Server xatosi' : 'Ошибка сервера'}: {(sessionsQuery.error as Error)?.message}</div>
              ) : rows.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">{t.noData}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.time}</TableHead>
                      <TableHead>{t.endTime}</TableHead>
                      <TableHead>{t.user}</TableHead>
                      <TableHead>{t.device}</TableHead>
                      <TableHead>{t.os}</TableHead>
                      <TableHead>{t.version}</TableHead>
                      <TableHead>{t.duration}</TableHead>
                      <TableHead>{t.screens}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row: any) => (
                      <TableRow key={row.id} data-testid={`row-session-${row.id}`}>
                        <TableCell className="whitespace-nowrap text-xs">{formatDate(row.started_at)}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {row.ended_at ? formatDate(row.ended_at) : <span className="text-muted-foreground italic">{t.active}</span>}
                        </TableCell>
                        <TableCell className="text-xs"><UserCell row={row} /></TableCell>
                        <TableCell className="text-xs">{row.device_model || '—'}</TableCell>
                        <TableCell className="text-xs">{row.os_version || '—'}</TableCell>
                        <TableCell className="text-xs">{row.app_version || '—'}</TableCell>
                        <TableCell className="text-xs">{formatDuration(row.duration_seconds)}</TableCell>
                        <TableCell className="text-xs">{row.screens_visited ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Actions tab */}
        <TabsContent value="actions" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {actionsQuery.isLoading ? (
                <div className="p-6 space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
              ) : actionsQuery.isError ? (
                <div className="p-6 text-sm text-destructive">{language === 'uz' ? 'Server xatosi' : 'Ошибка сервера'}: {(actionsQuery.error as Error)?.message}</div>
              ) : rows.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">{t.noData}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.time}</TableHead>
                      <TableHead>{t.user}</TableHead>
                      <TableHead>{t.action}</TableHead>
                      <TableHead>{t.screen}</TableHead>
                      <TableHead>{t.device}</TableHead>
                      <TableHead>{t.os}</TableHead>
                      <TableHead>{t.version}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row: any) => (
                      <TableRow key={row.id} data-testid={`row-action-${row.id}`}>
                        <TableCell className="whitespace-nowrap text-xs">{formatDate(row.created_at)}</TableCell>
                        <TableCell className="text-xs"><UserCell row={row} /></TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{row.event_name}</Badge></TableCell>
                        <TableCell className="text-xs">{row.screen || '—'}</TableCell>
                        <TableCell className="text-xs">{row.device_model || '—'}</TableCell>
                        <TableCell className="text-xs">{row.os_version || '—'}</TableCell>
                        <TableCell className="text-xs">{row.app_version || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted-foreground">{t.total}: {total}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} data-testid="button-analytics-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">{page} / {totalPages}</span>
          <Button variant="outline" size="icon" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} data-testid="button-analytics-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Chat Rooms Section ──────────────────────────────────────────────────────
function ChatRoomsSection({ language }: { language: 'ru' | 'uz' }) {
  const ru = language === 'ru';
  const { toast } = useToast();

  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editRoom, setEditRoom] = useState<any | null>(null);
  const [deleteRoomId, setDeleteRoomId] = useState<number | null>(null);
  const [form, setForm] = useState({ nameRu: '', nameUz: '', slug: '', sortOrder: '0', isActive: true });

  // Message moderation state
  const [expandedRoomId, setExpandedRoomId] = useState<number | null>(null);
  const [roomMessages, setRoomMessages] = useState<Record<number, any[]>>({});
  const [messagesLoading, setMessagesLoading] = useState<Record<number, boolean>>({});
  const [deleteMsgId, setDeleteMsgId] = useState<number | null>(null);

  const t = {
    title: ru ? 'Чат-комнаты' : 'Chat xonalari',
    create: ru ? 'Создать комнату' : 'Xona yaratish',
    nameRu: ru ? 'Название (RU)' : 'Nomi (RU)',
    nameUz: ru ? 'Название (UZ)' : 'Nomi (UZ)',
    slug: 'Slug',
    sortOrder: ru ? 'Порядок' : 'Tartib',
    active: ru ? 'Активна' : 'Faol',
    save: ru ? 'Сохранить' : 'Saqlash',
    cancel: ru ? 'Отмена' : 'Bekor',
    delete: ru ? 'Удалить' : "O'chirish",
    edit: ru ? 'Редактировать' : 'Tahrirlash',
    confirmDelete: ru ? 'Удалить комнату?' : 'Xonani o\'chirish?',
    confirmDeleteDesc: ru ? 'Все сообщения будут удалены безвозвратно.' : 'Barcha xabarlar o\'chib ketadi.',
    created: ru ? 'Комната создана' : 'Xona yaratildi',
    updated: ru ? 'Комната обновлена' : 'Xona yangilandi',
    deleted: ru ? 'Комната удалена' : 'Xona o\'chirildi',
    error: ru ? 'Ошибка' : 'Xato',
    messages: ru ? 'Сообщения' : 'Xabarlar',
    noMessages: ru ? 'Нет сообщений' : 'Xabarlar yo\'q',
    deleteMsg: ru ? 'Удалить сообщение?' : 'Xabarni o\'chirish?',
    deleteMsgDesc: ru ? 'Сообщение будет удалено для всех участников чата.' : 'Xabar barcha ishtirokchilar uchun o\'chiriladi.',
    msgDeleted: ru ? 'Сообщение удалено' : 'Xabar o\'chirildi',
    hideMessages: ru ? 'Скрыть сообщения' : 'Xabarlarni yashirish',
    showMessages: ru ? 'Показать сообщения' : 'Xabarlarni ko\'rsatish',
    flagMsg: ru ? 'Отметить как нарушение' : 'Buzilish sifatida belgilash',
    unflagMsg: ru ? 'Снять отметку' : 'Belgi olib tashlash',
    flagged: ru ? 'Нарушение' : 'Buzilish',
  };

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/chat/rooms/all', { credentials: 'include' });
      const data = await r.json();
      setRooms(Array.isArray(data) ? data : []);
    } catch { setRooms([]); } finally { setLoading(false); }
  };

  const fetchMessages = async (roomId: number) => {
    setMessagesLoading(prev => ({ ...prev, [roomId]: true }));
    try {
      const r = await fetch(`/api/chat/rooms/${roomId}/messages`, { credentials: 'include' });
      const data = await r.json();
      setRoomMessages(prev => ({ ...prev, [roomId]: Array.isArray(data) ? data : [] }));
    } catch {
      setRoomMessages(prev => ({ ...prev, [roomId]: [] }));
    } finally {
      setMessagesLoading(prev => ({ ...prev, [roomId]: false }));
    }
  };

  const toggleMessages = (roomId: number) => {
    if (expandedRoomId === roomId) {
      setExpandedRoomId(null);
    } else {
      setExpandedRoomId(roomId);
      fetchMessages(roomId);
    }
  };

  const handleDeleteMessage = async () => {
    if (!deleteMsgId) return;
    // Find which room this message belongs to
    const roomId = Object.entries(roomMessages).find(([, msgs]) =>
      msgs.some((m: any) => m.id === deleteMsgId)
    )?.[0];
    try {
      const r = await fetch(`/api/chat/messages/${deleteMsgId}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Error'); }
      toast({ title: t.msgDeleted });
      setDeleteMsgId(null);
      if (roomId) {
        setRoomMessages(prev => ({
          ...prev,
          [roomId]: (prev[Number(roomId)] || []).filter((m: any) => m.id !== deleteMsgId),
        }));
      }
    } catch (err: any) {
      toast({ title: t.error, description: err.message, variant: 'destructive' });
      setDeleteMsgId(null);
    }
  };

  const handleFlagMessage = async (msgId: number) => {
    const roomId = Object.entries(roomMessages).find(([, msgs]) =>
      msgs.some((m: any) => m.id === msgId)
    )?.[0];
    try {
      const r = await fetch(`/api/chat/messages/${msgId}/flag`, { method: 'POST', credentials: 'include' });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Error'); }
      const { flagged } = await r.json();
      if (roomId) {
        setRoomMessages(prev => ({
          ...prev,
          [roomId]: (prev[Number(roomId)] || []).map((m: any) =>
            m.id === msgId ? { ...m, flagged } : m
          ),
        }));
      }
      toast({ title: flagged ? (ru ? 'Сообщение отмечено' : 'Xabar belgilandi') : (ru ? 'Отметка снята' : 'Belgi olib tashlandi') });
    } catch (err: any) {
      toast({ title: t.error, description: err.message, variant: 'destructive' });
    }
  };

  useEffect(() => { fetchRooms(); }, []);

  const resetForm = () => setForm({ nameRu: '', nameUz: '', slug: '', sortOrder: '0', isActive: true });

  const handleCreate = async () => {
    try {
      const r = await fetch('/api/chat/rooms', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nameRu: form.nameRu, nameUz: form.nameUz, slug: form.slug, sortOrder: parseInt(form.sortOrder) || 0, isActive: form.isActive }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Error'); }
      toast({ title: t.created }); resetForm(); setCreating(false); fetchRooms();
    } catch (err: any) { toast({ title: t.error, description: err.message, variant: 'destructive' }); }
  };

  const handleUpdate = async () => {
    if (!editRoom) return;
    try {
      const r = await fetch(`/api/chat/rooms/${editRoom.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nameRu: form.nameRu, nameUz: form.nameUz, slug: form.slug, sortOrder: parseInt(form.sortOrder) || 0, isActive: form.isActive }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Error'); }
      toast({ title: t.updated }); setEditRoom(null); resetForm(); fetchRooms();
    } catch (err: any) { toast({ title: t.error, description: err.message, variant: 'destructive' }); }
  };

  const handleDelete = async () => {
    if (!deleteRoomId) return;
    try {
      await fetch(`/api/chat/rooms/${deleteRoomId}`, { method: 'DELETE', credentials: 'include' });
      toast({ title: t.deleted }); setDeleteRoomId(null); fetchRooms();
    } catch (err: any) { toast({ title: t.error, description: err.message, variant: 'destructive' }); }
  };

  const openEdit = (room: any) => {
    setForm({ nameRu: room.nameRu || '', nameUz: room.nameUz || '', slug: room.slug || '', sortOrder: String(room.sortOrder ?? 0), isActive: room.isActive !== false });
    setEditRoom(room);
  };

  const FormFields = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">{t.nameRu}</label>
          <Input value={form.nameRu} onChange={e => setForm(f => ({ ...f, nameRu: e.target.value }))} className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">{t.nameUz}</label>
          <Input value={form.nameUz} onChange={e => setForm(f => ({ ...f, nameUz: e.target.value }))} className="mt-1" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">{t.slug}</label>
          <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="mt-1" placeholder="general" />
        </div>
        <div>
          <label className="text-sm font-medium">{t.sortOrder}</label>
          <Input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))} className="mt-1" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
        <label htmlFor="isActive" className="text-sm">{t.active}</label>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t.title}</h2>
        <Button onClick={() => { resetForm(); setCreating(true); }}>
          <MessageSquare className="h-4 w-4 mr-2" /> {t.create}
        </Button>
      </div>

      {/* Create Dialog */}
      <Dialog open={creating} onOpenChange={(o) => { setCreating(o); if (!o) resetForm(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.create}</DialogTitle></DialogHeader>
          <FormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreating(false); resetForm(); }}>{t.cancel}</Button>
            <Button onClick={handleCreate} disabled={!form.nameRu || !form.nameUz || !form.slug}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editRoom} onOpenChange={(o) => { if (!o) { setEditRoom(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.edit}</DialogTitle></DialogHeader>
          <FormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditRoom(null); resetForm(); }}>{t.cancel}</Button>
            <Button onClick={handleUpdate} disabled={!form.nameRu || !form.nameUz || !form.slug}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Room Confirm */}
      <AlertDialog open={!!deleteRoomId} onOpenChange={(o) => { if (!o) setDeleteRoomId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmDelete}</AlertDialogTitle>
            <AlertDialogDescription>{t.confirmDeleteDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteRoomId(null)}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Message Confirm */}
      <AlertDialog open={!!deleteMsgId} onOpenChange={(o) => { if (!o) setDeleteMsgId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteMsg}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteMsgDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteMsgId(null)}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMessage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rooms Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center"><Skeleton className="h-8 w-full mb-2" /><Skeleton className="h-8 w-full mb-2" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>{t.nameRu}</TableHead>
                  <TableHead>{t.nameUz}</TableHead>
                  <TableHead>{t.slug}</TableHead>
                  <TableHead>{t.sortOrder}</TableHead>
                  <TableHead>{t.active}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((room) => (
                  <React.Fragment key={room.id}>
                    <TableRow>
                      <TableCell className="font-mono text-sm">{room.id}</TableCell>
                      <TableCell>{room.nameRu}</TableCell>
                      <TableCell>{room.nameUz}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{room.slug}</TableCell>
                      <TableCell>{room.sortOrder}</TableCell>
                      <TableCell>
                        <Badge variant={room.isActive ? 'default' : 'secondary'}>
                          {room.isActive ? (ru ? 'Да' : 'Ha') : (ru ? 'Нет' : 'Yo\'q')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => toggleMessages(room.id)}
                            className="text-xs gap-1"
                            title={expandedRoomId === room.id ? t.hideMessages : t.showMessages}
                          >
                            <MessageSquare className="h-4 w-4" />
                            {expandedRoomId === room.id ? t.hideMessages : t.messages}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(room)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteRoomId(room.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedRoomId === room.id && (
                      <TableRow key={`${room.id}-messages`}>
                        <TableCell colSpan={7} className="bg-muted/30 p-0">
                          <div className="p-4">
                            <div className="text-sm font-semibold mb-3 text-muted-foreground">
                              {t.messages} — {room.nameRu}
                            </div>
                            {messagesLoading[room.id] ? (
                              <div className="space-y-2">
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-8 w-3/4" />
                              </div>
                            ) : (roomMessages[room.id] || []).length === 0 ? (
                              <p className="text-sm text-muted-foreground py-4 text-center">{t.noMessages}</p>
                            ) : (
                              <div className="space-y-1 max-h-80 overflow-y-auto">
                                {(roomMessages[room.id] || []).map((msg: any) => (
                                  <div key={msg.id} className={`flex items-start gap-3 rounded-md px-3 py-2 hover:bg-muted/60 group ${msg.flagged ? 'bg-red-50 border border-red-200' : ''}`}>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-xs font-semibold text-primary mr-2">{msg.authorName || msg.author_name}</span>
                                      <span className="text-xs text-muted-foreground mr-2">
                                        {msg.createdAt || msg.created_at
                                          ? new Date(msg.createdAt || msg.created_at).toLocaleString(ru ? 'ru-RU' : 'uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                                          : ''}
                                      </span>
                                      {msg.flagged && (
                                        <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4 mr-2">{t.flagged}</Badge>
                                      )}
                                      <span className="text-sm break-words">{msg.text}</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        variant="ghost" size="icon"
                                        className={`h-7 w-7 ${msg.flagged ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'}`}
                                        onClick={() => handleFlagMessage(msg.id)}
                                        title={msg.flagged ? t.unflagMsg : t.flagMsg}
                                      >
                                        <Flag className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost" size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                        onClick={() => setDeleteMsgId(msg.id)}
                                        title={ru ? 'Удалить сообщение' : 'Xabarni o\'chirish'}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
                {rooms.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{ru ? 'Нет комнат' : 'Xonalar yo\'q'}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminDashboard({ section }: AdminDashboardProps) {
  const { language, setLanguage } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!authLoading && (!user || !user.roles.includes('admin'))) {
      setLocation('/login');
    }
  }, [user, authLoading, setLocation]);

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    );
  }

  const renderSection = () => {
    switch (section) {
      case 'orders':
        return <AdminOrdersSection language={language} />;
      case 'announcements':
        return <AdminAnnouncementsSection language={language} />;
      case 'users':
        return <UsersSection language={language} />;
      case 'deposits':
        return <DepositsSection language={language} />;
      case 'withdrawals':
        return <WithdrawalsSection language={language} />;
      case 'partners':
        return <PartnersSection language={language} />;
      case 'reward-statements':
        return <RewardStatementsSection language={language} />;
      case 'reports':
        return <ReportsSection language={language} />;
      case 'telegram-channels':
        return <TelegramChannelsSection language={language} />;
      case 'telegram-broadcast':
        return <TelegramBroadcastSection language={language} />;
      case 'push-notifications':
        return <PushNotificationsSection language={language} />;
      case 'chat-rooms':
        return <ChatRoomsSection language={language} />;
      case 'analytics':
        return <AnalyticsSection language={language} />;
      case 'settings':
        return <SettingsSection language={language} />;
      default:
        return <DashboardSection language={language} />;
    }
  };

  const style = {
    "--sidebar-width": "16rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar 
          role="admin" 
          language={language} 
          activePath={section ? `/admin/${section}` : '/admin'}
          onNavigate={(path) => setLocation(path)}
        />
        <AdminDashboardMain 
          language={language}
          setLanguage={setLanguage}
          user={user}
        >
          <div className="max-w-screen-2xl mx-auto">
            {renderSection()}
          </div>
        </AdminDashboardMain>
      </div>
    </SidebarProvider>
  );
}
