"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Can } from "@/components/admin-shell";
import { useErrorText, useI18n } from "@/components/i18n";
import { TxRow } from "@/components/tx-row";
import { Button, Field, Panel, StatusPill } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/format";
import type { AccountView, CardView, RequestView, TxView } from "@/lib/types";

type Detail = {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  status: string;
  notes: { text: string; authorName: string }[];
  accounts: AccountView[];
  cards: CardView[];
  transactions: TxView[];
  requests: RequestView[];
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useI18n();
  const errorText = useErrorText();
  const [customer, setCustomer] = useState<Detail | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function load() {
    api<Detail>(`/api/admin/customers/${id}`).then(setCustomer);
  }
  useEffect(() => {
    load();
  }, [id]);

  async function setStatus(status: "active" | "inactive") {
    setError("");
    try {
      await api(`/api/admin/customers/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      load();
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  if (!customer) return <p>{t("common.loading")}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl">{customer.fullName}</h1>
          <p className="text-muted">{customer.email} · {customer.mobile}</p>
        </div>
        <StatusPill value={customer.status} />
      </div>
      <Can permission="customers.status">
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setStatus("inactive")}>{t("admin.deactivate")}</Button>
          <Button onClick={() => setStatus("active")}>{t("admin.activate")}</Button>
        </div>
      </Can>
      <div className="grid gap-3 md:grid-cols-2">
        {customer.accounts.map((account) => (
          <Panel key={account.id}>
            <p className="font-semibold">{account.name} · {account.maskedNumber}</p>
            <p>{formatMoney(account.availableBalance, account.currency, lang)}</p>
            <StatusPill value={account.status} />
          </Panel>
        ))}
        {customer.cards.map((card) => (
          <Panel key={card.id}>
            <p>{card.maskedNumber}</p>
            <StatusPill value={card.status} />
          </Panel>
        ))}
      </div>
      <Panel>{customer.transactions.map((tx) => <TxRow key={tx.id} tx={tx} href={null} />)}</Panel>
      <Can permission="customers.note">
        <form className="flex gap-2" onSubmit={async (event) => {
          event.preventDefault();
          await api(`/api/admin/customers/${id}/notes`, { method: "POST", body: JSON.stringify({ text: note }) });
          setNote("");
          load();
        }}>
          <div className="flex-1"><Field label={t("admin.note")} value={note} onChange={(event) => setNote(event.target.value)} /></div>
          <Button className="self-end">{t("common.save")}</Button>
        </form>
      </Can>
      <div className="space-y-2">
        {customer.notes.map((item, index) => (
          <p key={index} className="text-sm"><span className="font-semibold">{item.authorName}: </span>{item.text}</p>
        ))}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
