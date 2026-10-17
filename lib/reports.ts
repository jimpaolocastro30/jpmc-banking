import { Account, AuditLog, Biller, Card, Customer, Provider, ServiceRequest, Transaction } from "@/lib/models";
import { maskAccount, maskCard } from "@/lib/money";

function range(from?: Date, to?: Date) {
  if (!from && !to) return {};
  return {
    createdAt: {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    },
  };
}

export async function buildReport(type: string, from?: Date, to?: Date) {
  if (type === "transaction_summary") {
    const rows = await Transaction.aggregate<{ _id: { type: string; status: string }; count: number; amount: number }>([
      { $match: range(from, to) },
      { $group: { _id: { type: "$type", status: "$status" }, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
      { $sort: { "_id.type": 1 } },
    ]);
    return rows.map((row) => ({ type: row._id.type, status: row._id.status, count: row.count, amount: row.amount }));
  }
  if (type === "failed_transactions") {
    const rows = await Transaction.find({ status: "failed", ...range(from, to) }).sort({ createdAt: -1 }).limit(200);
    return rows.map((row) => ({
      reference: row.reference,
      type: row.type,
      amount: row.amount,
      currency: row.currency,
      reason: row.failureReason,
      createdAt: row.createdAt?.toISOString() ?? "",
    }));
  }
  if (type === "accounts") {
    const accounts = await Account.find().limit(200);
    const owners = await Customer.find({ _id: { $in: accounts.map((account) => account.customerId) } });
    const names = new Map(owners.map((owner) => [owner._id.toString(), owner.fullName]));
    return accounts.map((account) => ({
      customer: names.get(account.customerId.toString()) ?? "",
      account: maskAccount(account.accountNumber),
      type: account.type,
      status: account.status,
      currency: account.currency,
      available: account.availableBalance,
      ledger: account.ledgerBalance,
    }));
  }
  if (type === "cards") {
    const cards = await Card.find().limit(200);
    return cards.map((card) => ({
      holder: card.holderName,
      card: maskCard(card.pan),
      status: card.status,
      expiry: card.expiry,
    }));
  }
  if (type === "bill_payments") {
    const rows = await Transaction.find({ type: "bill_payment", ...range(from, to) }).sort({ createdAt: -1 }).limit(200);
    return rows.map((row) => ({
      reference: row.reference,
      biller: row.counterparty,
      amount: row.amount,
      fee: row.fee,
      status: row.status,
      createdAt: row.createdAt?.toISOString() ?? "",
    }));
  }
  if (type === "service_requests") {
    const rows = await ServiceRequest.find(range(from, to)).sort({ createdAt: -1 }).limit(200);
    return rows.map((row) => ({
      reference: row.reference,
      type: row.type,
      status: row.status,
      officer: row.assignedOfficerName,
      createdAt: row.createdAt?.toISOString() ?? "",
    }));
  }
  if (type === "admin_activity") {
    const rows = await AuditLog.find({ actorType: "staff", ...range(from, to) }).sort({ createdAt: -1 }).limit(200);
    return rows.map((row) => ({
      actor: row.actorName,
      role: row.actorRole,
      action: row.action,
      result: row.result,
      reference: row.reference,
      createdAt: row.createdAt?.toISOString() ?? "",
    }));
  }
  return null;
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      headers
        .map((header) => {
          const value = row[header] == null ? "" : String(row[header]);
          return `"${value.replaceAll('"', '""')}"`;
        })
        .join(","),
    );
  }
  return lines.join("\n");
}
