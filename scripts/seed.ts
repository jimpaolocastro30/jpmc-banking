import { hash } from "bcryptjs";
import { existsSync, readFileSync } from "fs";
import { authenticator } from "otplib";
import { connectDb } from "../lib/db";
import {
  Account,
  Announcement,
  AuditLog,
  Beneficiary,
  Biller,
  Card,
  Customer,
  Notification,
  Provider,
  ServiceRequest,
  Settings,
  Staff,
  Transaction,
} from "../lib/models";

const DEMO_PASSWORD = "Bankak#2026";
const DEMO_TOTP = "JBSWY3DPEHPK3PXP";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index < 1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

async function main() {
  loadEnv();
  await connectDb();
  await Promise.all([
    Customer.deleteMany({}),
    Staff.deleteMany({}),
    Account.deleteMany({}),
    Card.deleteMany({}),
    Beneficiary.deleteMany({}),
    Transaction.deleteMany({}),
    Biller.deleteMany({}),
    Provider.deleteMany({}),
    Notification.deleteMany({}),
    ServiceRequest.deleteMany({}),
    AuditLog.deleteMany({}),
    Announcement.deleteMany({}),
    Settings.deleteMany({}),
  ]);

  await Settings.create({ key: "default", currency: "SDG" });
  const passwordHash = await hash(DEMO_PASSWORD, 10);
  const pinHash = await hash("1234", 10);
  const limits = { dailySpend: 200000, atm: 50000, pos: 100000, online: 100000 };

  const amal = await Customer.create({
    fullName: "Amal Hassan",
    mobile: "+249900000001",
    email: "amal.hassan@bankak.demo",
    passwordHash,
    language: "en",
  });
  const yusuf = await Customer.create({
    fullName: "Yusuf Ibrahim",
    mobile: "+249900000002",
    email: "yusuf.ibrahim@bankak.demo",
    passwordHash,
    language: "fil",
  });

  const amalSavings = await Account.create({
    customerId: amal._id,
    name: "Savings",
    accountNumber: "1002452188334521",
    type: "savings",
    availableBalance: 1250000,
    ledgerBalance: 1250000,
    currency: "SDG",
    dailyTransferLimit: 500000,
  });
  const amalCurrent = await Account.create({
    customerId: amal._id,
    name: "Current",
    accountNumber: "1002452188337780",
    type: "current",
    availableBalance: 86400.5,
    ledgerBalance: 86400.5,
    currency: "SDG",
    dailyTransferLimit: 200000,
  });
  await Account.create({
    customerId: yusuf._id,
    name: "Savings",
    accountNumber: "1002881100221190",
    type: "savings",
    availableBalance: 640000,
    ledgerBalance: 640000,
    currency: "SDG",
    dailyTransferLimit: 500000,
  });

  const amalCard = await Card.create({
    customerId: amal._id,
    accountId: amalSavings._id,
    pan: "4532111122224521",
    holderName: "AMAL HASSAN",
    expiry: "09/28",
    balance: 1250000,
    pinHash,
    limits,
    controls: { online: true, atm: true, pos: true, international: false },
    statusHistory: [{ status: "active", at: new Date(), by: "System" }],
  });
  const frozenCard = await Card.create({
    customerId: amal._id,
    accountId: amalCurrent._id,
    pan: "4532111122227780",
    holderName: "AMAL HASSAN",
    expiry: "04/27",
    status: "frozen",
    balance: 86400.5,
    pinHash,
    limits,
    controls: { online: false, atm: true, pos: true, international: false },
    statusHistory: [{ status: "frozen", at: new Date(), by: "Amal Hassan" }],
  });
  await Card.create({
    customerId: yusuf._id,
    accountId: (await Account.findOne({ accountNumber: "1002881100221190" }))!._id,
    pan: "4532111122221190",
    holderName: "YUSUF IBRAHIM",
    expiry: "12/28",
    balance: 640000,
    pinHash,
    limits,
    statusHistory: [{ status: "active", at: new Date(), by: "System" }],
  });

  await Beneficiary.create({
    customerId: amal._id,
    name: "Yusuf Ibrahim",
    accountNumber: "1002881100221190",
    bankName: "Bankak",
    type: "internal",
  });

  const day = 86400000;
  const now = Date.now();
  await Transaction.create([
    {
      reference: "BKSEED000001",
      groupId: "GSEED000001",
      customerId: amal._id,
      accountId: amalSavings._id,
      type: "incoming",
      direction: "credit",
      amount: 450000,
      fee: 0,
      currency: "SDG",
      status: "successful",
      description: "Salary - Northline",
      descriptionFil: "Sahod - Northline",
      sourceLabel: "Northline Payroll",
      counterparty: "Northline",
      debited: false,
      createdAt: new Date(now - 3 * day),
    },
    {
      reference: "BKSEED000002",
      groupId: "GSEED000002",
      customerId: amal._id,
      accountId: amalSavings._id,
      type: "bill_payment",
      direction: "debit",
      amount: 8200,
      fee: 0,
      currency: "SDG",
      status: "successful",
      description: "NEC Electricity",
      descriptionFil: "NEC Electricity",
      sourceLabel: "Savings · ****4521",
      counterparty: "NEC Electricity · 4401982",
      debited: true,
      createdAt: new Date(now - 2 * day),
    },
    {
      reference: "BKSEED000003",
      groupId: "GSEED000003",
      customerId: amal._id,
      accountId: amalSavings._id,
      type: "transfer_external",
      direction: "debit",
      amount: 15000,
      fee: 25,
      currency: "SDG",
      status: "pending",
      description: "External transfer - Omdurman Bank",
      descriptionFil: "External transfer - Omdurman Bank",
      sourceLabel: "Savings · ****4521",
      counterparty: "Hiba Ali · Omdurman Bank · ****6612",
      debited: true,
      createdAt: new Date(now - day),
    },
    {
      reference: "BKSEED000004",
      groupId: "GSEED000004",
      customerId: amal._id,
      accountId: amalCurrent._id,
      type: "topup",
      direction: "debit",
      amount: 5000,
      fee: 0,
      currency: "SDG",
      status: "failed",
      failureReason: "SWITCH_DECLINED",
      description: "Zain top-up",
      descriptionFil: "Zain load",
      sourceLabel: "Current · ****7780",
      counterparty: "Zain · 0912000111",
      debited: false,
      createdAt: new Date(now - 6 * 60 * 60 * 1000),
    },
  ]);

  await Notification.create({
    customerId: amal._id,
    category: "transaction",
    title: "Salary received",
    titleFil: "Natanggap ang sahod",
    body: "SDG 450,000.00 was credited to Savings.",
    bodyFil: "Na-credit ang SDG 450,000.00 sa Savings.",
    read: false,
  });

  await ServiceRequest.create({
    reference: "SRSEED000001",
    customerId: amal._id,
    type: "replacement_card",
    status: "under_review",
    payload: { cardId: frozenCard._id.toString(), note: "Card damaged" },
    assignedOfficerName: "Sara Osman",
    history: [
      { status: "submitted", remarks: "Card damaged", officerName: "Amal Hassan", at: new Date(now - day) },
      { status: "under_review", remarks: "Waiting for branch confirmation", officerName: "Sara Osman", at: new Date() },
    ],
  });

  await Biller.create([
    { name: "NEC Electricity", category: "Utilities", referenceLabel: "Meter number", fee: 0 },
    { name: "Khartoum Water", category: "Utilities", referenceLabel: "Account number", fee: 0 },
    { name: "Sudatel Internet", category: "Telecom", referenceLabel: "Customer ID", fee: 10 },
  ]);
  await Provider.create([
    { name: "Zain", prefixes: ["091", "099"], amounts: [500, 1000, 2000, 5000, 10000], fee: 0 },
    { name: "MTN", prefixes: ["092", "099"], amounts: [500, 1000, 2000, 5000, 10000], fee: 0 },
    { name: "Sudani", prefixes: ["012"], amounts: [500, 1000, 2000, 5000], fee: 0 },
  ]);

  const staff = [
    ["Sara Osman", "support@bankak.demo", "support"],
    ["Hassan Malik", "operations@bankak.demo", "operations"],
    ["Leila Farouk", "admin@bankak.demo", "administrator"],
    ["Omar Nadir", "security@bankak.demo", "security_admin"],
  ] as const;
  for (const [fullName, email, role] of staff) {
    await Staff.create({ fullName, email, passwordHash, role, totpSecret: DEMO_TOTP, status: "active" });
  }

  await Announcement.create({
    title: "Branch hours",
    titleFil: "Oras ng sangay",
    body: "Khartoum main branch is open Saturday to Thursday, 8:00 to 16:00.",
    bodyFil: "Bukas ang pangunahing sangay sa Khartoum mula Sabado hanggang Huwebes, 8:00 hanggang 16:00.",
    active: true,
  });

  console.log("Seeded Bankak demo data");
  console.log(`Customer password: ${DEMO_PASSWORD}`);
  console.log("amal.hassan@bankak.demo  +249900000001");
  console.log("yusuf.ibrahim@bankak.demo  +249900000002");
  console.log("Staff: support@, operations@, admin@, security@ bankak.demo");
  console.log(`Demo TOTP secret: ${DEMO_TOTP}`);
  console.log(authenticator.keyuri("admin@bankak.demo", "Bankak Admin", DEMO_TOTP));
  console.log(`Card PIN for demo cards: 1234`);
  console.log(`Active card id: ${amalCard._id.toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
