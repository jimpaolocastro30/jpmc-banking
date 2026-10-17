"use client";

import { useEffect, useState } from "react";
import { Can } from "@/components/admin-shell";
import { useI18n } from "@/components/i18n";
import { Button, Field, Panel, StatusPill } from "@/components/ui";
import { api } from "@/lib/client";
import type { CardView } from "@/lib/types";

export default function AdminCardsPage() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CardView[]>([]);

  function load(query = q) {
    api<CardView[]>(`/api/admin/cards?q=${encodeURIComponent(query)}`).then(setRows);
  }
  useEffect(() => {
    load("");
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">{t("adminNav.cards")}</h1>
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <div className="flex-1"><Field label={t("common.search")} value={q} onChange={(event) => setQ(event.target.value)} /></div>
        <Button className="self-end">{t("common.search")}</Button>
      </form>
      {rows.map((card) => (
        <Panel key={card.id} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{card.customerName} · {card.holderName}</p>
            <p>{card.maskedNumber} · {card.expiry}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill value={card.status} />
            <Can permission="cards.status">
              {(["active", "frozen", "blocked"] as const).map((status) => (
                <Button key={status} variant="ghost" onClick={() => api(`/api/admin/cards/${card.id}`, { method: "PATCH", body: JSON.stringify({ status }) }).then(() => load())}>
                  {t(`status.${status}`)}
                </Button>
              ))}
            </Can>
          </div>
        </Panel>
      ))}
    </div>
  );
}
