import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  padding?: boolean;
  noPadding?: boolean;
}

export const Container: React.FC<ContainerProps> = ({
  children,
  className,
  maxWidth = 'full',
  padding = true,
  noPadding = false,
}) => {
  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'w-full',
  };

  return (
    <div
      className={cn(
        'mx-auto',
        maxWidthStyles[maxWidth],
        (padding && !noPadding) && 'px-container-padding',
        className
      )}
    >
      {children}
    </div>
  );
};

export default Container;
