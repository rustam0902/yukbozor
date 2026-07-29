import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Search, Trash2, Edit2, UserPlus, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/language-context";
import { usePhoneInput } from "@/hooks/use-phone-input";
import { ALL_REPRESENTATIVE_PERMISSIONS, PERMISSION_LABELS, RepresentativePermission } from "@shared/schema";

interface RepresentativeUser {
  id: number;
  displayName: string;
  phone: string;
  userType: string;
}

interface Representative {
  id: number;
  customerId: number;
  representativeUserId: number;
  permissions: RepresentativePermission[];
  isActive: boolean;
  createdAt: string;
  representativeUser: RepresentativeUser | null;
}

export default function Representatives() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const phoneInput = usePhoneInput();
  const [foundUser, setFoundUser] = useState<RepresentativeUser | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<RepresentativePermission[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRep, setEditingRep] = useState<Representative | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const t = {
    ru: {
      title: "Мои представители",
      description: "Управление представителями, которые могут работать от вашего имени",
      addRepresentative: "Добавить представителя",
      search: "Найти",
      noRepresentatives: "У вас пока нет представителей",
      name: "Имя",
      phone: "Телефон",
      permissions: "Права",
      status: "Статус",
      actions: "Действия",
      active: "Активен",
      inactive: "Неактивен",
      edit: "Редактировать",
      delete: "Удалить",
      add: "Добавить",
      save: "Сохранить",
      cancel: "Отмена",
      userFound: "Пользователь найден",
      selectPermissions: "Выберите права для представителя",
      confirmDelete: "Вы уверены, что хотите удалить этого представителя?",
      editPermissions: "Редактирование прав",
      loading: "Загрузка...",
    },
    uz: {
      title: "Mening vakillarim",
      description: "Sizning nomingizdan ishlashi mumkin bo'lgan vakillarni boshqarish",
      addRepresentative: "Vakil qo'shish",
      search: "Qidirish",
      noRepresentatives: "Sizda hali vakillar yo'q",
      name: "Ism",
      phone: "Telefon",
      permissions: "Huquqlar",
      status: "Holat",
      actions: "Amallar",
      active: "Faol",
      inactive: "Faol emas",
      edit: "Tahrirlash",
      delete: "O'chirish",
      add: "Qo'shish",
      save: "Saqlash",
      cancel: "Bekor qilish",
      userFound: "Foydalanuvchi topildi",
      selectPermissions: "Vakil uchun huquqlarni tanlang",
      confirmDelete: "Ushbu vakilni o'chirishni xohlaysizmi?",
      editPermissions: "Huquqlarni tahrirlash",
      loading: "Yuklanmoqda...",
    }
  };
  const text = t[language];
  const permLabels = PERMISSION_LABELS[language];

  const { data: representatives, isLoading } = useQuery<Representative[]>({
    queryKey: ['/api/representatives'],
  });

  const searchUserMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await apiRequest('GET', `/api/representatives/search-user?phone=${encodeURIComponent(phone)}`);
      return res.json();
    },
    onSuccess: (user) => {
      setFoundUser(user);
      setSelectedPermissions([]);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Пользователь не найден",
        variant: "destructive",
      });
      setFoundUser(null);
    },
  });

  const addRepresentativeMutation = useMutation({
    mutationFn: async (data: { representativeUserId: number; permissions: RepresentativePermission[] }) => {
      const res = await apiRequest('POST', '/api/representatives', data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: language === 'ru' ? "Успешно" : "Muvaffaqiyatli",
        description: language === 'ru' ? "Представитель добавлен" : "Vakil qo'shildi",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/representatives'] });
      setIsAddDialogOpen(false);
      setFoundUser(null);
      phoneInput.setDigits('');
      setSelectedPermissions([]);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateRepresentativeMutation = useMutation({
    mutationFn: async ({ id, permissions, isActive }: { id: number; permissions: RepresentativePermission[]; isActive: boolean }) => {
      const res = await apiRequest('PUT', `/api/representatives/${id}`, { permissions, isActive });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: language === 'ru' ? "Успешно" : "Muvaffaqiyatli",
        description: language === 'ru' ? "Права обновлены" : "Huquqlar yangilandi",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/representatives'] });
      setIsEditDialogOpen(false);
      setEditingRep(null);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteRepresentativeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/representatives/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: language === 'ru' ? "Успешно" : "Muvaffaqiyatli",
        description: language === 'ru' ? "Представитель удален" : "Vakil o'chirildi",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/representatives'] });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (phoneInput.isComplete) {
      searchUserMutation.mutate(phoneInput.getFullPhone());
    }
  };

  const handleAddRepresentative = () => {
    if (foundUser) {
      addRepresentativeMutation.mutate({
        representativeUserId: foundUser.id,
        permissions: selectedPermissions,
      });
    }
  };

  const handleEditRep = (rep: Representative) => {
    setEditingRep(rep);
    setSelectedPermissions(rep.permissions);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (editingRep) {
      updateRepresentativeMutation.mutate({
        id: editingRep.id,
        permissions: selectedPermissions,
        isActive: editingRep.isActive,
      });
    }
  };

  const togglePermission = (permission: RepresentativePermission) => {
    setSelectedPermissions(prev => 
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const toggleActive = () => {
    if (editingRep) {
      setEditingRep({ ...editingRep, isActive: !editingRep.isActive });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <section className="space-y-6" data-testid="section-representatives">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {text.title}
            </CardTitle>
            <CardDescription>{text.description}</CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-representative">
                <UserPlus className="h-4 w-4 mr-2" />
                {text.addRepresentative}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{text.addRepresentative}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      {...phoneInput.inputProps}
                      data-testid="input-search-phone"
                    />
                    <Button 
                      onClick={handleSearch} 
                      disabled={searchUserMutation.isPending || !phoneInput.isComplete}
                      data-testid="button-search-user"
                    >
                      {searchUserMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                
                {foundUser && (
                  <div className="space-y-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">{text.userFound}</p>
                      <p className="font-medium">{foundUser.displayName}</p>
                      <p className="text-sm text-muted-foreground">{foundUser.phone}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">{text.selectPermissions}</Label>
                      <div className="space-y-2 mt-2">
                        {ALL_REPRESENTATIVE_PERMISSIONS.map((permission) => (
                          <div key={permission} className="flex items-center space-x-2">
                            <Checkbox
                              id={`add-${permission}`}
                              checked={selectedPermissions.includes(permission)}
                              onCheckedChange={() => togglePermission(permission)}
                              data-testid={`checkbox-permission-${permission}`}
                            />
                            <label htmlFor={`add-${permission}`} className="text-sm cursor-pointer">
                              {permLabels[permission]}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  {text.cancel}
                </Button>
                <Button 
                  onClick={handleAddRepresentative} 
                  disabled={!foundUser || addRepresentativeMutation.isPending}
                  data-testid="button-confirm-add"
                >
                  {addRepresentativeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {text.add}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {representatives && representatives.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{text.name}</TableHead>
                  <TableHead>{text.phone}</TableHead>
                  <TableHead>{text.permissions}</TableHead>
                  <TableHead>{text.status}</TableHead>
                  <TableHead className="text-right">{text.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {representatives.map((rep) => (
                  <TableRow key={rep.id} data-testid={`row-representative-${rep.id}`}>
                    <TableCell className="font-medium">
                      {rep.representativeUser?.displayName || '-'}
                    </TableCell>
                    <TableCell>{rep.representativeUser?.phone || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {rep.permissions.length > 0 ? (
                          rep.permissions.map((perm) => (
                            <Badge key={perm} variant="secondary" className="text-xs">
                              {permLabels[perm]}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rep.isActive ? "default" : "secondary"}>
                        {rep.isActive ? text.active : text.inactive}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => handleEditRep(rep)}
                          data-testid={`button-edit-${rep.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => {
                            if (confirm(text.confirmDelete)) {
                              deleteRepresentativeMutation.mutate(rep.id);
                            }
                          }}
                          data-testid={`button-delete-${rep.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{text.noRepresentatives}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{text.editPermissions}</DialogTitle>
          </DialogHeader>
          {editingRep && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{editingRep.representativeUser?.displayName}</p>
                <p className="text-sm text-muted-foreground">{editingRep.representativeUser?.phone}</p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-active"
                  checked={editingRep.isActive}
                  onCheckedChange={toggleActive}
                />
                <label htmlFor="edit-active" className="text-sm cursor-pointer">
                  {text.active}
                </label>
              </div>
              
              <div>
                <Label className="text-sm font-medium">{text.permissions}</Label>
                <div className="space-y-2 mt-2">
                  {ALL_REPRESENTATIVE_PERMISSIONS.map((permission) => (
                    <div key={permission} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-${permission}`}
                        checked={selectedPermissions.includes(permission)}
                        onCheckedChange={() => togglePermission(permission)}
                      />
                      <label htmlFor={`edit-${permission}`} className="text-sm cursor-pointer">
                        {permLabels[permission]}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {text.cancel}
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={updateRepresentativeMutation.isPending}
            >
              {updateRepresentativeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {text.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
