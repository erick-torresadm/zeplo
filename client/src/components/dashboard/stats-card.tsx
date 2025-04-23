import { Card, CardContent } from "@/components/ui/card";
import { ReactNode } from "react";

interface StatsCardProps {
  title: string;
  value: string | number;
  label?: string;
  secondaryValue?: string | number;
  secondaryLabel?: string;
  icon: ReactNode;
  color: "primary" | "whatsapp" | "amber";
}

export function StatsCard({
  title,
  value,
  label,
  secondaryValue,
  secondaryLabel,
  icon,
  color,
}: StatsCardProps) {
  const bgColor = {
    primary: "bg-primary-100 text-primary-700",
    whatsapp: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
  }[color];

  const valueColor = {
    primary: "text-primary-600",
    whatsapp: "text-green-600",
    amber: "text-amber-600",
  }[color];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-700">{title}</h3>
          <div className={`text-sm font-semibold px-3 py-1 rounded-full ${bgColor}`}>
            {label}
          </div>
        </div>
        <div className="mt-4 flex">
          <div className="flex-1">
            <div className="text-sm text-slate-500">{icon}</div>
            <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
          </div>
          {secondaryValue !== undefined && secondaryLabel && (
            <div className="flex-1">
              <div className="text-sm text-slate-500">{secondaryLabel}</div>
              <div className="text-2xl font-bold text-slate-600">{secondaryValue}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
