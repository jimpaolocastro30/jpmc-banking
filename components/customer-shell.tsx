"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n";
import { MobileFrame } from "@/components/mobile-frame";
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

  const navigation = (
    <nav className="grid grid-cols-5 border-t border-sand-2 bg-white px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
      {links.map((link) => {
        const active = link.href === "/home" ? pathname === "/home" : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link key={link.href} href={link.href} className={`rounded-lg px-0.5 py-2 text-center text-[10px] font-semibold leading-tight ${active ? "bg-leaf/10 text-leaf" : "text-muted"}`}>
            {t(link.key)}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <CustomerContext.Provider value={{ me, refresh }}>
      <MobileFrame footer={navigation}>{children}</MobileFrame>
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
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  );
}
