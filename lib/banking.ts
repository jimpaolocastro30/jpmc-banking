import { compare } from "bcryptjs";
import { Types, type HydratedDocument, type Types as MongooseTypes } from "mongoose";
import { assertPassword, hashSecret } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { HttpError, isDuplicateKey } from "@/lib/errors";
import { makeReference, maskAccount, roundMoney } from "@/lib/money";
import {
  Account,
  Beneficiary,
  Biller,
  Card,
  Customer,
  Notification,
  Provider,
  ServiceRequest,
  Transaction,
  type AccountDoc,
  type CustomerDoc,
} from "@/lib/models";
import { presentAccount, presentCard, presentTransaction } from "@/lib/present";
import { getSettings } from "@/lib/settings";

type CustomerRecord = HydratedDocument<CustomerDoc>;

type Oid = MongooseTypes.ObjectId;

const TX_TYPES = [
  "transfer_own",
  "transfer_internal",
  "transfer_external",
  "bill_payment",
  "topup",
  "reversal",
  "incoming",
] as const;

const TX_STATUSES = ["initiated", "processing", "successful", "pending", "failed", "rejected", "reversed"] as const;

export type TransferType = "own" | "internal" | "external";

export type TransferInput = {
  type: TransferType;
  sourceAccountId: string;
  destinationAccountId?: string;
  beneficiaryId?: string;
  destinationAccountNumber?: string;
  destinationName?: string;
  bankName?: string;
  amount: number;
  remarks?: string;
  saveBeneficiary?: boolean;
};

function oid(value: string) {
  if (!Types.ObjectId.isValid(value)) throw new HttpError(400, "VALIDATION");
  return new Types.ObjectId(value);
}

async function ownAccount(customerId: Oid, accountId: string) {
  const account = await Account.findOne({ _id: oid(accountId), customerId });
  if (!account) throw new HttpError(404, "NOT_FOUND");
  return account;
}

async function ownCard(customerId: Oid, cardId: string) {
  const card = await Card.findOne({ _id: oid(cardId), customerId });
  if (!card) throw new HttpError(404, "NOT_FOUND");
  return card;
}

async function notify(
  customer: CustomerRecord,
  category: "transaction" | "payment" | "card" | "security" | "request" | "announcement",
  title: string,
  titleFil: string,
  body: string,
  bodyFil: string,
) {
  const prefs = customer.notificationPrefs;
  if (!prefs?.inApp) return;
  const allowed =
    category === "transaction" || category === "payment"
      ? prefs.transactions
      : category === "card"
        ? prefs.cards
        : category === "security"
          ? prefs.security
          : category === "announcement"
            ? prefs.announcements
            : true;
  if (!allowed) return;
  await Notification.create({
    customerId: customer._id,
    category,
    title,
    titleFil,
    body,
    bodyFil,
    read: false,
  });
}

async function assertDailyLimit(customerId: Oid, accountLimit: number, extra: number) {
  const config = await getSettings();
  const limit = Math.min(accountLimit, config.dailyTransferLimit);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [row] = await Transaction.aggregate<{ total: number }>([
    {
      $match: {
        customerId,
        direction: "debit",
        status: { $in: ["successful", "pending", "processing"] },
        createdAt: { $gte: start },
        type: { $in: ["transfer_own", "transfer_internal", "transfer_external", "bill_payment", "topup"] },
      },
    },
    { $group: { _id: null, total: { $sum: { $add: ["$amount", "$fee"] } } } },
  ]);
  if (roundMoney((row?.total ?? 0) + extra) > limit) throw new HttpError(400, "LIMIT_EXCEEDED");
}

async function cardBalance(accountId: Oid) {
  const account = await Account.findById(accountId);
  return account?.availableBalance ?? 0;
}

export async function dashboard(customer: CustomerRecord) {
  const accounts = await Account.find({ customerId: customer._id }).sort({ type: 1 });
  const recent = await Transaction.find({ customerId: customer._id }).sort({ createdAt: -1 }).limit(6);
  const unread = await Notification.countDocuments({ customerId: customer._id, read: false });
  return {
    accounts: accounts.map((account) => presentAccount(account, true)),
    recent: recent.map((tx) => presentTransaction(tx)),
    unread,
  };
}

export async function listAccounts(customerId: Oid) {
  const accounts = await Account.find({ customerId }).sort({ name: 1 });
  return accounts.map((account) => presentAccount(account, true));
}

