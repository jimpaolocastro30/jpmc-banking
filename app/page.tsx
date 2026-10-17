"use client";

import Link from "next/link";
import { LanguageSwitch } from "@/components/ui";
import { useI18n } from "@/components/i18n";

export default function HomePage() {
  const { t } = useI18n();
  return (
    <main className="min-h-screen bg-forest text-sand">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-between px-6 py-8 lg:px-16">
        <div className="flex items-center justify-between">
          <p className="font-serif text-3xl text-gold">Bankak</p>
          <LanguageSwitch />
        </div>
        <div className="max-w-xl py-16">
          <p className="text-sm uppercase tracking-[0.22em] text-gold-2">SDG</p>
          <h1 className="mt-4 font-serif text-5xl leading-tight sm:text-6xl">{t("tagline")}</h1>
          <p className="mt-6 max-w-md text-sand/75">{t("demoNote")}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-full bg-gold px-6 py-3 text-sm font-semibold text-ink">
              {t("common.customer")}
            </Link>
            <Link href="/admin/login" className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold">
              {t("common.staff")}
            </Link>
          </div>
        </div>
        <p className="text-sm text-sand/50">English · Filipino</p>
      </div>
    </main>
  );
}
