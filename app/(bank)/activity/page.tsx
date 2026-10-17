"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/customer-shell";
import { useI18n } from "@/components/i18n";
import { Panel, StatusPill } from "@/components/ui";
import { api } from "@/lib/client";
import { formatWhen } from "@/lib/format";

type Activity = { id: string; action: string; result: string; remarks: string; reference: string; createdAt: string };

export default function ActivityPage() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<Activity[]>([]);
  useEffect(() => {
    api<Activity[]>("/api/customer/activity").then(setRows).catch(() => setRows([]));
  }, []);
  return (
    <div>
      <PageHeader title={t("more.activity")} back="/more" />
      <div className="space-y-3 px-5">
        {rows.map((row) => (
          <Panel key={row.id}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{row.action}</p>
              <StatusPill value={row.result === "success" ? "successful" : "failed"} />
            </div>
            <p className="mt-1 text-sm text-muted">{row.reference || row.remarks}</p>
            <p className="text-xs text-muted">{formatWhen(row.createdAt, lang)}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
