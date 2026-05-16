import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:   'bg-blue-600 hover:bg-blue-700 text-white',
  secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200',
  ghost:     'bg-transparent hover:bg-slate-100 text-slate-600',
  danger:    'bg-red-600 hover:bg-red-700 text-white',
  success:   'bg-emerald-600 hover:bg-emerald-700 text-white',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
};

export function Button({
  children, variant = 'primary', size = 'md', loading = false,
  icon, iconRight, className = '', disabled, ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
}
