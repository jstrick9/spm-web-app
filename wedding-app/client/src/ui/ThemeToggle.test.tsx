import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeToggle } from './ThemeToggle';

beforeEach(() => {
  document.documentElement.classList.remove('dark');
  try { localStorage.removeItem('wedding.theme'); } catch { /* */ }
});
afterEach(() => {
  document.documentElement.classList.remove('dark');
});

describe('ThemeToggle', () => {
  it('toggles the .dark class on <html>', async () => {
    render(<ThemeToggle />);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    await userEvent.click(screen.getByRole('button'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    await userEvent.click(screen.getByRole('button'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists choice to localStorage', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button'));
    expect(localStorage.getItem('wedding.theme')).toBe('dark');
  });
});
