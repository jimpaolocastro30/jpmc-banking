"use client";

import { useEffect, useState } from "react";
import { Can, useStaff } from "@/components/admin-shell";
import { useErrorText, useI18n } from "@/components/i18n";
import { Button, Field, Panel, StatusPill } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/format";
import type { AccountView } from "@/lib/types";

export default function AdminAccountsPage() {
  const { t, lang } = useI18n();
  const errorText = useErrorText();
  const { me } = useStaff();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AccountView[]>([]);
  const [error, setError] = useState("");

  function load(query = q) {
    api<AccountView[]>(`/api/admin/accounts?q=${encodeURIComponent(query)}`).then(setRows);
  }
  useEffect(() => {
    load("");
  }, []);

  async function update(id: string, status: "active" | "inactive") {
    setError("");
    try {
      await api(`/api/admin/accounts/${id}`, { method: "PATCH", body: JSON.stringify({ status, remarks: status }) });
      load();
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">{t("adminNav.accounts")}</h1>
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <div className="flex-1"><Field label={t("common.search")} value={q} onChange={(event) => setQ(event.target.value)} /></div>
        <Button className="self-end">{t("common.search")}</Button>
      </form>
      {rows.map((row) => (
        <Panel key={row.id} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{row.customerName} · {row.name}</p>
            <p className="text-sm text-muted">{row.maskedNumber}</p>
            <p>{formatMoney(row.availableBalance, row.currency, lang)} / {formatMoney(row.ledgerBalance, row.currency, lang)}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill value={row.status} />
            <Can permission="accounts.status">
              <Button variant="ghost" onClick={() => update(row.id, row.status === "active" ? "inactive" : "active")}>
                {me?.role === "operations" ? t("admin.requestStatus") : row.status === "active" ? t("admin.deactivate") : t("admin.activate")}
              </Button>
            </Can>
          </div>
        </Panel>
      ))}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
