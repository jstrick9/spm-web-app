import React, { createContext, useContext, useState, useEffect } from 'react';
import { themePresets, themeTypography, ThemeName, ThemeColors } from './themeDefinitions';

interface ThemeContextType {
  currentTheme: ThemeName;
  colors: ThemeColors;
  typography: { display: string; body: string };
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('seven-paths-manor');
  
  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('wvi-theme') as ThemeName;
    if (savedTheme && themePresets[savedTheme]) {
      setCurrentTheme(savedTheme);
    }
  }, []);

  // Update CSS variables when theme changes
  useEffect(() => {
    const colors = themePresets[currentTheme];
    const typography = themeTypography[currentTheme];
    
    const root = document.documentElement;
    
    // Set CSS variables for colors
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
    
    // Set CSS variables for typography
    root.style.setProperty('--font-display', typography.display);
    root.style.setProperty('--font-body', typography.body);
    
    // Save to localStorage
    localStorage.setItem('wvi-theme', currentTheme);
  }, [currentTheme]);

  const setTheme = (theme: ThemeName) => {
    setCurrentTheme(theme);
  };

  return (
    <ThemeContext.Provider value={{ 
      currentTheme, 
      colors: themePresets[currentTheme], 
      typography: themeTypography[currentTheme],
      setTheme 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
