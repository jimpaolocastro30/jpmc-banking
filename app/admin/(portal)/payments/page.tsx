"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n";
import { Button, Field, Panel, Select } from "@/components/ui";
import { api } from "@/lib/client";

type Biller = { id: string; name: string; category: string; referenceLabel: string; fee: number; enabled: boolean; integrationStatus: "healthy" | "degraded" | "down" };
type Provider = { id: string; name: string; prefixes: string[]; amounts: number[]; fee: number; enabled: boolean; integrationStatus: "healthy" | "degraded" | "down" };

export default function BillersPage() {
  const { t } = useI18n();
  const [billers, setBillers] = useState<Biller[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Utilities");
  const [referenceLabel, setReference] = useState("Account number");
  const [fee, setFee] = useState("0");
  const [providerName, setProviderName] = useState("");
  const [prefixes, setPrefixes] = useState("091");
  const [amounts, setAmounts] = useState("500,1000,2000");

  function load() {
    api<Biller[]>("/api/admin/billers").then(setBillers);
    api<Provider[]>("/api/admin/providers").then(setProviders);
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl">{t("adminNav.payments")}</h1>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={async (event) => {
        event.preventDefault();
        await api("/api/admin/billers", { method: "POST", body: JSON.stringify({ name, category, referenceLabel, fee: Number(fee), enabled: true, integrationStatus: "healthy" }) });
        setName("");
        load();
      }}>
        <Field label={t("pay.biller")} value={name} onChange={(event) => setName(event.target.value)} required />
        <Field label={t("accounts.type")} value={category} onChange={(event) => setCategory(event.target.value)} />
        <Field label={t("pay.reference")} value={referenceLabel} onChange={(event) => setReference(event.target.value)} />
        <Field label={t("common.fee")} value={fee} onChange={(event) => setFee(event.target.value)} />
        <Button className="md:col-span-2">{t("admin.addBiller")}</Button>
      </form>
      {billers.map((biller) => (
        <Panel key={biller.id} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{biller.name}</p>
            <p className="text-sm text-muted">{biller.category} · {biller.integrationStatus} · {biller.fee}</p>
          </div>
          <Button variant="ghost" onClick={() => api("/api/admin/billers", { method: "POST", body: JSON.stringify({ ...biller, enabled: !biller.enabled }) }).then(load)}>
            {biller.enabled ? t("admin.deactivate") : t("admin.activate")}
          </Button>
        </Panel>
      ))}
      <form className="grid gap-3 md:grid-cols-2" onSubmit={async (event) => {
        event.preventDefault();
        await api("/api/admin/providers", {
          method: "POST",
          body: JSON.stringify({
            name: providerName,
            prefixes: prefixes.split(",").map((item) => item.trim()),
            amounts: amounts.split(",").map((item) => Number(item.trim())),
            fee: 0,
            enabled: true,
            integrationStatus: "healthy",
          }),
        });
        setProviderName("");
        load();
      }}>
        <Field label={t("pay.provider")} value={providerName} onChange={(event) => setProviderName(event.target.value)} required />
        <Field label="Prefixes" value={prefixes} onChange={(event) => setPrefixes(event.target.value)} />
        <Field label={t("common.amount")} value={amounts} onChange={(event) => setAmounts(event.target.value)} />
        <Select label={t("common.status")} value="healthy" onChange={() => undefined}>
          <option value="healthy">healthy</option>
        </Select>
        <Button className="md:col-span-2">{t("admin.addProvider")}</Button>
      </form>
      {providers.map((provider) => (
        <Panel key={provider.id}>
          <p className="font-semibold">{provider.name}</p>
          <p className="text-sm text-muted">{provider.prefixes.join(", ")} · {provider.integrationStatus}</p>
        </Panel>
      ))}
    </div>
  );
}
