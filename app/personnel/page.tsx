"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useErrorText, useI18n } from "@/components/i18n";
import { Button, Field, LanguageSwitch } from "@/components/ui";
import { api } from "@/lib/client";

const roles = [
  { role: "support", email: "support@bankak.demo" },
  { role: "operations", email: "operations@bankak.demo" },
  { role: "administrator", email: "admin@bankak.demo" },
  { role: "security_admin", email: "security@bankak.demo" },
] as const;

export default function PersonnelLoginPage() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [email, setEmail] = useState(roles[0].email);
  const [password, setPassword] = useState("Bankak#2026");
  const [mfaToken, setMfaToken] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await api<{ code: string }>("/api/auth/admin/demo-code");
        if (active) setDemoCode(result.code);
      } catch {
        if (active) setDemoCode("");
      }
    }
    load();
    const timer = window.setInterval(load, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

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
        if (demoCode) setCode(demoCode);
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
    <main className="min-h-dvh bg-forest text-sand">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-6 py-10">
        <div className="mb-8 flex items-center justify-between gap-3">
          <p className="text-3xl font-semibold tracking-tight text-white">Bankak</p>
          <LanguageSwitch />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{t("login.personnelTitle")}</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{t("login.adminTitle")}</h1>
        <p className="mt-2 text-sand/70">{t("login.adminSubtitle")}</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          {!mfaToken ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {roles.map((item) => (
                  <button
                    key={item.email}
                    type="button"
                    onClick={() => setEmail(item.email)}
                    className={`rounded-xl px-3 py-3 text-left text-sm font-semibold ${email === item.email ? "bg-white text-forest" : "bg-white/10 text-sand"}`}
                  >
                    {t(`roles.${item.role}`)}
                  </button>
                ))}
              </div>
              <Field label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <Field label={t("common.password")} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
              <p className="text-xs text-sand/60">{t("login.demoPassword")}: Bankak#2026</p>
            </>
          ) : (
            <>
              <Field label={t("login.code")} inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" />
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm">
                <div>
                  <p className="text-xs text-sand/60">{t("login.demoCode")}</p>
                  <p className="font-serif text-2xl tracking-[0.2em]">{demoCode || "······"}</p>
                </div>
                <button type="button" className="text-sm font-semibold text-gold" onClick={() => setCode(demoCode)}>
                  {t("login.useCode")}
                </button>
              </div>
            </>
          )}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button className="w-full" variant="gold" disabled={pending}>
            {pending ? t("common.loading") : mfaToken ? t("login.verify") : t("common.continue")}
          </Button>
        </form>
        <Link href="/login" className="mt-6 text-sm font-semibold text-gold">
          {t("login.userSignIn")}
        </Link>
      </div>
    </main>
  );
}
