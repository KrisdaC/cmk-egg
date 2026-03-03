import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

export function StatCard({ title, value, icon: Icon, trend, trendUp, className }: StatCardProps) {
  return (
    <div className={cn("bg-card p-6 rounded-2xl border border-border/50 shadow-sm hover:shadow-md transition-shadow", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className="p-2 bg-primary/5 rounded-lg text-primary">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div className="text-2xl font-display font-bold text-foreground">
          {value}
        </div>
        {trend && (
          <div className={cn(
            "text-xs font-medium px-2 py-1 rounded-full",
            trendUp ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"
          )}>
            {trend}
          </div>
        )}
      </div>
    </div>
  );
}
