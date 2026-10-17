import { authenticator } from "otplib";
import { Types } from "mongoose";
import { writeAudit } from "@/lib/audit";
import { hashSecret } from "@/lib/auth";
import { HttpError, isDuplicateKey } from "@/lib/errors";
import { makeReference, maskAccount } from "@/lib/money";
import {
  Account,
  Announcement,
  Approval,
  AuditLog,
  Biller,
  Card,
  Customer,
  Notification,
  Provider,
  ServiceRequest,
  Staff,
  Transaction,
  type StaffDoc,
} from "@/lib/models";
import { presentAccount, presentCard, presentTransaction } from "@/lib/present";
import { can, seesBalances, type StaffRole } from "@/lib/rbac";
import { buildReport, toCsv } from "@/lib/reports";
import { getSettings } from "@/lib/settings";

function oid(value: string) {
  if (!Types.ObjectId.isValid(value)) throw new HttpError(400, "VALIDATION");
  return new Types.ObjectId(value);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function owners(ids: Types.ObjectId[]) {
  const rows = await Customer.find({ _id: { $in: ids } });
  return new Map(rows.map((row) => [row._id.toString(), row]));
}

export async function adminDashboard(from?: Date, to?: Date) {
  const created = from || to ? { createdAt: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } } : {};
  const [customers, activeCustomers, accountsActive, accountsInactive, cardsActive, cardsBlocked, cardsFrozen, transactions, failed, pending, requests, downBillers, downProviders, volume] =
    await Promise.all([
      Customer.countDocuments(),
      Customer.countDocuments({ status: "active" }),
      Account.countDocuments({ status: "active" }),
      Account.countDocuments({ status: "inactive" }),
      Card.countDocuments({ status: "active" }),
      Card.countDocuments({ status: "blocked" }),
      Card.countDocuments({ status: "frozen" }),
      Transaction.countDocuments(created),
      Transaction.countDocuments({ ...created, status: "failed" }),
      Transaction.countDocuments({ ...created, status: "pending" }),
      ServiceRequest.countDocuments({ status: { $in: ["submitted", "under_review"] } }),
      Biller.countDocuments({ integrationStatus: "down" }),
      Provider.countDocuments({ integrationStatus: "down" }),
      Transaction.aggregate<{ total: number }>([
        { $match: { ...created, direction: "debit", status: "successful" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);
  return {
    customers,
    activeCustomers,
    inactiveCustomers: customers - activeCustomers,
    accountsActive,
    accountsInactive,
    cardsActive,
    cardsBlocked,
    cardsFrozen,
    transactions,
    failed,
    pending,
    openRequests: requests,
    integrationIssues: downBillers + downProviders,
    volume: volume[0]?.total ?? 0,
  };
}

export async function searchCustomers(q: string) {
  const filter = q
    ? {
        $or: [
          { fullName: new RegExp(escapeRegex(q), "i") },
          { email: new RegExp(escapeRegex(q), "i") },
          { mobile: new RegExp(escapeRegex(q), "i") },
        ],
      }
    : {};
  const rows = await Customer.find(filter).sort({ fullName: 1 }).limit(50);
  return rows.map((row) => ({
    id: row._id.toString(),
    fullName: row.fullName,
    email: row.email,
    mobile: row.mobile,
    status: row.status,
    language: row.language,
  }));
}

export async function getCustomer(customerId: string, role: string) {
  const customer = await Customer.findById(oid(customerId));
  if (!customer) throw new HttpError(404, "NOT_FOUND");
  const [accounts, cards, transactions, requests] = await Promise.all([
    Account.find({ customerId: customer._id }),
    Card.find({ customerId: customer._id }),
    Transaction.find({ customerId: customer._id }).sort({ createdAt: -1 }).limit(15),
    ServiceRequest.find({ customerId: customer._id }).sort({ createdAt: -1 }).limit(15),
  ]);
  const reveal = seesBalances(role);
  return {
    id: customer._id.toString(),
    fullName: customer.fullName,
    email: customer.email,
    mobile: customer.mobile,
    status: customer.status,
    language: customer.language,
    notes: customer.notes,
    accounts: accounts.map((account) => presentAccount(account, reveal)),
    cards: await Promise.all(cards.map(async (card) => {
      const account = accounts.find((item) => item._id.equals(card.accountId));
      return presentCard(card, reveal ? account?.availableBalance ?? 0 : 0);
    })),
    transactions: transactions.map((tx) => presentTransaction(tx)),
    requests: requests.map(presentRequest),
  };
}

export async function updateCustomer(
  staff: StaffDoc,
  customerId: string,
  patch: { fullName?: string; email?: string; mobile?: string; status?: "active" | "inactive" },
) {
  const customer = await Customer.findById(oid(customerId));
  if (!customer) throw new HttpError(404, "NOT_FOUND");
  if ((patch.fullName || patch.email || patch.mobile) && !can(staff.role, "customers.update")) throw new HttpError(403, "FORBIDDEN");
  if (patch.status && !can(staff.role, "customers.status")) throw new HttpError(403, "FORBIDDEN");
  if (patch.fullName) customer.fullName = patch.fullName.trim();
  if (patch.email) customer.email = patch.email.trim().toLowerCase();
  if (patch.mobile) customer.mobile = patch.mobile.trim();
  if (patch.status) customer.status = patch.status;
  try {
    await customer.save();
  } catch (error) {
    if (isDuplicateKey(error)) throw new HttpError(400, "ALREADY_USED");
    throw error;
  }
  await writeAudit({
    actorType: "staff",
    actorId: staff._id.toString(),
    actorName: staff.fullName,
    actorRole: staff.role,
    action: "customer.update",
    targetType: "customer",
    targetId: customer._id.toString(),
    result: "success",
    remarks: patch.status ? `status ${patch.status}` : "profile updated",
  });
  return { id: customer._id.toString(), status: customer.status };
}

export async function addCustomerNote(staff: StaffDoc, customerId: string, text: string) {
  const customer = await Customer.findById(oid(customerId));
  if (!customer) throw new HttpError(404, "NOT_FOUND");
  customer.notes.push({ text: text.trim(), authorName: staff.fullName, createdAt: new Date() });
  await customer.save();
  await writeAudit({
    actorType: "staff",
    actorId: staff._id.toString(),
    actorName: staff.fullName,
    actorRole: staff.role,
    action: "customer.note",
    targetType: "customer",
    targetId: customer._id.toString(),
    result: "success",
  });
  return { ok: true };
}

export async function searchAccounts(role: string, q: string) {
  const accounts = await Account.find().sort({ createdAt: -1 }).limit(100);
  const people = await owners(accounts.map((account) => account.customerId));
  return accounts
    .map((account) => {
      const owner = people.get(account.customerId.toString());
      return {
        ...presentAccount(account, seesBalances(role)),
        customerName: owner?.fullName ?? "",
      };
    })
    .filter((account) => {
      if (!q) return true;
      const hay = `${account.customerName} ${account.maskedNumber} ${account.name}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
}

export async function setAccountStatus(staff: StaffDoc, accountId: string, status: "active" | "inactive", remarks: string) {
  const account = await Account.findById(oid(accountId));
  if (!account) throw new HttpError(404, "NOT_FOUND");
  if (staff.role === "operations") {
    const request = await ServiceRequest.create({
      reference: makeReference("SR"),
      customerId: account.customerId,
      type: "account",
      status: "submitted",
      payload: { accountId: account._id.toString(), status },
      assignedOfficerName: staff.fullName,
      history: [{ status: "submitted", remarks, officerName: staff.fullName, at: new Date() }],
    });
    await writeAudit({
      actorType: "staff",
      actorId: staff._id.toString(),
      actorName: staff.fullName,
      actorRole: staff.role,
      action: "account.status.request",
      targetType: "service_request",
      targetId: request._id.toString(),
      result: "success",
      reference: request.reference,
      remarks,
    });
    return { requested: true, reference: request.reference };
  }
  if (!can(staff.role, "accounts.status") || staff.role !== "administrator") throw new HttpError(403, "FORBIDDEN");
  account.status = status;
  await account.save();
  await writeAudit({
    actorType: "staff",
    actorId: staff._id.toString(),
    actorName: staff.fullName,
    actorRole: staff.role,
    action: "account.status",
    targetType: "account",
    targetId: account._id.toString(),
    result: "success",
    remarks: status,
  });
  return { requested: false, status };
}

export async function searchCards(role: string, q: string) {
  const cards = await Card.find().sort({ createdAt: -1 }).limit(100);
  const people = await owners(cards.map((card) => card.customerId));
  const accounts = await Account.find({ _id: { $in: cards.map((card) => card.accountId) } });
  return cards
    .map((card) => {
      const account = accounts.find((item) => item._id.equals(card.accountId));
      return {
        ...presentCard(card, seesBalances(role) ? account?.availableBalance ?? 0 : 0),
        customerName: people.get(card.customerId.toString())?.fullName ?? "",
      };
    })
    .filter((card) => {
      if (!q) return true;
      return `${card.customerName} ${card.maskedNumber} ${card.holderName}`.toLowerCase().includes(q.toLowerCase());
    });
}

export async function setCardStatus(staff: StaffDoc, cardId: string, status: "active" | "frozen" | "blocked", remarks: string) {
  const card = await Card.findById(oid(cardId));
  if (!card) throw new HttpError(404, "NOT_FOUND");
  card.status = status;
  card.statusHistory.push({ status, at: new Date(), by: staff.fullName });
  await card.save();
  const customer = await Customer.findById(card.customerId);
  if (customer) {
    await Notification.create({
      customerId: customer._id,
      category: "card",
      title: "Card status changed",
      titleFil: "Nagbago ang status ng card",
      body: `${maskAccount(card.pan)} is ${status}`,
      bodyFil: `${maskAccount(card.pan)} ay ${status}`,
      read: false,
    });
  }
  await writeAudit({
    actorType: "staff",
    actorId: staff._id.toString(),
    actorName: staff.fullName,
    actorRole: staff.role,
    action: "card.status",
    targetType: "card",
    targetId: card._id.toString(),
    result: "success",
    remarks: remarks || status,
  });
  return { status };
}

export async function searchTransactions(query: {
  reference?: string;
  customerId?: string;
  accountId?: string;
  type?: string;
  status?: string;
  from?: Date;
  to?: Date;
  minAmount?: number;
  maxAmount?: number;
}) {
  const filter: Record<string, unknown> = {};
  if (query.reference) filter.reference = new RegExp(escapeRegex(query.reference), "i");
  if (query.customerId && Types.ObjectId.isValid(query.customerId)) filter.customerId = oid(query.customerId);
  if (query.accountId && Types.ObjectId.isValid(query.accountId)) filter.accountId = oid(query.accountId);
  if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;
  if (query.from || query.to) {
    filter.createdAt = { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) };
  }
  if (query.minAmount != null || query.maxAmount != null) {
    filter.amount = {
      ...(query.minAmount != null ? { $gte: query.minAmount } : {}),
      ...(query.maxAmount != null ? { $lte: query.maxAmount } : {}),
    };
  }
  const rows = await Transaction.find(filter).sort({ createdAt: -1 }).limit(100);
  return rows.map((row) => presentTransaction(row));
}

export async function addRemark(staff: StaffDoc, transactionId: string, text: string) {
  const tx = await Transaction.findById(oid(transactionId));
  if (!tx) throw new HttpError(404, "NOT_FOUND");
  tx.operationalRemarks.push({ text: text.trim(), actorName: staff.fullName, at: new Date() });
  await tx.save();
  await writeAudit({
    actorType: "staff",
    actorId: staff._id.toString(),
    actorName: staff.fullName,
    actorRole: staff.role,
    action: "transaction.remark",
    targetType: "transaction",
    targetId: tx._id.toString(),
    result: "success",
    reference: tx.reference,
  });
  return presentTransaction(tx);
}

export async function retryTransaction(staff: StaffDoc, transactionId: string, remarks: string) {
  const tx = await Transaction.findById(oid(transactionId));
  if (!tx) throw new HttpError(404, "NOT_FOUND");
  if (!["failed", "rejected"].includes(tx.status) || tx.debited) throw new HttpError(400, "CANNOT_RETRY");
  const total = Math.round((tx.amount + (tx.fee ?? 0)) * 100) / 100;
  const debit = await Account.updateOne(
    { _id: tx.accountId, status: "active", availableBalance: { $gte: total } },
    { $inc: { availableBalance: -total, ledgerBalance: -total } },
  );
  tx.operationalRemarks.push({ text: remarks || "Retry", actorName: staff.fullName, at: new Date() });
  if (debit.modifiedCount !== 1) {
    tx.status = "failed";
    tx.failureReason = "INSUFFICIENT_FUNDS";
    await tx.save();
    throw new HttpError(400, "INSUFFICIENT_FUNDS");
  }
  tx.debited = true;
  tx.status = tx.type === "transfer_external" ? "pending" : "successful";
  tx.failureReason = "";
  await tx.save();
  await writeAudit({
    actorType: "staff",
    actorId: staff._id.toString(),
    actorName: staff.fullName,
    actorRole: staff.role,
    action: "transaction.retry",
    targetType: "transaction",
    targetId: tx._id.toString(),
    result: "success",
    reference: tx.reference,
  });
  return presentTransaction(tx);
}

export async function resolvePending(staff: StaffDoc, transactionId: string, outcome: "successful" | "failed", remarks: string) {
  const tx = await Transaction.findById(oid(transactionId));
  if (!tx || tx.status !== "pending") throw new HttpError(400, "CANNOT_RESOLVE");
  if (outcome === "failed" && tx.debited) {
    const total = Math.round((tx.amount + (tx.fee ?? 0)) * 100) / 100;
    await Account.updateOne({ _id: tx.accountId }, { $inc: { availableBalance: total, ledgerBalance: total } });
    tx.debited = false;
  }
  tx.status = outcome;
  tx.failureReason = outcome === "failed" ? "REJECTED_BY_OPERATIONS" : "";
  tx.operationalRemarks.push({ text: remarks || outcome, actorName: staff.fullName, at: new Date() });
  await tx.save();
  await writeAudit({
    actorType: "staff",
    actorId: staff._id.toString(),
    actorName: staff.fullName,
    actorRole: staff.role,
    action: "transaction.resolve",
    targetType: "transaction",
    targetId: tx._id.toString(),
    result: "success",
    reference: tx.reference,
    remarks: outcome,
  });
  return presentTransaction(tx);
}

export async function requestReversal(staff: StaffDoc, transactionId: string, reason: string) {
  const tx = await Transaction.findById(oid(transactionId));
  if (!tx || tx.status !== "successful" || tx.type === "reversal" || tx.direction !== "debit") {
    throw new HttpError(400, "CANNOT_REVERSE");
  }
  const existing = await Approval.findOne({ type: "reversal", status: "pending", "payload.transactionId": tx._id.toString() });
  if (existing) throw new HttpError(400, "ALREADY_HANDLED");
  const approval = await Approval.create({
    type: "reversal",
    status: "pending",
    requestedBy: staff._id,
    requestedByName: staff.fullName,
    requestedByRole: staff.role,
    payload: { transactionId: tx._id.toString(), reference: tx.reference },
    remarks: reason,
  });
  await writeAudit({
    actorType: "staff",
    actorId: staff._id.toString(),
    actorName: staff.fullName,
    actorRole: staff.role,
    action: "transaction.reversal.request",
    targetType: "approval",
    targetId: approval._id.toString(),
    result: "success",
    reference: tx.reference,
    remarks: reason,
  });
  return presentApproval(approval);
}

export async function listApprovals(staff: StaffDoc) {
  const filter: Record<string, unknown> = { status: "pending" };
  if (staff.role === "operations") filter.requestedBy = staff._id;
  if (staff.role === "security_admin") filter.type = { $in: ["role_change", "role_grant"] };
  if (staff.role === "support") return [];
  const rows = await Approval.find(filter).sort({ createdAt: -1 }).limit(50);
  return rows.map(presentApproval);
}

export async function decideApproval(staff: StaffDoc, approvalId: string, decision: "approved" | "rejected", remarks: string) {
  const approval = await Approval.findById(oid(approvalId));
  if (!approval || approval.status !== "pending") throw new HttpError(400, "ALREADY_HANDLED");
  if (approval.requestedBy.equals(staff._id)) throw new HttpError(403, "APPROVAL_SELF");
  if (approval.type === "reversal" && !can(staff.role, "transactions.reverse.approve")) throw new HttpError(403, "FORBIDDEN");
  if (approval.type !== "reversal" && !can(staff.role, "users.role.approve")) throw new HttpError(403, "FORBIDDEN");

  if (decision === "approved" && approval.type === "reversal") {
    await applyReversal(String(approval.payload.transactionId));
  }
  if (decision === "approved" && approval.type === "role_change") {
    const target = await Staff.findById(oid(String(approval.payload.staffId)));
    if (!target) throw new HttpError(404, "NOT_FOUND");
    target.role = String(approval.payload.toRole);
    await target.save();
  }
  if (decision === "approved" && approval.type === "role_grant") {
    const target = await Staff.findById(oid(String(approval.payload.staffId)));
    if (!target) throw new HttpError(404, "NOT_FOUND");
    target.status = "active";
    await target.save();
  }

  approval.status = decision;
  approval.decidedBy = staff._id;
  approval.decidedByName = staff.fullName;
  approval.decisionRemarks = remarks;
  approval.decidedAt = new Date();
  await approval.save();
  await writeAudit({
    actorType: "staff",
    actorId: staff._id.toString(),
    actorName: staff.fullName,
    actorRole: staff.role,
    action: `approval.${decision}`,
    targetType: "approval",
    targetId: approval._id.toString(),
    result: "success",
    remarks: approval.type,
  });
  return presentApproval(approval);
}

async function applyReversal(transactionId: string) {
  const original = await Transaction.findById(oid(transactionId));
  if (!original || original.status !== "successful" || original.direction !== "debit") {
    throw new HttpError(400, "CANNOT_REVERSE");
  }
  const total = Math.round((original.amount + (original.fee ?? 0)) * 100) / 100;
  await Account.updateOne({ _id: original.accountId }, { $inc: { availableBalance: total, ledgerBalance: total } });
  const mirror = await Transaction.findOne({ groupId: original.groupId, direction: "credit", status: "successful" });
  if (mirror) {
    const clawback = await Account.updateOne(
      { _id: mirror.accountId, availableBalance: { $gte: mirror.amount } },
      { $inc: { availableBalance: -mirror.amount, ledgerBalance: -mirror.amount } },
    );
    if (clawback.modifiedCount !== 1) {
      await Account.updateOne({ _id: original.accountId }, { $inc: { availableBalance: -total, ledgerBalance: -total } });
      throw new HttpError(400, "INSUFFICIENT_FUNDS");
    }
    mirror.status = "reversed";
    await mirror.save();
  }
  original.status = "reversed";
  await original.save();
  await Transaction.create({
    reference: makeReference("BK"),
    groupId: original.groupId,
    customerId: original.customerId,
    accountId: original.accountId,
    type: "reversal",
    direction: "credit",
    amount: total,
    fee: 0,
    currency: original.currency,
    status: "successful",
    description: `Reversal of ${original.reference}`,
    descriptionFil: `Reversal ng ${original.reference}`,
    sourceLabel: original.sourceLabel,
    counterparty: original.counterparty,
    debited: false,
  });
}

function presentApproval(approval: {
  _id: { toString(): string };
  type: string;
  status: string;
  requestedByName: string;
  requestedByRole: string;
  payload?: unknown;
  remarks?: string;
  decisionRemarks?: string;
  createdAt?: Date;
}) {
  return {
    id: approval._id.toString(),
    type: approval.type,
    status: approval.status,
    requestedByName: approval.requestedByName,
    requestedByRole: approval.requestedByRole,
    payload: approval.payload ?? {},
    remarks: approval.remarks ?? "",
    decisionRemarks: approval.decisionRemarks ?? "",
    createdAt: approval.createdAt,
  };
}

function presentService(row: {
  _id: { toString(): string };
  name: string;
  fee: number;
  enabled: boolean;
  integrationStatus: string;
}) {
  return {
    id: row._id.toString(),
    name: row.name,
    fee: row.fee,
    enabled: row.enabled,
    integrationStatus: row.integrationStatus,
  };
}

export async function listBillersAdmin() {
  const rows = await Biller.find().sort({ name: 1 });
  return rows.map((row) => ({ ...presentService(row), category: row.category, referenceLabel: row.referenceLabel }));
}

export async function saveBiller(
  staff: StaffDoc,
  input: { id?: string; name: string; category: string; referenceLabel: string; fee: number; enabled: boolean; integrationStatus: "healthy" | "degraded" | "down" },
) {
  const biller = input.id ? await Biller.findById(oid(input.id)) : new Biller();
  if (!biller) throw new HttpError(404, "NOT_FOUND");
  biller.name = input.name.trim();
  biller.category = input.category.trim();
  biller.referenceLabel = input.referenceLabel.trim();
  biller.fee = input.fee;
  biller.enabled = input.enabled;
  biller.integrationStatus = input.integrationStatus;
  await biller.save();
  await writeAudit({
    actorType: "staff",
    actorId: staff._id.toString(),
    actorName: staff.fullName,
    actorRole: staff.role,
    action: "biller.save",
    targetType: "biller",
    targetId: biller._id.toString(),
    result: "success",
  });
  return { id: biller._id.toString() };
}

export async function listProvidersAdmin() {
  const rows = await Provider.find().sort({ name: 1 });
  return rows.map((row) => ({ ...presentService(row), prefixes: row.prefixes, amounts: row.amounts }));
}

export async function saveProvider(
  staff: StaffDoc,
  input: { id?: string; name: string; prefixes: string[]; amounts: number[]; fee: number; enabled: boolean; integrationStatus: "healthy" | "degraded" | "down" },
) {
  const provider = input.id ? await Provider.findById(oid(input.id)) : new Provider();
  if (!provider) throw new HttpError(404, "NOT_FOUND");
  provider.name = input.name.trim();
  provider.prefixes = input.prefixes;
  provider.amounts = input.amounts;
  provider.fee = input.fee;
  provider.enabled = input.enabled;
  provider.integrationStatus = input.integrationStatus;
  await provider.save();
  await writeAudit({
    actorType: "staff",
    actorId: staff._id.toString(),
    actorName: staff.fullName,
    actorRole: staff.role,
    action: "provider.save",
    targetType: "provider",
    targetId: provider._id.toString(),
    result: "success",
  });
  return { id: provider._id.toString() };
}

function presentRequest(request: {
  _id: { toString(): string };
  reference: string;
  customerId: { toString(): string };
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
    customerId: request.customerId.toString(),
    type: request.type,
    status: request.status,
    payload: request.payload ?? {},
    assignedOfficerName: request.assignedOfficerName ?? "",
    history: request.history ?? [],
    createdAt: request.createdAt,
  };
}

export async function listServiceRequests(status?: string) {
  const filter = status ? { status } : {};
  const rows = await ServiceRequest.find(filter).sort({ createdAt: -1 }).limit(100);
  const people = await owners(rows.map((row) => row.customerId));
  return rows.map((row) => ({ ...presentRequest(row), customerName: people.get(row.customerId.toString())?.fullName ?? "" }));
}

export async function updateServiceRequest(staff: StaffDoc, requestId: string, status: string, remarks: string) {
  const allowed = ["submitted", "under_review", "approved", "rejected", "completed", "cancelled"];
  if (!allowed.includes(status)) throw new HttpError(400, "VALIDATION");
  const request = await ServiceRequest.findById(oid(requestId));
  if (!request) throw new HttpError(404, "NOT_FOUND");
  request.status = status as typeof request.status;
  request.assignedOfficerName = staff.fullName;
  request.history.push({ status, remarks, officerName: staff.fullName, at: new Date() });
  const payload = (request.payload ?? {}) as { cardId?: string; accountId?: string; status?: "active" | "inactive"; limits?: { dailySpend: number; atm: number; pos: number; online: number } };
  if (status === "approved" && request.type === "card_limit" && payload.cardId && payload.limits) {
    await Card.updateOne({ _id: oid(payload.cardId) }, { limits: payload.limits });
  }
  if ((status === "approved" || status === "completed") && request.type === "card_activation" && payload.cardId) {
    await Card.updateOne({ _id: oid(payload.cardId), status: { $ne: "blocked" } }, { status: "active" });
  }
  if (status === "approved" && request.type === "account" && payload.accountId && payload.status) {
    await Account.updateOne({ _id: oid(payload.accountId) }, { status: payload.status });
  }
  await request.save();
  const customer = await Customer.findById(request.customerId);
  if (customer?.notificationPrefs?.inApp) {
    await Notification.create({
      customerId: customer._id,
      category: "request",
      title: "Request updated",
      titleFil: "Na-update ang kahilingan",
      body: `${request.reference} · ${status}`,
      bodyFil: `${request.reference} · ${status}`,
      read: false,
    });
  }
  await writeAudit({
    actorType: "staff",
    actorId: staff._id.toString(),
    actorName: staff.fullName,
    actorRole: staff.role,
    action: "request.update",
    targetType: "service_request",
    targetId: request._id.toString(),
    result: "success",
    reference: request.reference,
    remarks: status,
  });
  return presentRequest(request);
}

export async function listStaff() {
  const rows = await Staff.find().sort({ fullName: 1 });
  return rows.map((row) => ({
    id: row._id.toString(),
    fullName: row.fullName,
    email: row.email,
    role: row.role,
    status: row.status,
    lastLoginAt: row.lastLoginAt,
  }));
}

export async function createStaff(
  staff: StaffDoc,
  input: { fullName: string; email: string; password: string; role: StaffRole },
) {
  const privileged = input.role === "administrator" || input.role === "security_admin";
  try {
    const created = await Staff.create({
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      passwordHash: await hashSecret(input.password),
      role: input.role,
      status: privileged ? "suspended" : "active",
      totpSecret: authenticator.generateSecret(),
    });
    if (privileged) {
      await Approval.create({
        type: "role_grant",
        requestedBy: staff._id,
        requestedByName: staff.fullName,
        requestedByRole: staff.role,
        payload: { staffId: created._id.toString(), role: input.role },
        remarks: "Privileged access grant",
      });
    }
    await writeAudit({
      actorType: "staff",
      actorId: staff._id.toString(),
      actorName: staff.fullName,
      actorRole: staff.role,
      action: "staff.create",
      targetType: "staff",
      targetId: created._id.toString(),
      result: "success",
      remarks: input.role,
    });
    return {
      id: created._id.toString(),
      status: created.status,
      totpSecret: created.totpSecret,
      otpauth: authenticator.keyuri(created.email, "Bankak Admin", created.totpSecret),
    };
  } catch (error) {
    if (isDuplicateKey(error)) throw new HttpError(400, "ALREADY_USED");
    throw error;
  }
}

export async function updateStaff(
  actor: StaffDoc,
  staffId: string,
  patch: { role?: StaffRole; status?: "active" | "suspended"; resetPassword?: boolean },
) {
  const target = await Staff.findById(oid(staffId));
  if (!target) throw new HttpError(404, "NOT_FOUND");
  let temporaryPassword = "";
  if (patch.role && patch.role !== target.role) {
    const pending = await Approval.findOne({ type: "role_change", status: "pending", "payload.staffId": target._id.toString() });
    if (pending) throw new HttpError(400, "ALREADY_HANDLED");
    await Approval.create({
      type: "role_change",
      requestedBy: actor._id,
      requestedByName: actor.fullName,
      requestedByRole: actor.role,
      payload: { staffId: target._id.toString(), toRole: patch.role },
      remarks: `${target.role} -> ${patch.role}`,
    });
  }
  if (patch.status) {
    if (patch.status === "active") {
      const grant = await Approval.findOne({ type: "role_grant", status: "pending", "payload.staffId": target._id.toString() });
      if (grant) throw new HttpError(400, "APPROVAL_REQUIRED");
    }
    target.status = patch.status;
  }
  if (patch.resetPassword) {
    temporaryPassword = `Bk${Math.random().toString(36).slice(2, 8)}#9`;
    target.passwordHash = await hashSecret(temporaryPassword);
  }
  await target.save();
  await writeAudit({
    actorType: "staff",
    actorId: actor._id.toString(),
    actorName: actor.fullName,
    actorRole: actor.role,
    action: "staff.update",
    targetType: "staff",
    targetId: target._id.toString(),
    result: "success",
    remarks: patch.resetPassword ? "password reset" : patch.status || "role change requested",
  });
  return { id: target._id.toString(), status: target.status, temporaryPassword: temporaryPassword || undefined };
}

export async function getReport(type: string, from?: Date, to?: Date) {
  const rows = await buildReport(type, from, to);
  if (!rows) throw new HttpError(400, "VALIDATION");
  return rows;
}

export async function exportReport(staff: StaffDoc, type: string, from?: Date, to?: Date) {
  const rows = await getReport(type, from, to);
  await writeAudit({
    actorType: "staff",
    actorId: staff._id.toString(),
    actorName: staff.fullName,
    actorRole: staff.role,
    action: "report.export",
    targetType: "report",
    targetId: type,
    result: "success",
    remarks: type,
  });
  return toCsv(rows);
}

export async function listAudit(staff: StaffDoc, action?: string) {
  const filter: Record<string, unknown> = {};
  if (!can(staff.role, "audit.read")) filter.actorId = staff._id.toString();
  if (action) filter.action = new RegExp(escapeRegex(action), "i");
  const rows = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(150);
  return rows.map((row) => ({
    id: row._id.toString(),
    actorName: row.actorName,
    actorRole: row.actorRole,
    action: row.action,
    targetType: row.targetType,
    result: row.result,
    remarks: row.remarks,
    reference: row.reference,
    createdAt: row.createdAt,
  }));
}

export async function updateBankSettings(
  staff: StaffDoc,
  patch: Partial<{
    currency: string;
    transferFeeInternal: number;
    transferFeeExternal: number;
    dailyTransferLimit: number;
    maxCardLimit: number;
    sessionTimeoutMinutes: number;
    maxFailedLogins: number;
    lockoutMinutes: number;
  }>,
) {
  const financial = ["currency", "transferFeeInternal", "transferFeeExternal", "dailyTransferLimit", "maxCardLimit"] as const;
  const security = ["sessionTimeoutMinutes", "maxFailedLogins", "lockoutMinutes"] as const;
  for (const key of financial) {
    if (patch[key] != null && !can(staff.role, "settings.manage")) throw new HttpError(403, "FORBIDDEN");
  }
  for (const key of security) {
    if (patch[key] != null && !can(staff.role, "settings.security")) throw new HttpError(403, "FORBIDDEN");
  }
  const config = await getSettings();
  Object.assign(config, patch);
  await config.save();
  await writeAudit({
    actorType: "staff",
    actorId: staff._id.toString(),
    actorName: staff.fullName,
    actorRole: staff.role,
    action: "settings.update",
    targetType: "settings",
    targetId: "default",
    result: "success",
  });
  return config.toObject();
}

export async function listAnnouncements() {
  const rows = await Announcement.find().sort({ createdAt: -1 });
  return rows.map((row) => ({
    id: row._id.toString(),
    title: row.title,
    titleFil: row.titleFil,
    body: row.body,
    bodyFil: row.bodyFil,
    active: row.active,
    createdAt: row.createdAt,
  }));
}

export async function createAnnouncement(staff: StaffDoc, input: { title: string; titleFil?: string; body: string; bodyFil?: string }) {
  const announcement = await Announcement.create({
    title: input.title.trim(),
    titleFil: input.titleFil?.trim() || input.title.trim(),
    body: input.body.trim(),
    bodyFil: input.bodyFil?.trim() || input.body.trim(),
    active: true,
  });
  const customers = await Customer.find({ status: "active" });
  if (customers.length) {
    await Notification.insertMany(
      customers
        .filter((customer) => customer.notificationPrefs?.inApp && customer.notificationPrefs.announcements)
        .map((customer) => ({
          customerId: customer._id,
          category: "announcement",
          title: announcement.title,
          titleFil: announcement.titleFil,
          body: announcement.body,
          bodyFil: announcement.bodyFil,
          read: false,
        })),
    );
  }
  await writeAudit({
    actorType: "staff",
    actorId: staff._id.toString(),
    actorName: staff.fullName,
    actorRole: staff.role,
    action: "announcement.create",
    targetType: "announcement",
    targetId: announcement._id.toString(),
    result: "success",
  });
  return { id: announcement._id.toString() };
}
