"use client";

import { useEffect, useState } from "react";
import { Can } from "@/components/admin-shell";
import { useErrorText, useI18n } from "@/components/i18n";
import { Button, Field } from "@/components/ui";
import { api } from "@/lib/client";

type Settings = {
  currency: string;
  transferFeeInternal: number;
  transferFeeExternal: number;
  dailyTransferLimit: number;
  maxCardLimit: number;
  sessionTimeoutMinutes: number;
  maxFailedLogins: number;
  lockoutMinutes: number;
};

export default function SettingsPage() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Settings>("/api/admin/settings").then(setSettings).catch((caught) => setError(errorText(caught)));
  }, [errorText]);

  async function save(patch: Partial<Settings>) {
    setError("");
    try {
      const next = await api<Settings>("/api/admin/settings", { method: "PATCH", body: JSON.stringify(patch) });
      setSettings({
        currency: next.currency,
        transferFeeInternal: next.transferFeeInternal,
        transferFeeExternal: next.transferFeeExternal,
        dailyTransferLimit: next.dailyTransferLimit,
        maxCardLimit: next.maxCardLimit,
        sessionTimeoutMinutes: next.sessionTimeoutMinutes,
        maxFailedLogins: next.maxFailedLogins,
        lockoutMinutes: next.lockoutMinutes,
      });
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  if (!settings) return <p>{error || t("common.loading")}</p>;

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl">{t("adminNav.settings")}</h1>
      <Can permission="settings.manage">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); save({ currency: settings.currency, transferFeeInternal: Number(settings.transferFeeInternal), transferFeeExternal: Number(settings.transferFeeExternal), dailyTransferLimit: Number(settings.dailyTransferLimit), maxCardLimit: Number(settings.maxCardLimit) }); }}>
          <h2 className="md:col-span-2 font-serif text-2xl">{t("admin.fees")}</h2>
          <Field label={t("admin.currency")} value={settings.currency} onChange={(event) => setSettings({ ...settings, currency: event.target.value.toUpperCase() })} />
          <Field label={t("admin.internalFee")} value={settings.transferFeeInternal} onChange={(event) => setSettings({ ...settings, transferFeeInternal: Number(event.target.value) })} />
          <Field label={t("admin.externalFee")} value={settings.transferFeeExternal} onChange={(event) => setSettings({ ...settings, transferFeeExternal: Number(event.target.value) })} />
          <Field label={t("admin.dailyLimit")} value={settings.dailyTransferLimit} onChange={(event) => setSettings({ ...settings, dailyTransferLimit: Number(event.target.value) })} />
          <Field label={t("admin.cardLimit")} value={settings.maxCardLimit} onChange={(event) => setSettings({ ...settings, maxCardLimit: Number(event.target.value) })} />
          <Button className="md:col-span-2">{t("common.save")}</Button>
        </form>
        <form className="grid gap-3" onSubmit={async (event) => {
          event.preventDefault();
          await api("/api/admin/announcements", { method: "POST", body: JSON.stringify({ title, body }) });
          setTitle("");
          setBody("");
        }}>
          <h2 className="font-serif text-2xl">{t("admin.announcement")}</h2>
          <Field label={t("admin.announcement")} value={title} onChange={(event) => setTitle(event.target.value)} />
          <Field label={t("common.remarks")} value={body} onChange={(event) => setBody(event.target.value)} />
          <Button>{t("common.submit")}</Button>
        </form>
      </Can>
      <Can permission="settings.security">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); save({ sessionTimeoutMinutes: Number(settings.sessionTimeoutMinutes), maxFailedLogins: Number(settings.maxFailedLogins), lockoutMinutes: Number(settings.lockoutMinutes) }); }}>
          <h2 className="md:col-span-2 font-serif text-2xl">{t("admin.security")}</h2>
          <Field label={t("admin.session")} value={settings.sessionTimeoutMinutes} onChange={(event) => setSettings({ ...settings, sessionTimeoutMinutes: Number(event.target.value) })} />
          <Field label={t("admin.attempts")} value={settings.maxFailedLogins} onChange={(event) => setSettings({ ...settings, maxFailedLogins: Number(event.target.value) })} />
          <Field label={t("admin.lockout")} value={settings.lockoutMinutes} onChange={(event) => setSettings({ ...settings, lockoutMinutes: Number(event.target.value) })} />
          <Button className="md:col-span-2">{t("common.save")}</Button>
        </form>
      </Can>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
