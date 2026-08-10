import { forwardRef, type ReactNode } from 'react';
import { AnimatePresence, motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

type ButtonVariant =
  | 'primary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'premium'
  | 'premium-danger'
  | 'premium-secondary';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-accent-indigo to-accent-purple text-white shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/35',
  outline:
    'border border-border bg-surface text-foreground hover:bg-slate-50 dark:border-border-dark dark:bg-surface-dark dark:text-foreground-dark dark:hover:bg-white/5',
  ghost: 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5',
  danger: 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/35',
  premium:
    'bg-gradient-to-r from-accent-indigo to-accent-purple text-white shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/35 dark:shadow-primary-500/30',
  'premium-danger':
    'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/35 dark:shadow-red-500/30',
  'premium-secondary':
    'border border-white/30 bg-white/70 text-foreground shadow-lg shadow-slate-900/5 backdrop-blur-md hover:bg-white/85 hover:shadow-xl dark:border-white/10 dark:bg-white/10 dark:text-foreground-dark dark:shadow-black/20 dark:hover:bg-white/15',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-10 px-4 text-xs',
  md: 'h-12 px-6 text-sm',
  lg: 'h-14 px-8 text-base',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      leftIcon,
      rightIcon,
      ...props
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
        whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-full font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-50',
          variantClass[variant],
          sizeClass[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        <AnimatePresence mode="wait" initial={false}>
          {loading ? (
            <motion.span
              key="loading"
              aria-label="Loading"
              className="h-4 w-4 rounded-full border-2 border-current border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            />
          ) : (
            <motion.span
              key="content"
              className="inline-flex items-center justify-center gap-2"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              {leftIcon}
              {children}
              {rightIcon}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
export const PremiumButton = Button;
