import { Suspense } from "react";
import { CustomerShell } from "@/components/customer-shell";

export const instant = false;

export default function BankLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-ink/50">Bankak</div>}>
      <CustomerShell>{children}</CustomerShell>
    </Suspense>
  );
}
