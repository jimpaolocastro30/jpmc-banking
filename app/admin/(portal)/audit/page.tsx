"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n";
import { Button, Field, Panel, StatusPill } from "@/components/ui";
import { api } from "@/lib/client";
import { formatWhen } from "@/lib/format";

type Row = { id: string; actorName: string; actorRole: string; action: string; result: string; remarks: string; reference: string; createdAt: string };

export default function AuditPage() {
  const { t, lang } = useI18n();
  const [action, setAction] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  function load(value = action) {
    api<Row[]>(`/api/admin/audit?action=${encodeURIComponent(value)}`).then(setRows);
  }
  useEffect(() => {
    load("");
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">{t("adminNav.audit")}</h1>
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <div className="flex-1"><Field label={t("common.search")} value={action} onChange={(event) => setAction(event.target.value)} /></div>
        <Button className="self-end">{t("common.search")}</Button>
      </form>
      {rows.map((row) => (
        <Panel key={row.id}>
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">{row.action}</p>
            <StatusPill value={row.result === "success" ? "successful" : "failed"} />
          </div>
          <p className="text-sm">{row.actorName} · {row.actorRole}</p>
          <p className="text-sm text-muted">{row.reference || row.remarks}</p>
          <p className="text-xs text-muted">{formatWhen(row.createdAt, lang)}</p>
        </Panel>
      ))}
    </div>
  );
}
