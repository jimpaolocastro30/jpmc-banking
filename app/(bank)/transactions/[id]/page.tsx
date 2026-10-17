"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/customer-shell";
import { useI18n } from "@/components/i18n";
import { Panel, StatusPill } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney, formatWhen } from "@/lib/format";
import type { TxView } from "@/lib/types";

export default function TransactionPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useI18n();
  const [tx, setTx] = useState<TxView | null>(null);

  useEffect(() => {
    api<TxView>(`/api/customer/transactions/${id}`).then(setTx).catch(() => setTx(null));
  }, [id]);

  if (!tx) return <p className="p-6 text-sm text-muted">{t("common.loading")}</p>;
  const title = lang === "fil" ? tx.descriptionFil : tx.description;

  return (
    <div>
      <PageHeader title={t("receipt.title")} back="/accounts" />
      <div className="space-y-4 px-5">
        <Panel className="text-center">
          <StatusPill value={tx.status} />
          <p className="mt-4 font-serif text-4xl">
            {tx.direction === "credit" ? "+" : "−"}
            {formatMoney(tx.amount, tx.currency, lang)}
          </p>
          <p className="mt-2">{title}</p>
          <p className="text-sm text-muted">{formatWhen(tx.createdAt, lang)}</p>
        </Panel>
        <Panel className="space-y-3 text-sm">
          <Row label={t("common.reference")} value={tx.reference} />
          <Row label={t("accounts.type")} value={t(`txType.${tx.type}`)} />
          <Row label={t("common.from")} value={tx.sourceLabel} />
          <Row label={t("receipt.counterparty")} value={tx.counterparty} />
          <Row label={t("common.fee")} value={formatMoney(tx.fee, tx.currency, lang)} />
          <Row label={t("common.total")} value={formatMoney(tx.total, tx.currency, lang)} />
          {tx.remarks ? <Row label={t("common.remarks")} value={tx.remarks} /> : null}
          {tx.failureReason ? <Row label={t("common.status")} value={t(`errors.${tx.failureReason}`) === `errors.${tx.failureReason}` ? tx.failureReason : t(`errors.${tx.failureReason}`)} /> : null}
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
