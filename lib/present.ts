import { maskAccount, maskCard } from "@/lib/money";
import type { AccountDoc, CardDoc } from "@/lib/models";

export function presentAccount(account: AccountDoc, revealBalance: boolean) {
  return {
    id: account._id.toString(),
    customerId: account.customerId.toString(),
    name: account.name,
    maskedNumber: maskAccount(account.accountNumber),
    type: account.type,
    availableBalance: revealBalance ? account.availableBalance : null,
    ledgerBalance: revealBalance ? account.ledgerBalance : null,
    currency: account.currency,
    status: account.status,
    dailyTransferLimit: revealBalance ? account.dailyTransferLimit : null,
  };
}

export function presentCard(card: CardDoc, balance: number) {
  return {
    id: card._id.toString(),
    customerId: card.customerId.toString(),
    accountId: card.accountId.toString(),
    maskedNumber: maskCard(card.pan),
    holderName: card.holderName,
    expiry: card.expiry,
    type: card.type,
    status: card.status,
    balance,
    limits: card.limits,
    controls: card.controls,
    statusHistory: card.statusHistory ?? [],
  };
}

type TxLike = {
  _id: { toString(): string };
  reference: string;
  type: string;
  direction: string;
  amount: number;
  fee?: number;
  currency: string;
  status: string;
  description: string;
  descriptionFil?: string;
  sourceLabel?: string;
  counterparty?: string;
  remarks?: string;
  failureReason?: string;
  createdAt?: Date;
  operationalRemarks?: { text: string; actorName: string; at: Date }[];
  accountId: { toString(): string };
};

export function presentTransaction(tx: TxLike) {
  return {
    id: tx._id.toString(),
    reference: tx.reference,
    type: tx.type,
    direction: tx.direction,
    amount: tx.amount,
    fee: tx.fee ?? 0,
    total: tx.direction === "debit" ? Math.round((tx.amount + (tx.fee ?? 0)) * 100) / 100 : tx.amount,
    currency: tx.currency,
    status: tx.status,
    description: tx.description,
    descriptionFil: tx.descriptionFil || tx.description,
    sourceLabel: tx.sourceLabel ?? "",
    counterparty: tx.counterparty ?? "",
    remarks: tx.remarks ?? "",
    failureReason: tx.failureReason ?? "",
    createdAt: tx.createdAt,
    operationalRemarks: tx.operationalRemarks ?? [],
    accountId: tx.accountId.toString(),
  };
}