export async function getAccount(customerId: Oid, accountId: string) {
  const account = await ownAccount(customerId, accountId);
  return presentAccount(account, true);
}

export async function listTransactions(
  customerId: Oid,
  query: { accountId?: string; type?: string; status?: string; from?: Date; to?: Date; paymentsOnly?: boolean },
) {
  const filter: Record<string, unknown> = { customerId };
  if (query.accountId) {
    await ownAccount(customerId, query.accountId);
    filter.accountId = oid(query.accountId);
  }
  if (query.paymentsOnly) filter.type = { $in: ["bill_payment", "topup"] };
  if (query.type) {
    if (!TX_TYPES.includes(query.type as (typeof TX_TYPES)[number])) throw new HttpError(400, "VALIDATION");
    filter.type = query.type;
  }
  if (query.status) {
    if (!TX_STATUSES.includes(query.status as (typeof TX_STATUSES)[number])) throw new HttpError(400, "VALIDATION");
    filter.status = query.status;
  }
  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }
  const rows = await Transaction.find(filter).sort({ createdAt: -1 }).limit(100);
  return rows.map((tx) => presentTransaction(tx));
}

export async function getTransaction(customerId: Oid, transactionId: string) {
  const tx = await Transaction.findOne({ _id: oid(transactionId), customerId });
  if (!tx) throw new HttpError(404, "NOT_FOUND");
  return presentTransaction(tx);
}

async function resolveTransfer(customer: CustomerRecord, input: TransferInput) {
  const source = await ownAccount(customer._id, input.sourceAccountId);
  if (source.status !== "active") throw new HttpError(400, "ACCOUNT_INACTIVE");
  const amount = roundMoney(input.amount);
  if (!(amount > 0)) throw new HttpError(400, "INVALID_AMOUNT");
  const config = await getSettings();

  let destinationNumber = (input.destinationAccountNumber ?? "").replace(/\s/g, "");
  let destinationName = (input.destinationName ?? "").trim();
  let bankName = (input.bankName ?? "").trim();
  if (input.beneficiaryId && input.type !== "own") {
    const beneficiary = await Beneficiary.findOne({ _id: oid(input.beneficiaryId), customerId: customer._id });
    if (!beneficiary) throw new HttpError(404, "NOT_FOUND");
    if (beneficiary.type === "external" && input.type !== "external") throw new HttpError(400, "VALIDATION");
    if (beneficiary.type === "internal" && input.type !== "internal") throw new HttpError(400, "VALIDATION");
    destinationNumber = beneficiary.accountNumber;
    destinationName = beneficiary.name;
    bankName = beneficiary.bankName;
  }

  let destAccount: AccountDoc | null = null;
  let fee = 0;
  let counterparty = "";
  if (input.type === "own") {
    if (!input.destinationAccountId) throw new HttpError(400, "VALIDATION");
    const owned = await ownAccount(customer._id, input.destinationAccountId);
    destAccount = owned;
    if (owned._id.equals(source._id)) throw new HttpError(400, "SAME_ACCOUNT");
    if (owned.status !== "active") throw new HttpError(400, "ACCOUNT_INACTIVE");
    counterparty = `${owned.name} · ${maskAccount(owned.accountNumber)}`;
  } else if (input.type === "internal") {
    const internal = await Account.findOne({ accountNumber: destinationNumber });
    if (!internal) throw new HttpError(400, "INVALID_RECIPIENT");
    destAccount = internal;
    if (internal.customerId.equals(customer._id)) throw new HttpError(400, "OWN_ACCOUNT");
    if (internal.status !== "active") throw new HttpError(400, "ACCOUNT_INACTIVE");
    const owner = await Customer.findById(internal.customerId);
    counterparty = `${owner?.fullName ?? "Customer"} · ${maskAccount(internal.accountNumber)}`;
    fee = config.transferFeeInternal;
  } else {
    if (destinationNumber.length < 8 || !destinationName || !bankName) throw new HttpError(400, "VALIDATION");
    counterparty = `${destinationName} · ${bankName} · ${maskAccount(destinationNumber)}`;
    fee = config.transferFeeExternal;
  }

  fee = roundMoney(fee);
  const remarks = input.remarks?.trim() ?? "";
  const description = remarks || `Transfer to ${counterparty}`;
  const descriptionFil = remarks || `Transfer kay ${counterparty}`;
  return {
    source,
    destAccount,
    amount,
    fee,
    total: roundMoney(amount + fee),
    counterparty,
    description,
    descriptionFil,
    destinationNumber,
    destinationName,
    bankName,
  };
}

