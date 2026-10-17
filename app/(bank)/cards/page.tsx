"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/customer-shell";
import { useI18n } from "@/components/i18n";
import { Panel, StatusPill } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/format";
import type { CardView } from "@/lib/types";

export default function CardsPage() {
  const { t, lang } = useI18n();
  const [cards, setCards] = useState<CardView[]>([]);

  useEffect(() => {
    api<CardView[]>("/api/customer/cards").then(setCards).catch(() => setCards([]));
  }, []);

  return (
    <div>
      <PageHeader title={t("cards.title")} />
      <div className="space-y-3 px-5">
        <p className="text-sm text-muted">{t("cards.masked")}</p>
        {cards.map((card) => (
          <Link key={card.id} href={`/cards/${card.id}`}>
            <Panel className="bg-forest text-sand">
              <div className="flex items-start justify-between">
                <p className="text-xs uppercase tracking-[0.18em] text-gold">{card.type}</p>
                <StatusPill value={card.status} />
              </div>
              <p className="mt-8 font-serif text-2xl tracking-wide">{card.maskedNumber}</p>
              <div className="mt-6 flex items-end justify-between text-sm">
                <span>{card.holderName}</span>
                <span>{card.expiry}</span>
              </div>
              <p className="mt-3 text-sm text-gold-2">{formatMoney(card.balance, "SDG", lang)}</p>
            </Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}
