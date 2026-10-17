"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/customer-shell";
import { useI18n } from "@/components/i18n";
import { Panel, StatusPill } from "@/components/ui";
import { api } from "@/lib/client";
import { formatWhen } from "@/lib/format";
import type { RequestView } from "@/lib/types";

export default function RequestsPage() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<RequestView[]>([]);
  useEffect(() => {
    api<RequestView[]>("/api/customer/requests").then(setRows).catch(() => setRows([]));
  }, []);
  return (
    <div>
      <PageHeader title={t("more.requests")} back="/more" />
      <div className="space-y-3 px-5">
        {rows.map((row) => (
          <Panel key={row.id}>
            <div className="flex items-center justify-between">
              <p className="font-semibold">{t(`requestType.${row.type}`)}</p>
              <StatusPill value={row.status} />
            </div>
            <p className="mt-2 text-sm">{row.reference}</p>
            <p className="text-xs text-muted">{formatWhen(row.createdAt, lang)}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