export async function previewTransfer(customer: CustomerRecord, input: TransferInput) {
  const resolved = await resolveTransfer(customer, input);
  return {
    amount: resolved.amount,
    fee: resolved.fee,
    total: resolved.total,
    currency: resolved.source.currency,
    counterparty: resolved.counterparty,
    sourceMasked: `${resolved.source.name} · ${maskAccount(resolved.source.accountNumber)}`,
  };
}

export async function executeTransfer(customer: CustomerRecord, input: TransferInput, password: string, idempotencyKey: string) {
  await assertPassword(customer.passwordHash, password);
  if (idempotencyKey.trim().length < 8) throw new HttpError(400, "VALIDATION");
  const existing = await Transaction.findOne({ idempotencyKey });
  if (existing) {
    if (!existing.customerId.equals(customer._id)) throw new HttpError(409, "IDEMPOTENCY_CONFLICT");
    return presentTransaction(existing);
  }

  const resolved = await resolveTransfer(customer, input);
  await assertDailyLimit(customer._id, resolved.source.dailyTransferLimit, resolved.total);
  const type = input.type === "own" ? "transfer_own" : input.type === "internal" ? "transfer_internal" : "transfer_external";
  const groupId = makeReference("G");

  let tx;
  try {
    tx = await Transaction.create({
      reference: makeReference("BK"),
      groupId,
      idempotencyKey,
      customerId: customer._id,
      accountId: resolved.source._id,
      type,
      direction: "debit",
      amount: resolved.amount,
      fee: resolved.fee,
      currency: resolved.source.currency,
      status: "processing",
      description: resolved.description,
      descriptionFil: resolved.descriptionFil,
      sourceLabel: `${resolved.source.name} · ${maskAccount(resolved.source.accountNumber)}`,
      counterparty: resolved.counterparty,
      remarks: input.remarks?.trim() ?? "",
      debited: false,
    });
  } catch (error) {
    if (isDuplicateKey(error)) {
      const again = await Transaction.findOne({ idempotencyKey });
      if (again) return presentTransaction(again);
    }
    throw error;
  }

  const debit = await Account.updateOne(
    { _id: resolved.source._id, status: "active", availableBalance: { $gte: resolved.total } },
    { $inc: { availableBalance: -resolved.total, ledgerBalance: -resolved.total } },
  );
  if (debit.modifiedCount !== 1) {
    tx.status = "failed";
    tx.failureReason = "INSUFFICIENT_FUNDS";
    await tx.save();
    await notify(customer, "transaction", "Transfer failed", "Nabigo ang transfer", tx.reference, tx.reference);
    await writeAudit({
      actorType: "customer",
      actorId: customer._id.toString(),
      actorName: customer.fullName,
      actorRole: "customer",
      action: "transfer.create",
      targetType: "transaction",
      targetId: tx._id.toString(),
      result: "failure",
      reference: tx.reference,
      remarks: "INSUFFICIENT_FUNDS",
    });
    return presentTransaction(tx);
  }
  tx.debited = true;

  try {
    if (resolved.destAccount) {
      const credit = await Account.updateOne(
        { _id: resolved.destAccount._id, status: "active" },
        { $inc: { availableBalance: resolved.amount, ledgerBalance: resolved.amount } },
      );
      if (credit.modifiedCount !== 1) throw new HttpError(400, "ACCOUNT_INACTIVE");
      await Transaction.create({
        reference: makeReference("BK"),
        groupId,
        customerId: resolved.destAccount.customerId,
        accountId: resolved.destAccount._id,
        type,
        direction: "credit",
        amount: resolved.amount,
        fee: 0,
        currency: resolved.destAccount.currency,
        status: "successful",
        description: `Transfer from ${customer.fullName}`,
        descriptionFil: `Transfer mula kay ${customer.fullName}`,
        sourceLabel: tx.sourceLabel,
        counterparty: customer.fullName,
        debited: false,
      });
      tx.status = "successful";
    } else {
      tx.status = "pending";
    }
    await tx.save();
  } catch (error) {
    await Account.updateOne(
      { _id: resolved.source._id },
      { $inc: { availableBalance: resolved.total, ledgerBalance: resolved.total } },
    );
    tx.debited = false;
    tx.status = "failed";
    tx.failureReason = error instanceof HttpError ? error.message : "GENERIC";
    await tx.save();
  }

  if (input.saveBeneficiary && input.type !== "own" && tx.status !== "failed") {
    const exists = await Beneficiary.findOne({ customerId: customer._id, accountNumber: resolved.destinationNumber });
    if (!exists) {
      await Beneficiary.create({
        customerId: customer._id,
        name: resolved.destinationName || resolved.counterparty,
        accountNumber: resolved.destinationNumber,
        bankName: input.type === "internal" ? "Bankak" : resolved.bankName,
        type: input.type === "external" ? "external" : "internal",
      });
    }
  }

  const ok = tx.status === "successful" || tx.status === "pending";
  await notify(
    customer,
    "transaction",
    ok ? "Transfer update" : "Transfer failed",
    ok ? "Update sa transfer" : "Nabigo ang transfer",
    `${tx.reference} · ${tx.status}`,
    `${tx.reference} · ${tx.status}`,
  );
  await writeAudit({
    actorType: "customer",
    actorId: customer._id.toString(),
    actorName: customer.fullName,
    actorRole: "customer",
    action: "transfer.create",
    targetType: "transaction",
    targetId: tx._id.toString(),
    result: ok ? "success" : "failure",
    reference: tx.reference,
    remarks: tx.status,
  });
  return presentTransaction(tx);
}

