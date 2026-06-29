import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { themePresets, ThemeName } from '../context/themeDefinitions';
import { Palette, Check, ChevronDown, Sparkles } from 'lucide-react';

export const ThemeSwitcher: React.FC = () => {
  const { currentTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const themes: Array<{ name: ThemeName; label: string; description: string }> = [
    {
      name: 'seven-paths-manor',
      label: 'Seven Paths Manor',
      description: 'Navy, champagne gold, ivory luxury',
    },
    {
      name: 'warm-romantic',
      label: 'Warm & Romantic',
      description: 'Blush pinks, sage greens, cream tones',
    },
    {
      name: 'modern-minimalist',
      label: 'Modern Minimalist',
      description: 'Clean whites, soft grays, high contrast',
    },
    {
      name: 'bold-editorial',
      label: 'Bold Editorial',
      description: 'High contrast, dramatic typography',
    },
  ];

  const current = themes.find(t => t.name === currentTheme) || themes[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface hover:bg-surface-2 transition-all"
      >
        <Palette className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{current.label}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-surface shadow-lg z-50 overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-display text-lg font-semibold">Choose Your Aesthetic</h3>
              <p className="text-xs text-fg-muted mt-1">Select a theme that matches your venue's personality</p>
            </div>
            
            <div className="p-2">
              {themes.map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => {
                    setTheme(theme.name);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                    currentTheme === theme.name 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'hover:bg-surface-2'
                  }`}
                >
                  <div 
                    className="w-8 h-8 rounded-full border-2 flex-shrink-0"
                    style={{ 
                      background: `linear-gradient(135deg, ${themePresets[theme.name].primary}, ${themePresets[theme.name].accent})`
                    }}
                  />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{theme.label}</span>
                      {currentTheme === theme.name && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-xs text-fg-muted mt-0.5">{theme.description}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="p-3 border-t border-border bg-surface-2">
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border hover:border-primary hover:text-primary transition-all text-sm">
                <Sparkles className="h-4 w-4" />
                Create Custom Theme
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
