import React, { ReactNode, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface GradientButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'glass' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const GradientButton: React.FC<GradientButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  className,
  disabled,
  ...props
}) => {
  const baseStyles = 'font-medium rounded-lg transition-all duration-300 flex items-center justify-center gap-2';

  const variantStyles = {
    primary: cn(
      'bg-gradient-primary text-white',
      'hover:shadow-lg hover:scale-105',
      'active:scale-95',
      'disabled:opacity-50 disabled:cursor-not-allowed'
    ),
    secondary: cn(
      'bg-gradient-to-r from-primary to-secondary text-white',
      'hover:shadow-lg hover:opacity-90',
      'active:scale-95',
      'disabled:opacity-50 disabled:cursor-not-allowed'
    ),
    glass: cn(
      'bg-surface-container/40 backdrop-blur-[12px]',
      'border border-outline-variant/50',
      'text-on-surface',
      'hover:bg-surface-container-high/50',
      'hover:border-primary/50',
      'active:scale-95',
      'disabled:opacity-50 disabled:cursor-not-allowed'
    ),
    outline: cn(
      'border-2 border-primary',
      'text-primary',
      'bg-transparent',
      'hover:bg-primary/10',
      'active:scale-95',
      'disabled:opacity-50 disabled:cursor-not-allowed'
    ),
  };

  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-2.5 text-base',
    lg: 'px-8 py-3.5 text-lg',
  };

  return (
    <button
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default GradientButton;