async function debitSource(source: AccountDoc, total: number) {
  const debit = await Account.updateOne(
    { _id: source._id, status: "active", availableBalance: { $gte: total } },
    { $inc: { availableBalance: -total, ledgerBalance: -total } },
  );
  return debit.modifiedCount === 1;
}

export async function payBill(
  customer: CustomerRecord,
  input: { billerId: string; referenceNumber: string; amount: number; sourceAccountId: string; password: string; idempotencyKey: string },
) {
  await assertPassword(customer.passwordHash, input.password);
  if (input.idempotencyKey.trim().length < 8 || input.referenceNumber.trim().length < 4) throw new HttpError(400, "VALIDATION");
  const existing = await Transaction.findOne({ idempotencyKey: input.idempotencyKey });
  if (existing) {
    if (!existing.customerId.equals(customer._id)) throw new HttpError(409, "IDEMPOTENCY_CONFLICT");
    return presentTransaction(existing);
  }
  const biller = await Biller.findById(oid(input.billerId));
  if (!biller || !biller.enabled) throw new HttpError(400, "BILLER_DISABLED");
  const source = await ownAccount(customer._id, input.sourceAccountId);
  if (source.status !== "active") throw new HttpError(400, "ACCOUNT_INACTIVE");
  const amount = roundMoney(input.amount);
  if (!(amount > 0)) throw new HttpError(400, "INVALID_AMOUNT");
  const fee = roundMoney(biller.fee);
  const total = roundMoney(amount + fee);
  await assertDailyLimit(customer._id, source.dailyTransferLimit, total);
  const tx = await Transaction.create({
    reference: makeReference("BK"),
    groupId: makeReference("G"),
    idempotencyKey: input.idempotencyKey,
    customerId: customer._id,
    accountId: source._id,
    type: "bill_payment",
    direction: "debit",
    amount,
    fee,
    currency: source.currency,
    status: "processing",
    description: biller.name,
    descriptionFil: biller.name,
    sourceLabel: `${source.name} · ${maskAccount(source.accountNumber)}`,
    counterparty: `${biller.name} · ${input.referenceNumber.trim()}`,
    billerId: biller._id,
    debited: false,
  });
  const paid = await debitSource(source, total);
  tx.debited = paid;
  tx.status = paid ? "successful" : "failed";
  tx.failureReason = paid ? "" : "INSUFFICIENT_FUNDS";
  await tx.save();
  await notify(customer, "payment", "Bill payment", "Bayad sa bill", `${biller.name} · ${tx.reference}`, `${biller.name} · ${tx.reference}`);
  await writeAudit({
    actorType: "customer",
    actorId: customer._id.toString(),
    actorName: customer.fullName,
    actorRole: "customer",
    action: "payment.bill",
    targetType: "transaction",
    targetId: tx._id.toString(),
    result: paid ? "success" : "failure",
    reference: tx.reference,
  });
  return presentTransaction(tx);
}

