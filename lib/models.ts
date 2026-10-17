import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";

const noteSchema = new Schema(
  {
    text: { type: String, required: true },
    authorName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const notificationPrefsSchema = new Schema(
  {
    inApp: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    email: { type: Boolean, default: true },
    transactions: { type: Boolean, default: true },
    security: { type: Boolean, default: true },
    cards: { type: Boolean, default: true },
    announcements: { type: Boolean, default: true },
  },
  { _id: false },
);

const CustomerSchema = new Schema(
  {
    fullName: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    language: { type: String, enum: ["en", "fil"], default: "en" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    hideBalance: { type: Boolean, default: false },
    notificationPrefs: { type: notificationPrefsSchema, default: () => ({}) },
    notes: { type: [noteSchema], default: [] },
  },
  { timestamps: true },
);

const StaffSchema = new Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["support", "operations", "administrator", "security_admin"],
      required: true,
    },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    totpSecret: { type: String, required: true },
    language: { type: String, enum: ["en", "fil"], default: "en" },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const AccountSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    name: { type: String, required: true },
    accountNumber: { type: String, required: true, unique: true },
    type: { type: String, enum: ["savings", "current"], required: true },
    availableBalance: { type: Number, required: true },
    ledgerBalance: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    dailyTransferLimit: { type: Number, required: true },
  },
  { timestamps: true },
);

const cardLimitsSchema = new Schema(
  {
    dailySpend: { type: Number, required: true },
    atm: { type: Number, required: true },
    pos: { type: Number, required: true },
    online: { type: Number, required: true },
  },
  { _id: false },
);

const cardControlsSchema = new Schema(
  {
    online: { type: Boolean, default: true },
    atm: { type: Boolean, default: true },
    pos: { type: Boolean, default: true },
    international: { type: Boolean, default: false },
  },
  { _id: false },
);

const CardSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    pan: { type: String, required: true },
    holderName: { type: String, required: true },
    expiry: { type: String, required: true },
    type: { type: String, enum: ["debit"], default: "debit" },
    status: { type: String, enum: ["active", "frozen", "blocked"], default: "active" },
    balance: { type: Number, required: true },
    pinHash: { type: String, required: true },
    limits: { type: cardLimitsSchema, required: true },
    controls: { type: cardControlsSchema, default: () => ({}) },
    statusHistory: {
      type: [
        new Schema(
          {
            status: String,
            at: { type: Date, default: Date.now },
            by: String,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);

const BeneficiarySchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    name: { type: String, required: true },
    accountNumber: { type: String, required: true },
    bankName: { type: String, required: true },
    type: { type: String, enum: ["internal", "external"], required: true },
  },
  { timestamps: true },
);

const remarkSchema = new Schema(
  {
    text: { type: String, required: true },
    actorName: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const TransactionSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },
    groupId: { type: String, required: true, index: true },
    idempotencyKey: { type: String },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    type: {
      type: String,
      enum: [
        "transfer_own",
        "transfer_internal",
        "transfer_external",
        "bill_payment",
        "topup",
        "reversal",
        "incoming",
      ],
      required: true,
    },
    direction: { type: String, enum: ["debit", "credit"], required: true },
    amount: { type: Number, required: true },
    fee: { type: Number, default: 0 },
    currency: { type: String, required: true },
    status: {
      type: String,
      enum: ["initiated", "processing", "successful", "pending", "failed", "rejected", "reversed"],
      required: true,
    },
    description: { type: String, required: true },
    descriptionFil: { type: String, default: "" },
    sourceLabel: { type: String, default: "" },
    counterparty: { type: String, default: "" },
    remarks: { type: String, default: "" },
    failureReason: { type: String, default: "" },
    debited: { type: Boolean, default: false },
    billerId: { type: Schema.Types.ObjectId, ref: "Biller" },
    providerId: { type: Schema.Types.ObjectId, ref: "Provider" },
    operationalRemarks: { type: [remarkSchema], default: [] },
  },
  { timestamps: true },
);

TransactionSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

const BillerSchema = new Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    referenceLabel: { type: String, required: true },
    fee: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },
    integrationStatus: { type: String, enum: ["healthy", "degraded", "down"], default: "healthy" },
  },
  { timestamps: true },
);

const ProviderSchema = new Schema(
  {
    name: { type: String, required: true },
    prefixes: { type: [String], required: true },
    amounts: { type: [Number], required: true },
    fee: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },
    integrationStatus: { type: String, enum: ["healthy", "degraded", "down"], default: "healthy" },
  },
  { timestamps: true },
);

const NotificationSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    category: {
      type: String,
      enum: ["transaction", "payment", "card", "security", "request", "announcement"],
      required: true,
    },
    title: { type: String, required: true },
    titleFil: { type: String, default: "" },
    body: { type: String, required: true },
    bodyFil: { type: String, default: "" },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const requestHistorySchema = new Schema(
  {
    status: { type: String, required: true },
    remarks: { type: String, default: "" },
    officerName: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ServiceRequestSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    type: {
      type: String,
      enum: [
        "new_card",
        "replacement_card",
        "card_activation",
        "account",
        "card_limit",
        "profile_change",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ["submitted", "under_review", "approved", "rejected", "completed", "cancelled"],
      default: "submitted",
    },
    payload: { type: Schema.Types.Mixed, default: {} },
    assignedOfficerName: { type: String, default: "" },
    history: { type: [requestHistorySchema], default: [] },
  },
  { timestamps: true },
);

const ApprovalSchema = new Schema(
  {
    type: { type: String, enum: ["reversal", "role_change", "role_grant"], required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    requestedBy: { type: Schema.Types.ObjectId, ref: "Staff", required: true },
    requestedByName: { type: String, required: true },
    requestedByRole: { type: String, required: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: "Staff" },
    decidedByName: { type: String, default: "" },
    payload: { type: Schema.Types.Mixed, required: true },
    remarks: { type: String, default: "" },
    decisionRemarks: { type: String, default: "" },
    decidedAt: { type: Date },
  },
  { timestamps: true },
);

const AuditSchema = new Schema(
  {
    actorType: { type: String, enum: ["customer", "staff", "system"], required: true },
    actorId: { type: String, default: "" },
    actorName: { type: String, default: "" },
    actorRole: { type: String, default: "" },
    action: { type: String, required: true, index: true },
    targetType: { type: String, required: true },
    targetId: { type: String, default: "" },
    result: { type: String, enum: ["success", "failure"], required: true },
    remarks: { type: String, default: "" },
    reference: { type: String, default: "" },
  },
  { timestamps: true },
);

const AnnouncementSchema = new Schema(
  {
    title: { type: String, required: true },
    titleFil: { type: String, default: "" },
    body: { type: String, required: true },
    bodyFil: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const SettingsSchema = new Schema(
  {
    key: { type: String, default: "default", unique: true },
    currency: { type: String, default: "SDG" },
    transferFeeInternal: { type: Number, default: 0 },
    transferFeeExternal: { type: Number, default: 25 },
    dailyTransferLimit: { type: Number, default: 500000 },
    maxCardLimit: { type: Number, default: 500000 },
    sessionTimeoutMinutes: { type: Number, default: 30 },
    maxFailedLogins: { type: Number, default: 5 },
    lockoutMinutes: { type: Number, default: 15 },
  },
  { timestamps: true },
);

function register<T>(name: string, schema: Schema<T>) {
  return (mongoose.models[name] as mongoose.Model<T>) || mongoose.model<T>(name, schema);
}

export const Customer = register("Customer", CustomerSchema);
export const Staff = register("Staff", StaffSchema);
export const Account = register("Account", AccountSchema);
export const Card = register("Card", CardSchema);
export const Beneficiary = register("Beneficiary", BeneficiarySchema);
export const Transaction = register("Transaction", TransactionSchema);
export const Biller = register("Biller", BillerSchema);
export const Provider = register("Provider", ProviderSchema);
export const Notification = register("Notification", NotificationSchema);
export const ServiceRequest = register("ServiceRequest", ServiceRequestSchema);
export const Approval = register("Approval", ApprovalSchema);
export const AuditLog = register("AuditLog", AuditSchema);
export const Announcement = register("Announcement", AnnouncementSchema);
export const Settings = register("Settings", SettingsSchema);

export type CustomerDoc = InferSchemaType<typeof CustomerSchema> & {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};
export type StaffDoc = InferSchemaType<typeof StaffSchema> & { _id: Types.ObjectId };
export type AccountDoc = InferSchemaType<typeof AccountSchema> & { _id: Types.ObjectId };
export type CardDoc = InferSchemaType<typeof CardSchema> & { _id: Types.ObjectId };
export type SettingsDoc = InferSchemaType<typeof SettingsSchema> & { _id: Types.ObjectId };
