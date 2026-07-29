import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
}

export default function StatsCard({ title, value, icon: Icon, description }: StatsCardProps) {
  return (
    <Card data-testid="card-stats">
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="text-sm text-muted-foreground mb-1">{title}</div>
            <div className="text-2xl font-bold" data-testid="text-stats-value">{value}</div>
            {description && (
              <div className="text-xs text-muted-foreground mt-1">{description}</div>
            )}
          </div>
          <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
