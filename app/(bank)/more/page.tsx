"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/customer-shell";
import { useI18n } from "@/components/i18n";
import { Button, Panel } from "@/components/ui";
import { api } from "@/lib/client";

const links = [
  ["/profile", "more.profile"],
  ["/cards", "more.cards"],
  ["/notifications", "more.notifications"],
  ["/requests", "more.requests"],
  ["/activity", "more.activity"],
];

export default function MorePage() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <div>
      <PageHeader title={t("more.title")} />
      <div className="space-y-3 px-5">
        {links.map(([href, key]) => (
          <Link key={href} href={href} className="block">
            <Panel className="font-semibold">{t(key)}</Panel>
          </Link>
        ))}
        <Button
          variant="ghost"
          onClick={async () => {
            await api("/api/auth/customer/logout", { method: "POST" });
            router.push("/login");
          }}
        >
          {t("common.signOut")}
        </Button>
      </div>
    </div>
  );
}
