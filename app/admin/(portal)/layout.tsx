import { Suspense } from "react";
import { AdminShell } from "@/components/admin-shell";

export const instant = false;

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-ink/50">Bankak</div>}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
