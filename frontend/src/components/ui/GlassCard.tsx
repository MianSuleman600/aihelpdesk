import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  hoverable?: boolean;
  onClick?: () => void;
  gradient?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  interactive = false,
  hoverable = false,
  onClick,
  gradient = false,
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'relative rounded-xl overflow-hidden',
        'bg-surface-container/40 backdrop-blur-[12px]',
        'border border-outline-variant/30',
        'shadow-glass-border',
        // Inner glow effect
        'before:absolute before:inset-0 before:rounded-xl before:pointer-events-none',
        'before:shadow-glass-inner',
        // Gradient background option
        gradient && 'bg-gradient-to-br from-primary/10 to-secondary/10',
        // Interactive states
        interactive && 'cursor-pointer transition-all duration-300',
        hoverable && 'hover:bg-surface-container-high/40 hover:shadow-lg',
        hoverable && 'hover:border-primary/50',
        className
      )}
    >
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default GlassCard;
