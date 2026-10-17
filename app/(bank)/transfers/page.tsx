"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/customer-shell";
import { useErrorText, useI18n } from "@/components/i18n";
import { Button, Field, Panel, Select, StatusPill } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/format";
import type { AccountView, TxView } from "@/lib/types";

type Kind = "own" | "internal" | "external";
type Preview = { amount: number; fee: number; total: number; currency: string; counterparty: string; sourceMasked: string };
type Beneficiary = { id: string; name: string; bankName: string; type: string; maskedNumber: string };

export default function TransfersPage() {
  const { t, lang } = useI18n();
  const errorText = useErrorText();
  const [accounts, setAccounts] = useState<AccountView[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [step, setStep] = useState<"form" | "review" | "done">("form");
  const [kind, setKind] = useState<Kind>("own");
  const [sourceAccountId, setSource] = useState("");
  const [destinationAccountId, setDestination] = useState("");
  const [beneficiaryId, setBeneficiary] = useState("");
  const [destinationAccountNumber, setNumber] = useState("");
  const [destinationName, setName] = useState("");
  const [bankName, setBank] = useState("");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saveBeneficiary, setSave] = useState(false);
  const [password, setPassword] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [idempotencyKey, setKey] = useState("");
  const [result, setResult] = useState<TxView | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api<AccountView[]>("/api/customer/accounts").then((rows) => {
      setAccounts(rows);
      setSource(rows[0]?.id ?? "");
      setDestination(rows[1]?.id ?? "");
    });
    api<Beneficiary[]>("/api/customer/beneficiaries").then(setBeneficiaries).catch(() => setBeneficiaries([]));
  }, []);

  function payload() {
    return {
      type: kind,
      sourceAccountId,
      destinationAccountId: kind === "own" ? destinationAccountId : undefined,
      beneficiaryId: beneficiaryId || undefined,
      destinationAccountNumber,
      destinationName,
      bankName,
      amount: Number(amount),
      remarks,
      saveBeneficiary,
    };
  }

  async function review(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const next = await api<Preview>("/api/customer/transfers/preview", { method: "POST", body: JSON.stringify(payload()) });
      setPreview(next);
      setKey(crypto.randomUUID());
      setStep("review");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  async function confirm() {
    setPending(true);
    setError("");
    try {
      const tx = await api<TxView>("/api/customer/transfers", {
        method: "POST",
        body: JSON.stringify({ ...payload(), password, idempotencyKey }),
      });
      setResult(tx);
      setStep("done");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <PageHeader title={t("transfer.title")} />
      <div className="space-y-4 px-5">
        {step === "form" ? (
          <form onSubmit={review} className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {(["own", "internal", "external"] as const).map((item) => (
                <button key={item} type="button" onClick={() => setKind(item)} className={`rounded-2xl px-2 py-3 text-xs font-semibold ${kind === item ? "bg-forest text-white" : "bg-white"}`}>
                  {t(`transfer.${item}`)}
                </button>
              ))}
            </div>
            <Select label={t("transfer.source")} value={sourceAccountId} onChange={(event) => setSource(event.target.value)}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name} · {account.maskedNumber}</option>
              ))}
            </Select>
            {kind === "own" ? (
              <Select label={t("transfer.destination")} value={destinationAccountId} onChange={(event) => setDestination(event.target.value)}>
                {accounts.filter((account) => account.id !== sourceAccountId).map((account) => (
                  <option key={account.id} value={account.id}>{account.name} · {account.maskedNumber}</option>
                ))}
              </Select>
            ) : (
              <>
                <Select label={t("transfer.destination")} value={beneficiaryId} onChange={(event) => setBeneficiary(event.target.value)}>
                  <option value="">{t("common.all")}</option>
                  {beneficiaries.filter((item) => item.type === kind).map((item) => (
                    <option key={item.id} value={item.id}>{item.name} · {item.maskedNumber}</option>
                  ))}
                </Select>
                <Field label={t("transfer.accountNumber")} value={destinationAccountNumber} onChange={(event) => setNumber(event.target.value)} />
                {kind === "external" ? (
                  <>
                    <Field label={t("transfer.name")} value={destinationName} onChange={(event) => setName(event.target.value)} />
                    <Field label={t("transfer.bank")} value={bankName} onChange={(event) => setBank(event.target.value)} />
                  </>
                ) : null}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={saveBeneficiary} onChange={(event) => setSave(event.target.checked)} />
                  {t("transfer.save")}
                </label>
              </>
            )}
            <Field label={t("common.amount")} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required />
            <Field label={t("common.remarks")} value={remarks} onChange={(event) => setRemarks(event.target.value)} />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button className="w-full" disabled={pending}>{t("common.continue")}</Button>
          </form>
        ) : null}
        {step === "review" && preview ? (
          <Panel className="space-y-3">
            <p className="font-serif text-2xl">{t("transfer.review")}</p>
            <p className="text-sm">{preview.sourceMasked}</p>
            <p className="text-sm">{preview.counterparty}</p>
            <p>{t("common.amount")}: {formatMoney(preview.amount, preview.currency, lang)}</p>
            <p>{t("common.fee")}: {formatMoney(preview.fee, preview.currency, lang)}</p>
            <p className="font-semibold">{t("common.total")}: {formatMoney(preview.total, preview.currency, lang)}</p>
            <Field label={t("transfer.password")} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" type="button" onClick={() => setStep("form")}>{t("common.back")}</Button>
              <Button type="button" disabled={pending || password.length < 8} onClick={confirm}>{t("common.confirm")}</Button>
            </div>
          </Panel>
        ) : null}
        {step === "done" && result ? (
          <Panel className="space-y-3 text-center">
            <StatusPill value={result.status} />
            <p className="font-serif text-3xl">{t("transfer.done")}</p>
            <p className="text-sm">{result.reference}</p>
            <p>{formatMoney(result.amount, result.currency, lang)}</p>
            <Button type="button" onClick={() => { setStep("form"); setPassword(""); setResult(null); }}>{t("transfer.another")}</Button>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
