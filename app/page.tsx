"use client";

import Link from "next/link";
import { MobileFrame } from "@/components/mobile-frame";
import { LanguageSwitch } from "@/components/ui";
import { useI18n } from "@/components/i18n";

export default function HomePage() {
  const { t } = useI18n();
  return (
    <MobileFrame tone="forest">
      <main className="flex min-h-full flex-col justify-between px-6 py-8">
        <div className="flex items-center justify-between">
          <p className="text-3xl font-semibold tracking-tight text-white">Bankak</p>
          <LanguageSwitch />
        </div>
        <div className="max-w-xl py-16">
          <p className="text-sm uppercase tracking-[0.22em] text-gold-2">SDG</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight">{t("tagline")}</h1>
          <p className="mt-6 max-w-md text-sand/75">{t("demoNote")}</p>
          <div className="mt-10 space-y-3">
            <Link href="/login" className="block rounded-2xl bg-white px-5 py-4 text-forest">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-leaf">{t("login.usersTitle")}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{t("common.signIn")}</p>
              <p className="mt-1 text-sm text-ink/70">{t("login.usersHint")}</p>
            </Link>
            <Link href="/personnel" className="block rounded-2xl border border-white/15 bg-white/5 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-2">{t("login.personnelTitle")}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{t("common.signIn")}</p>
              <p className="mt-1 text-sm text-sand/70">{t("login.personnelHint")}</p>
            </Link>
          </div>
        </div>
        <p className="text-sm text-sand/50">English · Filipino</p>
      </main>
    </MobileFrame>
  );
}
