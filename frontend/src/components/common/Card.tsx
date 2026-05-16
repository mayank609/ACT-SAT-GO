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

export function StatCard({ title, value, subtitle, trend }: StatCardProps) {
  return (
    <Card>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{title}</p>
      <p className="mt-1.5 text-2xl font-semibold text-slate-900">{value}</p>
      {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      {trend && (
        <p className={`mt-1.5 text-xs font-medium ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
        </p>
      )}
    </Card>
  );
}
