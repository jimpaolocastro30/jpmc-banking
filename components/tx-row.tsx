"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n";
import { StatusPill } from "@/components/ui";
import { formatMoney, formatWhen } from "@/lib/format";
import type { TxView } from "@/lib/types";

export function TxRow({ tx, href }: { tx: TxView; href?: string | null }) {
  const { lang, t } = useI18n();
  const title = lang === "fil" ? tx.descriptionFil : tx.description;
  const className = "flex items-center justify-between gap-3 border-b border-sand-2/80 py-3 last:border-0";
  const body = (
    <>
      <div className="min-w-0">
        <p className="truncate font-medium">{title}</p>
        <p className="text-xs text-muted">{formatWhen(tx.createdAt, lang)} · {t(`txType.${tx.type}`)}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={tx.direction === "credit" ? "font-semibold text-ok" : "font-semibold"}>
          {tx.direction === "credit" ? "+" : "−"}
          {formatMoney(tx.amount, tx.currency, lang)}
        </p>
        <StatusPill value={tx.status} />
      </div>
    </>
  );
  if (href === null) return <div className={className}>{body}</div>;
  return (
    <Link href={href ?? `/transactions/${tx.id}`} className={className}>
      {body}
    </Link>
  );
}
