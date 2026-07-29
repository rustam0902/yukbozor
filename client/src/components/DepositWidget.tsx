import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Wallet, Plus } from "lucide-react";
import { formatMoney } from "@/lib/utils";

interface DepositWidgetProps {
  balance: number;
  blocked: number;
  onTopUp?: () => void;
  language?: 'ru' | 'uz';
}

export default function DepositWidget({
  balance,
  blocked,
  onTopUp,
  language = 'ru'
}: DepositWidgetProps) {
  const texts = {
    ru: {
      title: 'Депозит',
      available: 'Доступно',
      blocked: 'Заблокировано',
      total: 'Всего',
      currency: 'сум',
      topUp: 'Пополнить'
    },
    uz: {
      title: 'Depozit',
      available: 'Mavjud',
      blocked: 'Bloklangan',
      total: 'Jami',
      currency: 'so\'m',
      topUp: 'To\'ldirish'
    }
  };

  const t = texts[language];

  const available = balance - blocked;
  const total = balance;
  const percentageAvailable = total > 0 ? (available / total) * 100 : 0;

  return (
    <Card data-testid="card-deposit">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          {t.title}
        </CardTitle>
        <Button size="sm" onClick={onTopUp} className="gap-1" data-testid="button-top-up">
          <Plus className="h-4 w-4" />
          {t.topUp}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-3xl font-bold" data-testid="text-available-balance">
            {formatMoney(available)}
          </div>
          <div className="text-sm text-muted-foreground">{t.available} ({t.currency})</div>
        </div>

        <Progress value={percentageAvailable} className="h-2" />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">{t.blocked}</div>
            <div className="font-semibold" data-testid="text-blocked-balance">
              {formatMoney(blocked)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">{t.total}</div>
            <div className="font-semibold" data-testid="text-total-balance">
              {formatMoney(total)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
