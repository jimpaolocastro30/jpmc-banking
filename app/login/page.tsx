"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useErrorText, useI18n } from "@/components/i18n";
import { Button, Field, LanguageSwitch } from "@/components/ui";
import { api } from "@/lib/client";

export default function LoginPage() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("amal.hassan@bankak.demo");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await api("/api/auth/customer/login", { method: "POST", body: JSON.stringify({ identifier, password }) });
      router.push("/home");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-sand lg:grid lg:grid-cols-[380px_1fr]">
      <aside className="hidden bg-forest p-10 text-sand lg:block">
        <p className="font-serif text-5xl text-gold">Bankak</p>
      </aside>
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <p className="font-serif text-3xl lg:hidden">Bankak</p>
          <LanguageSwitch />
        </div>
        <h1 className="font-serif text-4xl">{t("login.welcome")}</h1>
        <p className="mt-2 text-muted">{t("login.subtitle")}</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <Field label={t("login.identifier")} value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" />
          <Field label={t("common.password")} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button className="w-full" disabled={pending}>
            {pending ? t("common.loading") : t("common.signIn")}
          </Button>
        </form>
      </div>
    </main>
  );
}
