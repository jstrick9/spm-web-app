import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './Button';

/**
 * ThemeToggle — flips a `.dark` class on <html>. Persists choice to
 * localStorage. Reads system preference on first load (handled by the
 * inline script in index.html so there's no flash).
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    try { localStorage.setItem('wedding.theme', theme); } catch { /* */ }
  }, [theme]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
