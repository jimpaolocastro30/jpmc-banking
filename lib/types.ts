export type Lang = "en" | "fil";

export type NotificationPrefs = {
  inApp: boolean;
  push: boolean;
  sms: boolean;
  email: boolean;
  transactions: boolean;
  security: boolean;
  cards: boolean;
  announcements: boolean;
};

export type CustomerProfile = {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  language: Lang;
  status: string;
  hideBalance: boolean;
  notificationPrefs: NotificationPrefs;
  currency: string;
  unread: number;
};

export type StaffProfile = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  language: Lang;
  permissions: string[];
  currency: string;
  sessionTimeoutMinutes: number;
};

export type AccountView = {
  id: string;
  customerId?: string;
  customerName?: string;
  name: string;
  maskedNumber: string;
  type: string;
  availableBalance: number | null;
  ledgerBalance: number | null;
  currency: string;
  status: string;
  dailyTransferLimit?: number | null;
};

export type TxView = {
  id: string;
  reference: string;
  type: string;
  direction: "debit" | "credit";
  amount: number;
  fee: number;
  total: number;
  currency: string;
  status: string;
  description: string;
  descriptionFil: string;
  sourceLabel: string;
  counterparty: string;
  remarks: string;
  failureReason: string;
  createdAt: string;
  accountId: string;
  operationalRemarks?: { text: string; actorName: string; at: string }[];
};

export type CardView = {
  id: string;
  accountId: string;
  customerName?: string;
  maskedNumber: string;
  holderName: string;
  expiry: string;
  type: string;
  status: string;
  balance: number;
  limits: { dailySpend: number; atm: number; pos: number; online: number };
  controls: { online: boolean; atm: boolean; pos: boolean; international: boolean };
};

export type RequestView = {
  id: string;
  reference: string;
  customerId?: string;
  customerName?: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  assignedOfficerName: string;
  history: { status: string; remarks: string; officerName: string; at: string }[];
  createdAt: string;
};
