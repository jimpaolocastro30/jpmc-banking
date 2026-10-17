"use client";

import { useEffect, useState } from "react";
import { PageHeader, useCustomer } from "@/components/customer-shell";
import { useErrorText, useI18n } from "@/components/i18n";
import { Button, Field, Panel } from "@/components/ui";
import { api } from "@/lib/client";
import type { NotificationPrefs } from "@/lib/types";

const prefKeys: (keyof NotificationPrefs)[] = ["inApp", "push", "sms", "email", "transactions", "security", "cards", "announcements"];

export default function ProfilePage() {
  const { t, setLang } = useI18n();
  const errorText = useErrorText();
  const { me, refresh } = useCustomer();
  const [fullName, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!me) return;
    setName(me.fullName);
    setEmail(me.email);
    setMobile(me.mobile);
    setPrefs(me.notificationPrefs);
  }, [me]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const language = me?.language ?? "en";
      await api("/api/customer/profile", { method: "PATCH", body: JSON.stringify({ fullName, language, notificationPrefs: prefs }) });
      setLang(language);
      await refresh();
      setMessage(t("common.save"));
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  async function saveContact(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/customer/profile/sensitive", { method: "POST", body: JSON.stringify({ email, mobile, password }) });
      setPassword("");
      await refresh();
      setMessage(t("common.save"));
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  async function changeLanguage(language: "en" | "fil") {
    await api("/api/customer/profile", { method: "PATCH", body: JSON.stringify({ language }) });
    setLang(language);
    await refresh();
  }

  return (
    <div>
      <PageHeader title={t("profile.title")} back="/more" />
      <div className="space-y-4 px-5">
        <div className="flex gap-2">
          <Button type="button" variant={me?.language === "en" ? "primary" : "ghost"} onClick={() => changeLanguage("en")}>{t("common.english")}</Button>
          <Button type="button" variant={me?.language === "fil" ? "primary" : "ghost"} onClick={() => changeLanguage("fil")}>{t("common.filipino")}</Button>
        </div>
        <form onSubmit={saveProfile} className="space-y-3">
          <Field label={t("profile.name")} value={fullName} onChange={(event) => setName(event.target.value)} />
          {prefs ? (
            <Panel className="space-y-2">
              <p className="text-sm font-semibold">{t("notes.prefs")}</p>
              {prefKeys.map((key) => (
                <label key={key} className="flex items-center justify-between text-sm">
                  <span>{key}</span>
                  <input type="checkbox" checked={prefs[key]} onChange={(event) => setPrefs({ ...prefs, [key]: event.target.checked })} />
                </label>
              ))}
            </Panel>
          ) : null}
          <Button>{t("common.save")}</Button>
        </form>
        <form onSubmit={saveContact} className="space-y-3">
          <p className="text-sm text-muted">{t("profile.sensitive")}</p>
          <Field label={t("profile.email")} value={email} onChange={(event) => setEmail(event.target.value)} />
          <Field label={t("profile.mobile")} value={mobile} onChange={(event) => setMobile(event.target.value)} />
          <Field label={t("common.password")} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <Button variant="gold">{t("common.confirm")}</Button>
        </form>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {message ? <p className="text-sm text-ok">{message}</p> : null}
      </div>
    </div>
  );
}
