import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'outline' | 'ghost' | 'chip';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground font-semibold hover:bg-primary/90',
  outline: 'border border-border bg-card/80 text-foreground font-semibold hover:bg-accent',
  // no backdrop blur: over a WebGL map the browser would re-blur on every frame
  ghost: 'border border-border/80 bg-card/90 text-foreground hover:bg-accent',
  chip: 'border border-border/80 bg-card/60 text-muted-foreground text-sm hover:bg-accent hover:text-foreground',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  // chips only: highlighted state
  on?: boolean;
}

// Every button is at least 48px tall: the game is played on phones
export const Button = forwardRef<HTMLButtonElement, Props>(({ className, variant = 'primary', on, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
      VARIANTS[variant],
      on && 'border-primary/70 bg-primary/15 text-foreground',
      className,
    )}
    {...props}
  />
));
Button.displayName = 'Button';
