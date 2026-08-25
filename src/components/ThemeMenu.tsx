import { Check, ChevronDown, Moon, Sun } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme, type AppTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

type ThemeMenuProps = {
  /** Compact icon-sized trigger (mobile) vs labeled "Tema" (desktop) */
  variant?: 'button' | 'icon';
  className?: string;
};

export function ThemeMenu({ variant = 'button', className }: ThemeMenuProps) {
  const { theme, setTheme, isLight } = useTheme();

  const select = (next: AppTheme) => {
    setTheme(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'icon' ? (
          <button
            type="button"
            title="Tema"
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:text-foreground',
              className,
            )}
          >
            {isLight ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-secondary/60 px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary',
              className,
            )}
          >
            {isLight ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            Tema
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px] rounded-xl border-border p-1">
        <DropdownMenuItem
          onClick={() => select('dark')}
          className="cursor-pointer rounded-lg px-3 py-2.5 text-sm"
        >
          <Moon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
          <span className="flex-1">Tema escuro (Padrão)</span>
          {theme === 'dark' && <Check className="h-4 w-4 shrink-0" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => select('light')}
          className="cursor-pointer rounded-lg px-3 py-2.5 text-sm"
        >
          <Sun className="mr-2 h-4 w-4 shrink-0 opacity-70" />
          <span className="flex-1">
            Tema claro{' '}
            <span className="font-semibold text-amber-400">(Beta)</span>
          </span>
          {theme === 'light' && <Check className="h-4 w-4 shrink-0" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
