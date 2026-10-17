import { Settings, type SettingsDoc } from "@/lib/models";

export async function getSettings() {
  const existing = await Settings.findOne({ key: "default" });
  if (existing) return existing;
  return Settings.create({ key: "default" });
}

export type BankSettings = SettingsDoc;
