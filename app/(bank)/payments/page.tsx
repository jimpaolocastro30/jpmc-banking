"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/customer-shell";
import { useErrorText, useI18n } from "@/components/i18n";
import { TxRow } from "@/components/tx-row";
import { Button, Field, Panel, Select } from "@/components/ui";
import { api } from "@/lib/client";
import type { AccountView, TxView } from "@/lib/types";

type Biller = { id: string; name: string; referenceLabel: string; fee: number };
type Provider = { id: string; name: string; prefixes: string[]; amounts: number[]; fee: number };

function Payments() {
  const params = useSearchParams();
  const initial = params.get("tab") === "topup" ? "topup" : params.get("tab") === "history" ? "history" : "bills";
  const { t } = useI18n();
  const errorText = useErrorText();
  const [tab, setTab] = useState<"bills" | "topup" | "history">(initial);
  const [accounts, setAccounts] = useState<AccountView[]>([]);
  const [billers, setBillers] = useState<Biller[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [history, setHistory] = useState<TxView[]>([]);
  const [sourceAccountId, setSource] = useState("");
  const [billerId, setBiller] = useState("");
  const [providerId, setProvider] = useState("");
  const [referenceNumber, setReference] = useState("");
  const [mobile, setMobile] = useState("");
  const [amount, setAmount] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<AccountView[]>("/api/customer/accounts").then((rows) => {
      setAccounts(rows);
      setSource(rows[0]?.id ?? "");
    });
    api<Biller[]>("/api/customer/billers").then((rows) => {
      setBillers(rows);
      setBiller(rows[0]?.id ?? "");
    });
    api<Provider[]>("/api/customer/providers").then((rows) => {
      setProviders(rows);
      setProvider(rows[0]?.id ?? "");
      setAmount(String(rows[0]?.amounts[0] ?? ""));
    });
  }, []);

  useEffect(() => {
    if (tab === "history") api<TxView[]>("/api/customer/payments").then(setHistory).catch(() => setHistory([]));
  }, [tab]);

  const provider = providers.find((item) => item.id === providerId);
  const biller = billers.find((item) => item.id === billerId);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const tx = await api<TxView>(tab === "bills" ? "/api/customer/payments" : "/api/customer/topup", {
        method: "POST",
        body: JSON.stringify(
          tab === "bills"
            ? { billerId, referenceNumber, amount: Number(amount), sourceAccountId, password, idempotencyKey: crypto.randomUUID() }
            : { providerId, mobile, amount: Number(amount), sourceAccountId, password, idempotencyKey: crypto.randomUUID() },
        ),
      });
      setMessage(`${tx.reference} · ${tx.status}`);
      setPassword("");
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <div>
      <PageHeader title={t("pay.title")} />
      <div className="space-y-4 px-5">
        <div className="grid grid-cols-3 gap-2">
          {(["bills", "topup", "history"] as const).map((item) => (
            <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-2xl px-2 py-3 text-xs font-semibold ${tab === item ? "bg-forest text-white" : "bg-white"}`}>
              {t(`pay.${item}`)}
            </button>
          ))}
        </div>
        {tab === "history" ? (
          <Panel>{history.map((tx) => <TxRow key={tx.id} tx={tx} />)}</Panel>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Select label={t("transfer.source")} value={sourceAccountId} onChange={(event) => setSource(event.target.value)}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name} · {account.maskedNumber}</option>
              ))}
            </Select>
            {tab === "bills" ? (
              <>
                <Select label={t("pay.biller")} value={billerId} onChange={(event) => setBiller(event.target.value)}>
                  {billers.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </Select>
                <Field label={biller?.referenceLabel || t("pay.reference")} value={referenceNumber} onChange={(event) => setReference(event.target.value)} />
                <Field label={t("common.amount")} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </>
            ) : (
              <>
                <Select label={t("pay.provider")} value={providerId} onChange={(event) => {
                  setProvider(event.target.value);
                  const next = providers.find((item) => item.id === event.target.value);
                  setAmount(String(next?.amounts[0] ?? ""));
                }}>
                  {providers.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </Select>
                <Field label={t("pay.mobile")} value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder={provider?.prefixes[0]} />
                <Select label={t("pay.chooseAmount")} value={amount} onChange={(event) => setAmount(event.target.value)}>
                  {provider?.amounts.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </Select>
              </>
            )}
            <Field label={t("common.password")} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {message ? <p className="text-sm text-ok">{message}</p> : null}
            <Button className="w-full">{t("common.confirm")}</Button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense>
      <Payments />
    </Suspense>
  );
}