export async function topUp(
  customer: CustomerRecord,
  input: { providerId: string; mobile: string; amount: number; sourceAccountId: string; password: string; idempotencyKey: string },
) {
  await assertPassword(customer.passwordHash, input.password);
  if (input.idempotencyKey.trim().length < 8) throw new HttpError(400, "VALIDATION");
  const existing = await Transaction.findOne({ idempotencyKey: input.idempotencyKey });
  if (existing) {
    if (!existing.customerId.equals(customer._id)) throw new HttpError(409, "IDEMPOTENCY_CONFLICT");
    return presentTransaction(existing);
  }
  const provider = await Provider.findById(oid(input.providerId));
  if (!provider || !provider.enabled) throw new HttpError(400, "BILLER_DISABLED");
  const mobile = input.mobile.replace(/\s/g, "");
  if (!provider.prefixes.some((prefix: string) => mobile.startsWith(prefix)) || mobile.length < 10) {
    throw new HttpError(400, "INVALID_MOBILE");
  }
  const amount = roundMoney(input.amount);
  if (!provider.amounts.some((option: number) => option === amount)) throw new HttpError(400, "UNSUPPORTED_AMOUNT");
  const source = await ownAccount(customer._id, input.sourceAccountId);
  if (source.status !== "active") throw new HttpError(400, "ACCOUNT_INACTIVE");
  const fee = roundMoney(provider.fee);
  const total = roundMoney(amount + fee);
  await assertDailyLimit(customer._id, source.dailyTransferLimit, total);
  const tx = await Transaction.create({
    reference: makeReference("BK"),
    groupId: makeReference("G"),
    idempotencyKey: input.idempotencyKey,
    customerId: customer._id,
    accountId: source._id,
    type: "topup",
    direction: "debit",
    amount,
    fee,
    currency: source.currency,
    status: "processing",
    description: `${provider.name} top-up`,
    descriptionFil: `${provider.name} load`,
    sourceLabel: `${source.name} · ${maskAccount(source.accountNumber)}`,
    counterparty: `${provider.name} · ${mobile}`,
    providerId: provider._id,
    debited: false,
  });
  const paid = await debitSource(source, total);
  tx.debited = paid;
  tx.status = paid ? "successful" : "failed";
  tx.failureReason = paid ? "" : "INSUFFICIENT_FUNDS";
  await tx.save();
  await notify(customer, "payment", "Mobile top-up", "Mobile load", `${provider.name} · ${tx.reference}`, `${provider.name} · ${tx.reference}`);
  await writeAudit({
    actorType: "customer",
    actorId: customer._id.toString(),
    actorName: customer.fullName,
    actorRole: "customer",
    action: "payment.topup",
    targetType: "transaction",
    targetId: tx._id.toString(),
    result: paid ? "success" : "failure",
    reference: tx.reference,
  });
  return presentTransaction(tx);
}

export async function listBeneficiaries(customerId: Oid) {
  const rows = await Beneficiary.find({ customerId }).sort({ name: 1 });
  return rows.map((row) => ({
    id: row._id.toString(),
    name: row.name,
    bankName: row.bankName,
    type: row.type,
    maskedNumber: maskAccount(row.accountNumber),
  }));
}

export async function listBillers() {
  const rows = await Biller.find({ enabled: true }).sort({ name: 1 });
  return rows.map((row) => ({
    id: row._id.toString(),
    name: row.name,
    category: row.category,
    referenceLabel: row.referenceLabel,
    fee: row.fee,
  }));
}

export async function listProviders() {
  const rows = await Provider.find({ enabled: true }).sort({ name: 1 });
  return rows.map((row) => ({
    id: row._id.toString(),
    name: row.name,
    prefixes: row.prefixes,
    amounts: row.amounts,
    fee: row.fee,
  }));
}

export async function listCards(customerId: Oid) {
  const cards = await Card.find({ customerId }).sort({ createdAt: 1 });
  return Promise.all(cards.map(async (card) => presentCard(card, await cardBalance(card.accountId))));
}

export async function getCard(customerId: Oid, cardId: string) {
  const card = await ownCard(customerId, cardId);
  return presentCard(card, await cardBalance(card.accountId));
}

