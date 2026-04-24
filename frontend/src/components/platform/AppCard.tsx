import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface AppCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  color: "blue" | "orange" | "green" | "purple";
  badge?: string;
}

const colorClasses = {
  blue: "bg-blue-50 border-blue-200 hover:border-blue-300 text-blue-700",
  orange: "bg-orange-50 border-orange-200 hover:border-orange-300 text-orange-700",
  green: "bg-green-50 border-green-200 hover:border-green-300 text-green-700",
  purple: "bg-purple-50 border-purple-200 hover:border-purple-300 text-purple-700",
};

const iconBgClasses = {
  blue: "bg-blue-100",
  orange: "bg-orange-100",
  green: "bg-green-100",
  purple: "bg-purple-100",
};

export default function AppCard({
  title,
  description,
  icon: Icon,
  href,
  color,
  badge,
}: AppCardProps) {
  return (
    <Link href={href}>
      <div
        className={`group rounded-2xl border-2 p-6 sm:p-8 transition-all hover:shadow-lg cursor-pointer ${colorClasses[color]}`}
      >
        <div className="flex items-start justify-between mb-4">
          <div
            className={`${iconBgClasses[color]} w-12 h-12 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}
          >
            <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          {badge && (
            <span className="text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-white/60 text-slate-600">
              {badge}
            </span>
          )}
        </div>
        <h3 className="text-xl sm:text-2xl font-bold mb-2">{title}</h3>
        <p className="text-sm sm:text-base opacity-80">{description}</p>
      </div>
    </Link>
  );
}
