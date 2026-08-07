import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { I18nProvider, useI18n, I18N_STORAGE_KEY } from './I18nContext';

function Probe({ onLangChange }: { onLangChange?: (lang: string) => void }) {
  const { lang, t, setLang } = useI18n();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="countdown">{t('shell.countdown')}</span>
      <span data-testid="interp">{t('home.rsvpAs', { name: 'Jane' })}</span>
      <span data-testid="missing">{t('no.such.key')}</span>
      <select aria-label="lang" value={lang} onChange={(e) => setLang(e.target.value as 'en' | 'es' | 'fr' | 'zh')}>
        <option value="en">English</option>
        <option value="es">Español</option>
        <option value="fr">Français</option>
        <option value="zh">中文</option>
      </select>
    </div>
  );
}

function renderProbe(onLangChange?: (lang: string) => void) {
  return render(
    <I18nProvider onLangChange={onLangChange}>
      <Probe />
    </I18nProvider>,
  );
}

describe('I18nProvider — guest portal language layer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to English with working translations and interpolation', () => {
    renderProbe();
    expect(screen.getByTestId('lang').textContent).toBe('en');
    expect(screen.getByTestId('countdown').textContent).toBe('Wedding Day Countdown');
    expect(screen.getByTestId('interp').textContent).toBe('RSVP as Jane');
  });

  it('falls back to the key when a translation is missing', () => {
    renderProbe();
    expect(screen.getByTestId('missing').textContent).toBe('no.such.key');
  });

  it('switches the UI language live and persists to localStorage', () => {
    const onChange = (lang: string) => {
      // assertion happens below; keep for side-effect check
      window.__lastLang = lang;
    };
    renderProbe(onChange);
    fireEvent.change(screen.getByLabelText('lang'), { target: { value: 'es' } });
    expect(screen.getByTestId('lang').textContent).toBe('es');
    expect(screen.getByTestId('countdown').textContent).toBe('Cuenta regresiva para la boda');
    expect(screen.getByTestId('interp').textContent).toBe('RSVP como Jane');
    expect(localStorage.getItem(I18N_STORAGE_KEY)).toBe('es');
  });

  it('restores the saved language from localStorage on mount', () => {
    localStorage.setItem(I18N_STORAGE_KEY, 'fr');
    renderProbe();
    expect(screen.getByTestId('lang').textContent).toBe('fr');
    expect(screen.getByTestId('countdown').textContent).toBe('Compte à rebours du mariage');
  });

  it('adopts the server-saved language when provided', () => {
    render(
      <I18nProvider initialLang="zh">
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('lang').textContent).toBe('zh');
    expect(screen.getByTestId('countdown').textContent).toBe('婚礼倒计时');
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem(I18N_STORAGE_KEY, 'xx');
    renderProbe();
    expect(screen.getByTestId('lang').textContent).toBe('en');
  });
});

declare global {
  interface Window {
    __lastLang?: string;
  }
}
