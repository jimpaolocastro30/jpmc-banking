export function MobileFrame({
  children,
  footer,
  tone = "sand",
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  tone?: "sand" | "forest";
}) {
  const surface = tone === "forest" ? "bg-forest text-sand" : "bg-sand text-ink";
  return (
    <div className="min-h-dvh bg-[#cfc6b4] md:grid md:h-dvh md:place-items-center md:overflow-hidden">
      <div
        className={`mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden ${surface} md:h-[min(900px,calc(100dvh-2.5rem))] md:rounded-[2rem] md:shadow-[0_24px_70px_rgba(20,36,28,0.22)] md:ring-1 md:ring-black/10`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pt-[env(safe-area-inset-top)]">{children}</div>
        {footer}
      </div>
    </div>
  );
}
