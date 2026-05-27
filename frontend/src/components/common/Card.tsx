import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export function Card({ children, className = '', padding = 'md', hoverable = false }: CardProps) {
  return (
    <div
      className={`
        bg-white rounded-xl border border-slate-100
        ${paddingClasses[padding]}
        ${hoverable ? 'hover:border-slate-200 transition-colors cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; positive: boolean };
  color?: 'blue' | 'emerald' | 'amber' | 'red' | 'purple' | 'slate';
}

const colorMap: Record<NonNullable<StatCardProps['color']>, { bg: string; text: string }> = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600' },
  red:     { bg: 'bg-red-50',     text: 'text-red-500' },
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-600' },
  slate:   { bg: 'bg-slate-100',  text: 'text-slate-600' },
};

export function StatCard({ title, value, subtitle, icon, trend, color }: StatCardProps) {
  const c = color ? colorMap[color] : null;
  return (
    <Card>
      {icon && c && (
        <div className={`w-8 h-8 rounded-lg ${c.bg} ${c.text} flex items-center justify-center mb-3`}>
          {icon}
        </div>
      )}
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{title}</p>
      <p className={`mt-1.5 text-2xl font-semibold ${c ? c.text : 'text-slate-900'}`}>{value}</p>
      {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      {trend && (
        <p className={`mt-1.5 text-xs font-medium ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
        </p>
      )}
    </Card>
  );
}
