"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n";
import { api } from "@/lib/client";
import type { StaffProfile } from "@/lib/types";

const StaffContext = createContext<{ me: StaffProfile | null }>({ me: null });
export function useStaff() {
  return useContext(StaffContext);
}

const links: { href: string; key: string; permission?: string }[] = [
  { href: "/admin/dashboard", key: "adminNav.dashboard" },
  { href: "/admin/customers", key: "adminNav.customers", permission: "customers.read" },
  { href: "/admin/accounts", key: "adminNav.accounts", permission: "accounts.read" },
  { href: "/admin/cards", key: "adminNav.cards", permission: "cards.read" },
  { href: "/admin/transactions", key: "adminNav.transactions", permission: "transactions.read" },
  { href: "/admin/payments", key: "adminNav.payments", permission: "billers.manage" },
  { href: "/admin/requests", key: "adminNav.requests", permission: "requests.manage" },
  { href: "/admin/reports", key: "adminNav.reports", permission: "reports.read" },
  { href: "/admin/users", key: "adminNav.users", permission: "users.manage" },
  { href: "/admin/audit", key: "adminNav.audit", permission: "audit.read" },
  { href: "/admin/audit", key: "adminNav.audit", permission: "audit.own" },
  { href: "/admin/settings", key: "adminNav.settings", permission: "settings.manage" },
  { href: "/admin/settings", key: "adminNav.settings", permission: "settings.security" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { t, setLang } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<StaffProfile | null>(null);

  useEffect(() => {
    api<StaffProfile>("/api/auth/admin/me")
      .then((profile) => {
        setMe(profile);
        setLang(profile.language);
      })
      .catch(() => {
        window.location.href = "/personnel";
      });
  }, [pathname, setLang]);

  const allowed = links.filter((link) => !link.permission || me?.permissions.includes(link.permission));
  const visible = allowed.filter((link, index) => allowed.findIndex((item) => item.href === link.href) === index);

  return (
    <StaffContext.Provider value={{ me }}>
      <div className="min-h-screen bg-sand md:grid md:grid-cols-[240px_1fr]">
        <aside className="flex flex-col bg-forest text-sand md:min-h-screen">
          <div className="px-5 py-6">
            <p className="text-3xl font-semibold tracking-tight text-white">Bankak</p>
            <p className="text-xs uppercase tracking-[0.16em] text-sand/60">{t("admin.title")}</p>
          </div>
          <nav className="flex gap-2 overflow-x-auto px-3 pb-4 md:block md:space-y-1 md:px-3">
            {visible.map((link) => (
              <Link key={link.href + link.permission} href={link.href} className={`block whitespace-nowrap rounded-xl px-3 py-2 text-sm ${pathname.startsWith(link.href) ? "bg-white/10 text-gold" : "text-sand/80"}`}>
                {t(link.key)}
              </Link>
            ))}
          </nav>
          <div className="mt-auto hidden px-5 py-6 md:block">
            <p className="text-sm">{me?.fullName}</p>
            <p className="text-xs text-sand/60">{me ? t(`roles.${me.role}`) : ""}</p>
            <button
              type="button"
              className="mt-3 text-sm text-gold"
              onClick={async () => {
                await api("/api/auth/admin/logout", { method: "POST" });
                router.push("/personnel");
              }}
            >
              {t("common.signOut")}
            </button>
          </div>
        </aside>
        <div className="px-4 py-6 md:px-8">{children}</div>
      </div>
    </StaffContext.Provider>
  );
}

export function Can({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { me } = useStaff();
  if (!me?.permissions.includes(permission)) return null;
  return children;
}
