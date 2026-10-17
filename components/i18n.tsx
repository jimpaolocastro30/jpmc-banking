"use client";

import en from "@/messages/en.json";
import fil from "@/messages/fil.json";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Lang = "en" | "fil";
type Dict = typeof en;

function lookup(dict: Dict, path: string) {
  const value = path.split(".").reduce<unknown>((node, key) => {
    if (node && typeof node === "object" && key in node) return (node as Record<string, unknown>)[key];
    return undefined;
  }, dict);
  return typeof value === "string" ? value : path;
}

const LanguageContext = createContext<{
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (path: string, vars?: Record<string, string>) => string;
} | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("bankak_lang");
    if (saved === "fil" || saved === "en") setLangState(saved);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    localStorage.setItem("bankak_lang", next);
  }, []);

  const t = useMemo(() => {
    const dict = lang === "fil" ? fil : en;
    return (path: string, vars?: Record<string, string>) => {
      const raw = lookup(dict, path);
      if (!vars) return raw;
      return raw.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
    };
  }, [lang]);

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("LanguageProvider is missing");
  return context;
}

export function useErrorText() {
  const { t } = useI18n();
  return useCallback((error: unknown) => {
    const code = error instanceof Error ? error.message : "GENERIC";
    const message = t(`errors.${code}`);
    return message === `errors.${code}` ? t("errors.GENERIC") : message;
  }, [t]);
}
