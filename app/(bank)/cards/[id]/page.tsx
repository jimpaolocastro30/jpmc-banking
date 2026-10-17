"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/customer-shell";
import { useErrorText, useI18n } from "@/components/i18n";
import { Button, Field, Panel, Select, StatusPill } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/format";
import type { CardView } from "@/lib/types";

export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useI18n();
  const errorText = useErrorText();
  const [card, setCard] = useState<CardView | null>(null);
  const [password, setPassword] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [limits, setLimits] = useState({ dailySpend: "", atm: "", pos: "", online: "" });
  const [requestType, setRequestType] = useState<"new_card" | "replacement_card" | "card_activation">("replacement_card");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function load() {
    api<CardView>(`/api/customer/cards/${id}`).then((next) => {
      setCard(next);
      setLimits({
        dailySpend: String(next.limits.dailySpend),
        atm: String(next.limits.atm),
        pos: String(next.limits.pos),
        online: String(next.limits.online),
      });
    });
  }

  useEffect(() => {
    load();
  }, [id]);

  async function run(work: () => Promise<unknown>) {
    setError("");
    setMessage("");
    try {
      await work();
      setMessage(t("common.save"));
      setPassword("");
      load();
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  if (!card) return <p className="p-6 text-sm text-muted">{t("common.loading")}</p>;

  return (
    <div>
      <PageHeader title={t("cards.detail")} back="/cards" />
      <div className="space-y-4 px-5 pb-8">
        <Panel className="bg-forest text-sand">
          <div className="flex justify-between"><span>{card.holderName}</span><StatusPill value={card.status} /></div>
          <p className="mt-6 font-serif text-2xl">{card.maskedNumber}</p>
          <p className="mt-4">{formatMoney(card.balance, "SDG", lang)} · {card.expiry}</p>
        </Panel>
        <Field label={t("common.password")} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant="ghost" onClick={() => run(() => api(`/api/customer/cards/${id}/status`, { method: "POST", body: JSON.stringify({ action: "freeze", password }) }))}>{t("cards.freeze")}</Button>
          <Button type="button" variant="ghost" onClick={() => run(() => api(`/api/customer/cards/${id}/status`, { method: "POST", body: JSON.stringify({ action: "unfreeze", password }) }))}>{t("cards.unfreeze")}</Button>
          <Button type="button" variant="danger" onClick={() => run(() => api(`/api/customer/cards/${id}/status`, { method: "POST", body: JSON.stringify({ action: "block", password }) }))}>{t("cards.block")}</Button>
        </div>
        <Panel className="space-y-3">
          <p className="font-semibold">{t("cards.pin")}</p>
          <Field label={t("cards.currentPin")} inputMode="numeric" maxLength={4} value={currentPin} onChange={(event) => setCurrentPin(event.target.value)} />
          <Field label={t("cards.newPin")} inputMode="numeric" maxLength={4} value={newPin} onChange={(event) => setNewPin(event.target.value)} />
          <Button type="button" onClick={() => run(() => api(`/api/customer/cards/${id}/pin`, { method: "POST", body: JSON.stringify({ currentPin, newPin, password }) }))}>{t("common.save")}</Button>
        </Panel>
        <Panel className="space-y-3">
          <p className="font-semibold">{t("cards.controls")}</p>
          {(["online", "atm", "pos", "international"] as const).map((key) => (
            <label key={key} className="flex items-center justify-between text-sm">
              <span>{t(`cards.${key}`)}</span>
              <input
                type="checkbox"
                checked={card.controls[key]}
                onChange={(event) => {
                  const controls = { ...card.controls, [key]: event.target.checked };
                  setCard({ ...card, controls });
                }}
              />
            </label>
          ))}
          <Button type="button" variant="ghost" onClick={() => run(() => api(`/api/customer/cards/${id}/controls`, { method: "POST", body: JSON.stringify({ ...card.controls, password }) }))}>{t("common.save")}</Button>
        </Panel>
        <Panel className="space-y-3">
          <p className="font-semibold">{t("cards.limits")}</p>
          {(["dailySpend", "atm", "pos", "online"] as const).map((key) => (
            <Field key={key} label={key} value={limits[key]} onChange={(event) => setLimits({ ...limits, [key]: event.target.value })} />
          ))}
          <Button type="button" onClick={() => run(() => api(`/api/customer/cards/${id}/limits`, { method: "POST", body: JSON.stringify({ dailySpend: Number(limits.dailySpend), atm: Number(limits.atm), pos: Number(limits.pos), online: Number(limits.online), password }) }))}>{t("cards.requestLimit")}</Button>
        </Panel>
        <Panel className="space-y-3">
          <p className="font-semibold">{t("cards.requests")}</p>
          <Select label={t("accounts.type")} value={requestType} onChange={(event) => setRequestType(event.target.value as typeof requestType)}>
            <option value="new_card">{t("cards.new")}</option>
            <option value="replacement_card">{t("cards.replacement")}</option>
            <option value="card_activation">{t("cards.activation")}</option>
          </Select>
          <Field label={t("cards.note")} value={note} onChange={(event) => setNote(event.target.value)} />
          <Button type="button" variant="gold" onClick={() => run(() => api("/api/customer/requests", { method: "POST", body: JSON.stringify({ type: requestType, cardId: id, note, password }) }))}>{t("common.submit")}</Button>
        </Panel>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {message ? <p className="text-sm text-ok">{message}</p> : null}
      </div>
    </div>
  );
}
