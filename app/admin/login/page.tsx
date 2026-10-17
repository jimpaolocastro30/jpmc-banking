"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useErrorText, useI18n } from "@/components/i18n";
import { Button, Field, LanguageSwitch } from "@/components/ui";
import { api } from "@/lib/client";

export default function AdminLoginPage() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [email, setEmail] = useState("admin@bankak.demo");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      if (!mfaToken) {
        const result = await api<{ mfaToken: string }>("/api/auth/admin/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setMfaToken(result.mfaToken);
      } else {
        await api("/api/auth/admin/mfa", { method: "POST", body: JSON.stringify({ mfaToken, code }) });
        router.push("/admin/dashboard");
      }
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-6 flex justify-between">
        <p className="font-serif text-3xl">Bankak</p>
        <LanguageSwitch />
      </div>
      <h1 className="font-serif text-4xl">{t("login.adminTitle")}</h1>
      <p className="mt-2 text-muted">{t("login.adminSubtitle")}</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        {!mfaToken ? (
          <>
            <Field label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            <Field label={t("common.password")} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </>
        ) : (
          <Field label={t("login.code")} inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} />
        )}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button className="w-full" disabled={pending}>{mfaToken ? t("login.verify") : t("common.continue")}</Button>
      </form>
      <p className="mt-6 text-xs text-muted">Demo authenticator secret: JBSWY3DPEHPK3PXP</p>
    </main>
  );
}
