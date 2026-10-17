"use client";

import { useEffect, useState } from "react";
import { useErrorText, useI18n } from "@/components/i18n";
import { Button, Field, Panel, Select, StatusPill } from "@/components/ui";
import { api } from "@/lib/client";

type User = { id: string; fullName: string; email: string; role: string; status: string };
const roles = ["support", "operations", "administrator", "security_admin"] as const;

export default function UsersPage() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const [rows, setRows] = useState<User[]>([]);
  const [fullName, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Bankak#2026");
  const [role, setRole] = useState<(typeof roles)[number]>("support");
  const [secret, setSecret] = useState("");
  const [temporary, setTemporary] = useState("");
  const [error, setError] = useState("");

  function load() {
    api<User[]>("/api/admin/users").then(setRows);
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">{t("adminNav.users")}</h1>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        try {
          const created = await api<{ totpSecret: string }>("/api/admin/users", { method: "POST", body: JSON.stringify({ fullName, email, password, role }) });
          setSecret(created.totpSecret);
          setName("");
          setEmail("");
          load();
        } catch (caught) {
          setError(errorText(caught));
        }
      }}>
        <Field label={t("profile.name")} value={fullName} onChange={(event) => setName(event.target.value)} required />
        <Field label={t("profile.email")} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <Field label={t("common.password")} value={password} onChange={(event) => setPassword(event.target.value)} />
        <Select label={t("admin.role")} value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
          {roles.map((item) => <option key={item} value={item}>{t(`roles.${item}`)}</option>)}
        </Select>
        <Button className="md:col-span-2">{t("admin.createUser")}</Button>
      </form>
      {secret ? <p className="text-sm">{t("admin.totp")}: {secret}</p> : null}
      {temporary ? <p className="text-sm">{t("admin.tempPassword")}: {temporary}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {rows.map((user) => (
        <Panel key={user.id} className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{user.fullName}</p>
              <p className="text-sm text-muted">{user.email} · {t(`roles.${user.role}`)}</p>
            </div>
            <StatusPill value={user.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select label={t("admin.role")} value={user.role} onChange={async (event) => {
              await api(`/api/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ role: event.target.value }) });
              load();
            }}>
              {roles.map((item) => <option key={item} value={item}>{t(`roles.${item}`)}</option>)}
            </Select>
            <Button variant="ghost" onClick={() => api(`/api/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ status: user.status === "active" ? "suspended" : "active" }) }).then(load)}>
              {user.status === "active" ? t("admin.suspend") : t("admin.reactivate")}
            </Button>
            <Button variant="gold" onClick={async () => {
              const result = await api<{ temporaryPassword?: string }>(`/api/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ resetPassword: true }) });
              setTemporary(result.temporaryPassword ?? "");
            }}>{t("admin.reset")}</Button>
          </div>
        </Panel>
      ))}
    </div>
  );
}
