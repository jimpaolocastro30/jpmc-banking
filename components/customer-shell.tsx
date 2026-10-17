"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n";
import { api } from "@/lib/client";
import type { CustomerProfile } from "@/lib/types";

const CustomerContext = createContext<{ me: CustomerProfile | null; refresh: () => Promise<void> }>({
  me: null,
  refresh: async () => undefined,
});

export function useCustomer() {
  return useContext(CustomerContext);
}

const links = [
  { href: "/home", key: "nav.home" },
  { href: "/accounts", key: "nav.accounts" },
  { href: "/transfers", key: "nav.transfers" },
  { href: "/payments", key: "nav.payments" },
  { href: "/more", key: "nav.more" },
];

export function CustomerShell({ children }: { children: React.ReactNode }) {
  const { t, setLang } = useI18n();
  const pathname = usePathname();
  const [me, setMe] = useState<CustomerProfile | null>(null);

  async function refresh() {
    const profile = await api<CustomerProfile>("/api/auth/customer/me");
    setMe(profile);
    setLang(profile.language);
  }

  useEffect(() => {
    let active = true;
    api<CustomerProfile>("/api/auth/customer/me")
      .then((profile) => {
        if (!active) return;
        setMe(profile);
        setLang(profile.language);
      })
      .catch(() => {
        window.location.href = "/login";
      });
    return () => {
      active = false;
    };
  }, [pathname, setLang]);

  return (
    <CustomerContext.Provider value={{ me, refresh }}>
      <div className="min-h-screen lg:grid lg:grid-cols-[minmax(260px,380px)_1fr]">
        <aside className="hidden flex-col justify-between bg-forest p-10 text-sand lg:flex">
          <div>
            <p className="font-serif text-5xl text-gold">Bankak</p>
            <p className="mt-6 max-w-xs text-lg leading-relaxed text-sand/80">{t("tagline")}</p>
          </div>
          <p className="max-w-xs text-sm text-sand/60">{t("demoNote")}</p>
        </aside>
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
          <div className="flex-1 pb-4">{children}</div>
          <nav className="sticky bottom-0 grid grid-cols-5 border-t border-sand-2 bg-white/95 px-1 py-2 backdrop-blur">
            {links.map((link) => {
              const active = link.href === "/home" ? pathname === "/home" : pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link key={link.href} href={link.href} className={`px-1 py-2 text-center text-[11px] font-semibold ${active ? "text-forest" : "text-muted"}`}>
                  {t(link.key)}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </CustomerContext.Provider>
  );
}

export function PageHeader({ title, back, action }: { title: string; back?: string; action?: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <header className="flex items-end justify-between px-5 pb-3 pt-6">
      <div>
        {back ? (
          <Link href={back} className="text-xs font-semibold uppercase tracking-[0.16em] text-leaf">
            {t("common.back")}
          </Link>
        ) : null}
        <h1 className="font-serif text-3xl">{title}</h1>
      </div>
      {action}
    </header>
  );
}
