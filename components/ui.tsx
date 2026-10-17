"use client";

import { useI18n } from "@/components/i18n";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const tones: Record<string, string> = {
  successful: "bg-ok/10 text-ok",
  active: "bg-ok/10 text-ok",
  approved: "bg-ok/10 text-ok",
  completed: "bg-ok/10 text-ok",
  pending: "bg-gold/25 text-ink",
  frozen: "bg-gold/25 text-ink",
  submitted: "bg-gold/25 text-ink",
  processing: "bg-leaf/10 text-leaf",
  under_review: "bg-leaf/10 text-leaf",
  failed: "bg-danger/10 text-danger",
  rejected: "bg-danger/10 text-danger",
  blocked: "bg-danger/10 text-danger",
  suspended: "bg-danger/10 text-danger",
  reversed: "bg-sand-2 text-muted",
  inactive: "bg-sand-2 text-muted",
  cancelled: "bg-sand-2 text-muted",
  initiated: "bg-sand-2 text-muted",
};

export function StatusPill({ value }: { value: string }) {
  const { t } = useI18n();
  const label = t(`status.${value}`);
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tones[value] ?? "bg-sand-2 text-ink"}`}>
      {label === `status.${value}` ? value : label}
    </span>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "gold" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-forest text-white hover:bg-forest-2",
    gold: "bg-gold text-ink",
    ghost: "border border-sand-2 bg-white text-ink hover:bg-sand",
    danger: "bg-danger text-white",
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <input className="w-full rounded-2xl border border-sand-2 bg-white px-3 py-3 outline-none ring-leaf focus:ring-2" {...props} />
    </label>
  );
}

export function Select({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <select className="w-full rounded-2xl border border-sand-2 bg-white px-3 py-3 outline-none ring-leaf focus:ring-2" {...props}>
        {children}
      </select>
    </label>
  );
}

export function Area({ label, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <textarea className="w-full rounded-2xl border border-sand-2 bg-white px-3 py-3 outline-none ring-leaf focus:ring-2" {...props} />
    </label>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-white p-4 shadow-sm shadow-forest/5 ${className}`}>{children}</section>;
}

export function Empty({ text }: { text: string }) {
  return <p className="rounded-3xl border border-dashed border-sand-2 px-4 py-8 text-center text-sm text-muted">{text}</p>;
}

export function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="flex rounded-full bg-white/15 p-1 text-xs font-semibold">
      {(["en", "fil"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          className={`rounded-full px-3 py-1 ${lang === code ? "bg-gold text-ink" : "text-inherit"}`}
        >
          {code === "en" ? t("common.english") : t("common.filipino")}
        </button>
      ))}
    </div>
  );
}
