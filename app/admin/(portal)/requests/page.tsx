"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n";
import { Button, Panel, Select, StatusPill } from "@/components/ui";
import { api } from "@/lib/client";
import { formatWhen } from "@/lib/format";
import type { RequestView } from "@/lib/types";

const statuses = ["submitted", "under_review", "approved", "rejected", "completed", "cancelled"] as const;

export default function RequestsPage() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<RequestView[]>([]);
  const [filter, setFilter] = useState("");

  function load(status = filter) {
    api<RequestView[]>(`/api/admin/requests${status ? `?status=${status}` : ""}`).then(setRows);
  }
  useEffect(() => {
    load("");
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">{t("adminNav.requests")}</h1>
      <Select label={t("common.status")} value={filter} onChange={(event) => { setFilter(event.target.value); load(event.target.value); }}>
        <option value="">{t("common.all")}</option>
        {statuses.map((status) => <option key={status} value={status}>{t(`status.${status}`)}</option>)}
      </Select>
      {rows.map((row) => (
        <Panel key={row.id} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{row.customerName} · {t(`requestType.${row.type}`)}</p>
              <p className="text-sm text-muted">{row.reference} · {formatWhen(row.createdAt, lang)}</p>
            </div>
            <StatusPill value={row.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <Button key={status} variant="ghost" onClick={() => api(`/api/admin/requests/${row.id}`, { method: "PATCH", body: JSON.stringify({ status, remarks: status }) }).then(() => load())}>
                {t(`status.${status}`)}
              </Button>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}
