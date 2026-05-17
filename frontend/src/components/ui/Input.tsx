import React, { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  fullWidth = false,
  className,
  ...props
}) => {
  return (
    <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
      {label && (
        <label className="text-sm font-medium text-on-surface-variant uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
            {icon}
          </div>
        )}
        <input
          className={cn(
            'w-full bg-transparent',
            'border-b-2 border-outline-variant',
            'text-on-surface placeholder:text-on-surface-variant/50',
            'px-3 py-2.5',
            'focus:outline-none focus:border-primary focus:ring-0',
            'transition-colors duration-300',
            icon && 'pl-10',
            error && 'border-error',
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs text-error font-medium">{error}</p>
      )}
    </div>
  );
};

export default Input;
