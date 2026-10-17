"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader, useCustomer } from "@/components/customer-shell";
import { useI18n } from "@/components/i18n";
import { TxRow } from "@/components/tx-row";
import { Empty, Field, Panel, Select } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/format";
import type { AccountView, TxView } from "@/lib/types";

const presets = ["7", "30", "90", "all", "custom"] as const;

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useI18n();
  const { me } = useCustomer();
  const [account, setAccount] = useState<AccountView | null>(null);
  const [rows, setRows] = useState<TxView[]>([]);
  const [preset, setPreset] = useState<(typeof presets)[number]>("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    api<AccountView>(`/api/customer/accounts/${id}`).then(setAccount).catch(() => setAccount(null));
  }, [id]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    if (preset === "custom") {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    } else if (preset !== "all") {
      const start = new Date();
      start.setDate(start.getDate() - Number(preset));
      params.set("from", start.toISOString().slice(0, 10));
    }
    api<TxView[]>(`/api/customer/accounts/${id}/transactions?${params.toString()}`)
      .then(setRows)
      .catch(() => setRows([]));
  }, [id, preset, from, to, type, status]);

  return (
    <div>
      <PageHeader title={account?.name ?? t("accounts.detail")} back="/accounts" />
      <div className="space-y-4 px-5">
        <Panel>
          <p className="text-sm text-muted">{account?.maskedNumber}</p>
          <p className="mt-2 text-sm text-muted">{t("common.available")}</p>
          <p className="font-serif text-4xl">{formatMoney(account?.availableBalance, account?.currency, lang, me?.hideBalance)}</p>
          <p className="mt-3 text-sm text-muted">
            {t("common.ledger")} · {formatMoney(account?.ledgerBalance, account?.currency, lang, me?.hideBalance)}
          </p>
        </Panel>
        <div className="flex flex-wrap gap-2">
          {presets.map((item) => (
            <button key={item} type="button" onClick={() => setPreset(item)} className={`rounded-full px-3 py-1 text-xs font-semibold ${preset === item ? "bg-forest text-white" : "bg-white"}`}>
              {item === "all" ? t("common.all") : item === "custom" ? t("accounts.custom") : t(`accounts.days${item}`)}
            </button>
          ))}
        </div>
        {preset === "custom" ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("common.from")} type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <Field label={t("common.to")} type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Select label={t("accounts.type")} value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">{t("common.all")}</option>
            {["transfer_own", "transfer_internal", "transfer_external", "bill_payment", "topup", "incoming", "reversal"].map((item) => (
              <option key={item} value={item}>{t(`txType.${item}`)}</option>
            ))}
          </Select>
          <Select label={t("common.status")} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">{t("common.all")}</option>
            {["successful", "pending", "failed", "rejected", "reversed"].map((item) => (
              <option key={item} value={item}>{t(`status.${item}`)}</option>
            ))}
          </Select>
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold">{t("accounts.history")}</p>
          <Panel>{rows.length ? rows.map((tx) => <TxRow key={tx.id} tx={tx} />) : <Empty text={t("common.empty")} />}</Panel>
        </div>
      </div>
    </div>
  );
}