export async function changeCardStatus(
  customer: CustomerRecord,
  cardId: string,
  action: "freeze" | "unfreeze" | "block",
  password: string,
) {
  await assertPassword(customer.passwordHash, password);
  const card = await ownCard(customer._id, cardId);
  if (action === "freeze") {
    if (card.status === "blocked") throw new HttpError(400, "CARD_BLOCKED");
    card.status = "frozen";
  } else if (action === "unfreeze") {
    if (card.status !== "frozen") throw new HttpError(400, "CARD_BLOCKED");
    card.status = "active";
  } else {
    card.status = "blocked";
  }
  card.statusHistory.push({ status: card.status, at: new Date(), by: customer.fullName });
  await card.save();
  await notify(
    customer,
    "card",
    "Card status changed",
    "Nagbago ang status ng card",
    `${maskAccount(card.pan)} is ${card.status}`,
    `${maskAccount(card.pan)} ay ${card.status}`,
  );
  await writeAudit({
    actorType: "customer",
    actorId: customer._id.toString(),
    actorName: customer.fullName,
    actorRole: "customer",
    action: "card.status",
    targetType: "card",
    targetId: card._id.toString(),
    result: "success",
    remarks: card.status,
  });
  return presentCard(card, await cardBalance(card.accountId));
}

export async function changePin(customer: CustomerRecord, cardId: string, currentPin: string, newPin: string, password: string) {
  await assertPassword(customer.passwordHash, password);
  if (!/^\d{4}$/.test(newPin) || !/^\d{4}$/.test(currentPin)) throw new HttpError(400, "VALIDATION");
  const card = await ownCard(customer._id, cardId);
  const matches = await compare(currentPin, card.pinHash);
  if (!matches) throw new HttpError(400, "BAD_PIN");
  if (await compare(newPin, card.pinHash)) throw new HttpError(400, "PIN_REUSED");
  card.pinHash = await hashSecret(newPin);
  await card.save();
  await notify(customer, "security", "Card PIN updated", "Na-update ang PIN ng card", "Your card PIN was changed.", "Nabago ang PIN ng card mo.");
  await writeAudit({
    actorType: "customer",
    actorId: customer._id.toString(),
    actorName: customer.fullName,
    actorRole: "customer",
    action: "card.pin",
    targetType: "card",
    targetId: card._id.toString(),
    result: "success",
    remarks: "PIN updated",
  });
  return { ok: true };
}

export async function updateControls(
  customer: CustomerRecord,
  cardId: string,
  controls: { online: boolean; atm: boolean; pos: boolean; international: boolean },
  password: string,
) {
  await assertPassword(customer.passwordHash, password);
  const card = await ownCard(customer._id, cardId);
  if (card.status === "blocked") throw new HttpError(400, "CARD_BLOCKED");
  card.controls = controls;
  await card.save();
  await writeAudit({
    actorType: "customer",
    actorId: customer._id.toString(),
    actorName: customer.fullName,
    actorRole: "customer",
    action: "card.controls",
    targetType: "card",
    targetId: card._id.toString(),
    result: "success",
  });
  return presentCard(card, await cardBalance(card.accountId));
}

export async function requestLimit(
  customer: CustomerRecord,
  cardId: string,
  limits: { dailySpend: number; atm: number; pos: number; online: number },
  password: string,
) {
  await assertPassword(customer.passwordHash, password);
  const card = await ownCard(customer._id, cardId);
  const config = await getSettings();
  const values = [limits.dailySpend, limits.atm, limits.pos, limits.online];
  if (values.some((value) => !(value > 0) || value > config.maxCardLimit)) throw new HttpError(400, "LIMIT_EXCEEDED");
  const request = await ServiceRequest.create({
    reference: makeReference("SR"),
    customerId: customer._id,
    type: "card_limit",
    status: "submitted",
    payload: { cardId: card._id.toString(), limits },
    history: [{ status: "submitted", remarks: "", officerName: customer.fullName, at: new Date() }],
  });
  await notify(customer, "request", "Limit request submitted", "Naisumite ang limit request", request.reference, request.reference);
  await writeAudit({
    actorType: "customer",
    actorId: customer._id.toString(),
    actorName: customer.fullName,
    actorRole: "customer",
    action: "card.limit.request",
    targetType: "service_request",
    targetId: request._id.toString(),
    result: "success",
    reference: request.reference,
  });
  return presentRequest(request);
}

