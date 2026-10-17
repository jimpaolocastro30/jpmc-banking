"use client";

import { useEffect, useState } from "react";
import { Can } from "@/components/admin-shell";
import { useErrorText, useI18n } from "@/components/i18n";
import { Button, Field, Panel, Select, StatusPill } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney, formatWhen } from "@/lib/format";
import type { TxView } from "@/lib/types";

export default function AdminTransactionsPage() {
  const { t, lang } = useI18n();
  const errorText = useErrorText();
  const [rows, setRows] = useState<TxView[]>([]);
  const [reference, setReference] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [minAmount, setMin] = useState("");
  const [maxAmount, setMax] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  function load() {
    const params = new URLSearchParams();
    if (reference) params.set("reference", reference);
    if (status) params.set("status", status);
    if (type) params.set("type", type);
    if (minAmount) params.set("minAmount", minAmount);
    if (maxAmount) params.set("maxAmount", maxAmount);
    api<TxView[]>(`/api/admin/transactions?${params.toString()}`).then(setRows);
  }
  useEffect(() => {
    load();
  }, []);

  async function act(id: string, path: string, body: object) {
    setError("");
    try {
      await api(`/api/admin/transactions/${id}/${path}`, { method: "POST", body: JSON.stringify(body) });
      load();
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">{t("adminNav.transactions")}</h1>
      <form className="grid gap-3 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <Field label={t("common.reference")} value={reference} onChange={(event) => setReference(event.target.value)} />
        <Select label={t("common.status")} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">{t("common.all")}</option>
          {["successful", "pending", "failed", "rejected", "reversed"].map((item) => <option key={item} value={item}>{t(`status.${item}`)}</option>)}
        </Select>
        <Select label={t("accounts.type")} value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">{t("common.all")}</option>
          {["transfer_own", "transfer_internal", "transfer_external", "bill_payment", "topup", "incoming", "reversal"].map((item) => <option key={item} value={item}>{t(`txType.${item}`)}</option>)}
        </Select>
        <Field label={t("common.from")} value={minAmount} onChange={(event) => setMin(event.target.value)} placeholder="0" />
        <Field label={t("common.to")} value={maxAmount} onChange={(event) => setMax(event.target.value)} />
        <Button className="self-end">{t("common.search")}</Button>
      </form>
      <Field label={t("admin.reason")} value={reason} onChange={(event) => setReason(event.target.value)} />
      {rows.map((tx) => (
        <Panel key={tx.id} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{tx.reference}</p>
              <p className="text-sm text-muted">{lang === "fil" ? tx.descriptionFil : tx.description}</p>
              <p className="text-xs text-muted">{formatWhen(tx.createdAt, lang)} · {tx.counterparty}</p>
            </div>
            <div className="text-right">
              <p className="font-serif text-2xl">{formatMoney(tx.amount, tx.currency, lang)}</p>
              <StatusPill value={tx.status} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Can permission="transactions.operate">
              <Button variant="ghost" onClick={() => act(tx.id, "remark", { text: reason || "Reviewed" })}>{t("common.remarks")}</Button>
              {tx.status === "failed" ? <Button variant="ghost" onClick={() => act(tx.id, "retry", { remarks: reason })}>{t("admin.retry")}</Button> : null}
              {tx.status === "pending" ? (
                <>
                  <Button onClick={() => act(tx.id, "resolve", { outcome: "successful", remarks: reason })}>{t("admin.settle")}</Button>
                  <Button variant="danger" onClick={() => act(tx.id, "resolve", { outcome: "failed", remarks: reason })}>{t("admin.fail")}</Button>
                </>
              ) : null}
            </Can>
            <Can permission="transactions.reverse.request">
              {tx.status === "successful" && tx.direction === "debit" && tx.type !== "reversal" ? (
                <Button variant="gold" onClick={() => act(tx.id, "reversal", { reason: reason || "Customer request" })}>{t("admin.reverse")}</Button>
              ) : null}
            </Can>
          </div>
        </Panel>
      ))}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
