"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n";
import { Button, Field, Panel, StatusPill } from "@/components/ui";
import { api } from "@/lib/client";

type Row = { id: string; fullName: string; email: string; mobile: string; status: string };

export default function CustomersPage() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  function load(query = q) {
    api<Row[]>(`/api/admin/customers?q=${encodeURIComponent(query)}`).then(setRows);
  }
  useEffect(() => {
    load("");
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">{t("adminNav.customers")}</h1>
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <div className="flex-1"><Field label={t("common.search")} value={q} onChange={(event) => setQ(event.target.value)} /></div>
        <Button className="self-end">{t("common.search")}</Button>
      </form>
      <div className="space-y-2">
        {rows.map((row) => (
          <Link key={row.id} href={`/admin/customers/${row.id}`}>
            <Panel className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{row.fullName}</p>
                <p className="text-sm text-muted">{row.email} · {row.mobile}</p>
              </div>
              <StatusPill value={row.status} />
            </Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}
