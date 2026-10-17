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
    <div className="min-h-dvh bg-[#e4e9f0] md:grid md:h-dvh md:place-items-center md:overflow-hidden">
      <div
        className={`mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden ${surface} md:h-[min(900px,calc(100dvh-2.5rem))] md:rounded-3xl md:shadow-[0_18px_50px_rgba(14,39,68,0.16)] md:ring-1 md:ring-forest/10`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pt-[env(safe-area-inset-top)]">{children}</div>
        {footer}
      </div>
    </div>
  );
}