export async function createCardRequest(
  customer: CustomerRecord,
  input: { type: "new_card" | "replacement_card" | "card_activation"; cardId?: string; note?: string; password: string },
) {
  await assertPassword(customer.passwordHash, input.password);
  if (input.cardId) await ownCard(customer._id, input.cardId);
  const request = await ServiceRequest.create({
    reference: makeReference("SR"),
    customerId: customer._id,
    type: input.type,
    status: "submitted",
    payload: { cardId: input.cardId ?? "", note: input.note ?? "" },
    history: [{ status: "submitted", remarks: input.note ?? "", officerName: customer.fullName, at: new Date() }],
  });
  await notify(customer, "request", "Card request submitted", "Naisumite ang card request", request.reference, request.reference);
  await writeAudit({
    actorType: "customer",
    actorId: customer._id.toString(),
    actorName: customer.fullName,
    actorRole: "customer",
    action: "card.request",
    targetType: "service_request",
    targetId: request._id.toString(),
    result: "success",
    reference: request.reference,
  });
  return presentRequest(request);
}

function presentRequest(request: {
  _id: { toString(): string };
  reference: string;
  type: string;
  status: string;
  payload?: unknown;
  assignedOfficerName?: string;
  history?: unknown[];
  createdAt?: Date;
}) {
  return {
    id: request._id.toString(),
    reference: request.reference,
    type: request.type,
    status: request.status,
    payload: request.payload ?? {},
    assignedOfficerName: request.assignedOfficerName ?? "",
    history: request.history ?? [],
    createdAt: request.createdAt,
  };
}

export async function listRequests(customerId: Oid) {
  const rows = await ServiceRequest.find({ customerId }).sort({ createdAt: -1 });
  return rows.map((row) => presentRequest(row));
}

export async function listNotifications(customerId: Oid) {
  const rows = await Notification.find({ customerId }).sort({ createdAt: -1 }).limit(50);
  return rows.map((row) => ({
    id: row._id.toString(),
    category: row.category,
    title: row.title,
    titleFil: row.titleFil || row.title,
    body: row.body,
    bodyFil: row.bodyFil || row.body,
    read: row.read,
    createdAt: row.createdAt,
  }));
}

export async function markNotificationsRead(customerId: Oid, ids?: string[]) {
  if (ids && ids.length) {
    await Notification.updateMany({ customerId, _id: { $in: ids.filter((value) => Types.ObjectId.isValid(value)) } }, { read: true });
  } else {
    await Notification.updateMany({ customerId }, { read: true });
  }
  return { ok: true };
}

export async function updateProfile(
  customer: CustomerRecord,
  patch: {
    fullName?: string;
    language?: "en" | "fil";
    notificationPrefs?: Partial<CustomerRecord["notificationPrefs"]>;
  },
) {
  if (patch.fullName) customer.fullName = patch.fullName.trim();
  if (patch.language) customer.language = patch.language;
  if (patch.notificationPrefs) {
    customer.notificationPrefs = { ...customer.notificationPrefs, ...patch.notificationPrefs };
    customer.markModified("notificationPrefs");
  }
  await customer.save();
  await writeAudit({
    actorType: "customer",
    actorId: customer._id.toString(),
    actorName: customer.fullName,
    actorRole: "customer",
    action: "profile.update",
    targetType: "customer",
    targetId: customer._id.toString(),
    result: "success",
  });
  return customer;
}

export async function updateSensitive(customer: CustomerRecord, patch: { email?: string; mobile?: string; password: string }) {
  await assertPassword(customer.passwordHash, patch.password);
  if (patch.email) customer.email = patch.email.trim().toLowerCase();
  if (patch.mobile) customer.mobile = patch.mobile.trim();
  try {
    await customer.save();
  } catch (error) {
    if (isDuplicateKey(error)) throw new HttpError(400, "ALREADY_USED");
    throw error;
  }
  await writeAudit({
    actorType: "customer",
    actorId: customer._id.toString(),
    actorName: customer.fullName,
    actorRole: "customer",
    action: "profile.sensitive",
    targetType: "customer",
    targetId: customer._id.toString(),
    result: "success",
    remarks: "Contact details updated",
  });
  return customer;
}

export async function setHideBalance(customer: CustomerRecord, hideBalance: boolean) {
  customer.hideBalance = hideBalance;
  await customer.save();
  return { hideBalance };
}

export async function listActivity(customerId: string) {
  const { AuditLog } = await import("@/lib/models");
  const rows = await AuditLog.find({ actorId: customerId }).sort({ createdAt: -1 }).limit(50);
  return rows.map((row) => ({
    id: row._id.toString(),
    action: row.action,
    result: row.result,
    remarks: row.remarks,
    reference: row.reference,
    createdAt: row.createdAt,
  }));
}
