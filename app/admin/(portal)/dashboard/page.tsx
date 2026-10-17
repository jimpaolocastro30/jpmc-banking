"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n";
import { Can } from "@/components/admin-shell";
import { Button, Panel } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney, formatWhen } from "@/lib/format";

type Stats = {
  customers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  accountsActive: number;
  accountsInactive: number;
  cardsActive: number;
  cardsBlocked: number;
  cardsFrozen: number;
  transactions: number;
  failed: number;
  pending: number;
  openRequests: number;
  integrationIssues: number;
  volume: number;
};

type Approval = { id: string; type: string; requestedByName: string; remarks: string; payload: { reference?: string; toRole?: string; role?: string }; createdAt: string };

export default function DashboardPage() {
  const { t, lang } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);

  function load() {
    api<Stats>("/api/admin/dashboard").then(setStats);
    api<Approval[]>("/api/admin/approvals").then(setApprovals).catch(() => setApprovals([]));
  }
  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, decision: "approved" | "rejected") {
    await api(`/api/admin/approvals/${id}`, { method: "POST", body: JSON.stringify({ decision, remarks: decision }) });
    load();
  }

  const cards = stats
    ? [
        [t("admin.customers"), `${stats.activeCustomers} / ${stats.customers}`],
        [t("admin.accountsOn"), String(stats.accountsActive)],
        [t("admin.accountsOff"), String(stats.accountsInactive)],
        [t("admin.cardsOn"), String(stats.cardsActive)],
        [t("admin.cardsOff"), String(stats.cardsBlocked + stats.cardsFrozen)],
        [t("common.status"), String(stats.transactions)],
        [t("admin.failed"), String(stats.failed)],
        [t("admin.pending"), String(stats.pending)],
        [t("admin.requests"), String(stats.openRequests)],
        [t("admin.integrations"), String(stats.integrationIssues)],
        [t("admin.volume"), formatMoney(stats.volume, "SDG", lang)],
      ]
    : [];

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl">{t("adminNav.dashboard")}</h1>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value]) => (
          <Panel key={label}>
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-2 font-serif text-3xl">{value}</p>
          </Panel>
        ))}
      </div>
      <div>
        <h2 className="mb-3 font-serif text-2xl">{t("admin.approvals")}</h2>
        <div className="space-y-3">
          {approvals.map((item) => (
            <Panel key={item.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{item.type}</p>
                <p className="text-sm text-muted">{item.requestedByName} · {item.payload.reference || item.payload.toRole || item.payload.role || item.remarks}</p>
                <p className="text-xs text-muted">{formatWhen(item.createdAt, lang)}</p>
              </div>
              <Can permission={item.type === "reversal" ? "transactions.reverse.approve" : "users.role.approve"}>
                <div className="flex gap-2">
                  <Button onClick={() => decide(item.id, "approved")}>{t("common.approve")}</Button>
                  <Button variant="ghost" onClick={() => decide(item.id, "rejected")}>{t("common.reject")}</Button>
                </div>
              </Can>
            </Panel>
          ))}
          {!approvals.length ? <p className="text-sm text-muted">{t("common.empty")}</p> : null}
        </div>
      </div>
    </div>
  );
}
