export function formatMoney(amount: number | null | undefined, currency = "SDG", lang = "en", hidden = false) {
  if (hidden || amount == null) return "••••••";
  return new Intl.NumberFormat(lang === "fil" ? "fil-PH" : "en-GB", {
    style: "currency",
    currency,
    currencyDisplay: "code",
  }).format(amount);
}

export function formatWhen(value?: string | Date | null, lang = "en") {
  if (!value) return "";
  return new Intl.DateTimeFormat(lang === "fil" ? "fil-PH" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
