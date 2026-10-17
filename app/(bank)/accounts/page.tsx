"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader, useCustomer } from "@/components/customer-shell";
import { useI18n } from "@/components/i18n";
import { Panel, StatusPill } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/format";
import type { AccountView } from "@/lib/types";

export default function AccountsPage() {
  const { t, lang } = useI18n();
  const { me } = useCustomer();
  const [accounts, setAccounts] = useState<AccountView[]>([]);

  useEffect(() => {
    api<AccountView[]>("/api/customer/accounts").then(setAccounts).catch(() => setAccounts([]));
  }, []);

  return (
    <div>
      <PageHeader title={t("accounts.title")} />
      <div className="space-y-3 px-5">
        {accounts.map((account) => (
          <Link key={account.id} href={`/accounts/${account.id}`}>
            <Panel>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted">{t(`accounts.${account.type}`)}</p>
                  <p className="font-serif text-2xl">{account.name}</p>
                  <p className="mt-1 text-sm">{account.maskedNumber}</p>
                </div>
                <StatusPill value={account.status} />
              </div>
              <p className="mt-4 font-serif text-3xl">{formatMoney(account.availableBalance, account.currency, lang, me?.hideBalance)}</p>
              <p className="text-xs text-muted">{account.currency}</p>
            </Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}
