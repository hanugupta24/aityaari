
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  attribute?: string; // 'class' or 'data-theme'
  enableSystem?: boolean;
}

interface ThemeProviderContextValue {
  theme: Theme | undefined;
  setTheme: (theme: Theme) => void;
  resolvedTheme?: "light" | "dark";
}

const ThemeProviderContext = createContext<ThemeProviderContextValue | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "ui-theme",
  attribute = "class",
  enableSystem = true,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    try {
      return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
    } catch (e) {
      // Unsupported
      return defaultTheme;
    }
  });
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark" | undefined>();

  const applyTheme = useCallback((currentTheme: Theme | undefined) => {
    if (typeof window === "undefined" || !currentTheme) return;

    let newResolvedTheme: "light" | "dark";
    if (currentTheme === "system" && enableSystem) {
      newResolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      newResolvedTheme = currentTheme === "dark" ? "dark" : "light";
    }

    const d = document.documentElement;
    if (attribute === "class") {
      d.classList.remove("light", "dark");
      d.classList.add(newResolvedTheme);
    } else {
      d.setAttribute(attribute, newResolvedTheme);
    }
    setResolvedTheme(newResolvedTheme);
  }, [attribute, enableSystem]);


  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  useEffect(() => {
    if (typeof window === 'undefined' || !enableSystem) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, enableSystem, applyTheme]);

  const setTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem(storageKey, newTheme);
    } catch (e) {
      // Unsupported
    }
    setThemeState(newTheme);
  };
  
  // Initialize theme on mount
  useEffect(() => {
    const storedTheme = typeof window !== "undefined" ? (localStorage.getItem(storageKey) as Theme) : undefined;
    setThemeState(storedTheme || defaultTheme);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
