"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCustomer } from "@/components/customer-shell";
import { useErrorText, useI18n } from "@/components/i18n";
import { TxRow } from "@/components/tx-row";
import { Panel } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/format";
import type { AccountView, TxView } from "@/lib/types";

export default function HomePage() {
  const { t, lang } = useI18n();
  const errorText = useErrorText();
  const { me, refresh } = useCustomer();
  const [accounts, setAccounts] = useState<AccountView[]>([]);
  const [recent, setRecent] = useState<TxView[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ accounts: AccountView[]; recent: TxView[] }>("/api/customer/dashboard")
      .then((data) => {
        setAccounts(data.accounts);
        setRecent(data.recent);
      })
      .catch((caught) => setError(errorText(caught)));
  }, [errorText]);

  const primary = accounts.find((account) => account.type === "savings") ?? accounts[0];
  const first = me?.fullName.split(" ")[0] ?? "";

  async function toggleBalance() {
    if (!me) return;
    await api("/api/customer/preferences", { method: "PATCH", body: JSON.stringify({ hideBalance: !me.hideBalance }) });
    await refresh();
  }

  return (
    <div>
      <header className="bg-forest px-5 pb-16 pt-6 text-sand">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-2">Bankak</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t("home.hello", { name: first })}</h1>
          </div>
          <Link href="/notifications" className="relative rounded-full bg-white/10 px-3 py-2 text-sm">
            {me?.unread ? me.unread : "0"}
          </Link>
        </div>
      </header>
      <div className="-mt-10 space-y-5 px-5">
        <Panel>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">{t("home.primary")}</p>
            <button type="button" onClick={toggleBalance} className="text-xs font-semibold text-leaf">
              {me?.hideBalance ? t("common.show") : t("common.hide")}
            </button>
          </div>
          <p className="mt-2 text-4xl font-semibold tracking-tight">
            {formatMoney(primary?.availableBalance, primary?.currency ?? me?.currency, lang, me?.hideBalance)}
          </p>
          <p className="mt-1 text-sm text-muted">{primary ? `${primary.name} · ${primary.maskedNumber}` : ""}</p>
        </Panel>
        <div>
          <p className="mb-2 text-sm font-semibold">{t("home.quick")}</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              ["/transfers", "home.transfer"],
              ["/payments?tab=topup", "home.topup"],
              ["/payments?tab=bills", "home.bills"],
              ["/cards", "home.cards"],
            ].map(([href, key]) => (
              <Link key={href} href={href} className="rounded-xl border border-sand-2 bg-white px-1.5 py-3 text-center text-[11px] font-semibold leading-tight text-forest">
                {t(key)}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">{t("home.accounts")}</p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {accounts.map((account) => (
              <Link key={account.id} href={`/accounts/${account.id}`} className="min-w-44 rounded-2xl bg-forest-2 p-4 text-sand">
                <p className="text-xs uppercase tracking-wide text-gold-2">{t(`accounts.${account.type}`)}</p>
                <p className="mt-3 font-serif text-2xl">{formatMoney(account.availableBalance, account.currency, lang, me?.hideBalance)}</p>
                <p className="mt-2 text-xs text-sand/70">{account.maskedNumber}</p>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold">{t("home.recent")}</p>
          <Panel>{recent.length ? recent.map((tx) => <TxRow key={tx.id} tx={tx} />) : <p className="text-sm text-muted">{t("common.empty")}</p>}</Panel>
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    </div>
  );
}
