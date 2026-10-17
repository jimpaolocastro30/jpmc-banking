"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/customer-shell";
import { useI18n } from "@/components/i18n";
import { Button, Panel } from "@/components/ui";
import { api } from "@/lib/client";
import { formatWhen } from "@/lib/format";

type Note = { id: string; category: string; title: string; titleFil: string; body: string; bodyFil: string; read: boolean; createdAt: string };

export default function NotificationsPage() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<Note[]>([]);

  function load() {
    api<Note[]>("/api/customer/notifications").then(setRows).catch(() => setRows([]));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader
        title={t("notes.title")}
        back="/more"
        action={<Button variant="ghost" className="px-3 py-2" onClick={async () => { await api("/api/customer/notifications/read", { method: "POST", body: JSON.stringify({}) }); load(); }}>{t("notes.markRead")}</Button>}
      />
      <div className="space-y-3 px-5">
        {rows.map((row) => (
          <Panel key={row.id} className={row.read ? "opacity-70" : ""}>
            <p className="font-semibold">{lang === "fil" ? row.titleFil : row.title}</p>
            <p className="mt-1 text-sm">{lang === "fil" ? row.bodyFil : row.body}</p>
            <p className="mt-2 text-xs text-muted">{formatWhen(row.createdAt, lang)}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
