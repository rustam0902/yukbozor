import { useState } from "react";
import { Star } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface RatingDialogProps {
  contractId: number;
  ratedUserId: number;
  ratedAsRole: 'customer' | 'carrier';
  counterpartyName: string;
  language: 'ru' | 'uz';
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RatingDialog({
  contractId,
  ratedUserId,
  ratedAsRole,
  counterpartyName,
  language,
  isOpen,
  onClose,
  onSuccess,
}: RatingDialogProps) {
  const { toast } = useToast();
  const [score, setScore] = useState(0);
  const [hoveredScore, setHoveredScore] = useState(0);
  const [comment, setComment] = useState("");

  const texts = {
    ru: {
      title: ratedAsRole === 'carrier' ? 'Оцените Перевозчика' : 'Оцените Заказчика',
      description: `Как прошла работа с ${counterpartyName}?`,
      placeholder: 'Оставьте комментарий (необязательно)',
      submit: 'Отправить оценку',
      cancel: 'Позже',
      success: 'Спасибо за вашу оценку!',
      error: 'Ошибка при отправке оценки',
      selectRating: 'Выберите оценку от 1 до 5 звёзд',
    },
    uz: {
      title: ratedAsRole === 'carrier' ? 'Tashuvchini baholang' : 'Buyurtmachini baholang',
      description: `${counterpartyName} bilan ishlash qanday o'tdi?`,
      placeholder: 'Izoh qoldiring (ixtiyoriy)',
      submit: 'Baholash',
      cancel: 'Keyinroq',
      success: 'Bahoyingiz uchun rahmat!',
      error: 'Baho yuborishda xatolik',
      selectRating: '1 dan 5 gacha yulduz tanlang',
    }
  };

  const t = texts[language];

  const submitRatingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/ratings', {
        contractId,
        ratedUserId,
        ratedAsRole,
        score,
        comment: comment.trim() || null,
      });
    },
    onSuccess: () => {
      toast({ title: t.success });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ratings/check', contractId] });
      setScore(0);
      setComment("");
      onSuccess?.();
      onClose();
    },
    onError: () => {
      toast({ title: t.error, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (score === 0) {
      toast({ title: t.selectRating, variant: "destructive" });
      return;
    }
    submitRatingMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="text-rating-title">{t.title}</DialogTitle>
          <DialogDescription data-testid="text-rating-description">{t.description}</DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex gap-1" data-testid="rating-stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="p-1 transition-transform hover:scale-110"
                onMouseEnter={() => setHoveredScore(star)}
                onMouseLeave={() => setHoveredScore(0)}
                onClick={() => setScore(star)}
                data-testid={`button-star-${star}`}
              >
                <Star
                  className={`h-8 w-8 transition-colors ${
                    star <= (hoveredScore || score)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>
          
          <Textarea
            placeholder={t.placeholder}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="resize-none"
            rows={3}
            data-testid="input-rating-comment"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="button-rating-cancel"
          >
            {t.cancel}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitRatingMutation.isPending || score === 0}
            data-testid="button-rating-submit"
          >
            {submitRatingMutation.isPending ? "..." : t.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface StarRatingProps {
  rating: number | null;
  count?: number;
  size?: 'sm' | 'md';
  showCount?: boolean;
}

export function StarRating({ rating, count = 0, size = 'sm', showCount = true }: StarRatingProps) {
  const starSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  
  if (rating === null || rating === 0) {
    return (
      <div className="flex items-center gap-1 text-muted-foreground text-xs">
        <Star className={`${starSize} text-muted-foreground/50`} />
        <span>—</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${starSize} ${
              star <= Math.round(rating)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/30"
            }`}
          />
        ))}
      </div>
      <span className="text-sm font-medium">{rating.toFixed(1)}</span>
      {showCount && count > 0 && (
        <span className="text-xs text-muted-foreground">({count})</span>
      )}
    </div>
  );
}
