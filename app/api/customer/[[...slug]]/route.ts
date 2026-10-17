import { z } from "zod";
import {
  changeCardStatus,
  changePin,
  createCardRequest,
  dashboard,
  executeTransfer,
  getAccount,
  getCard,
  getTransaction,
  listAccounts,
  listActivity,
  listBeneficiaries,
  listBillers,
  listCards,
  listNotifications,
  listProviders,
  listRequests,
  listTransactions,
  markNotificationsRead,
  payBill,
  previewTransfer,
  requestLimit,
  setHideBalance,
  topUp,
  updateControls,
  updateProfile,
  updateSensitive,
} from "@/lib/banking";
import { currentCustomer, publicCustomer } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { handle, queryDate, readBody } from "@/lib/http";

const transferSchema = z.object({
  type: z.enum(["own", "internal", "external"]),
  sourceAccountId: z.string(),
  destinationAccountId: z.string().optional(),
  beneficiaryId: z.string().optional(),
  destinationAccountNumber: z.string().optional(),
  destinationName: z.string().optional(),
  bankName: z.string().optional(),
  amount: z.number().positive(),
  remarks: z.string().max(140).optional(),
  saveBeneficiary: z.boolean().optional(),
});

const limitsSchema = z.object({
  dailySpend: z.number().positive(),
  atm: z.number().positive(),
  pos: z.number().positive(),
  online: z.number().positive(),
});

async function dispatch(request: Request, slug: string[]) {
  const { customer } = await currentCustomer();
  const key = slug.join("/");
  const url = new URL(request.url);
  const method = request.method;

  if (method === "GET" && key === "dashboard") return dashboard(customer);
  if (method === "GET" && key === "accounts") return listAccounts(customer._id);
  if (method === "GET" && /^accounts\/[^/]+$/.test(key)) return getAccount(customer._id, slug[1]);
  if (method === "GET" && /^accounts\/[^/]+\/transactions$/.test(key)) {
    return listTransactions(customer._id, {
      accountId: slug[1],
      type: url.searchParams.get("type") || undefined,
      status: url.searchParams.get("status") || undefined,
      from: queryDate(url, "from"),
      to: queryDate(url, "to", true),
    });
  }
  if (method === "GET" && /^transactions\/[^/]+$/.test(key)) return getTransaction(customer._id, slug[1]);
  if (method === "GET" && key === "beneficiaries") return listBeneficiaries(customer._id);
  if (method === "GET" && key === "billers") return listBillers();
  if (method === "GET" && key === "providers") return listProviders();
  if (method === "GET" && key === "payments") {
    return listTransactions(customer._id, {
      paymentsOnly: true,
      from: queryDate(url, "from"),
      to: queryDate(url, "to", true),
    });
  }
  if (method === "GET" && key === "cards") return listCards(customer._id);
  if (method === "GET" && /^cards\/[^/]+$/.test(key)) return getCard(customer._id, slug[1]);
  if (method === "GET" && key === "notifications") return listNotifications(customer._id);
  if (method === "GET" && key === "requests") return listRequests(customer._id);
  if (method === "GET" && key === "activity") return listActivity(customer._id.toString());

  if (method === "POST" && key === "transfers/preview") {
    return previewTransfer(customer, await readBody(request, transferSchema));
  }
  if (method === "POST" && key === "transfers") {
    const body = await readBody(request, transferSchema.extend({ password: z.string().min(8), idempotencyKey: z.string().min(8) }));
    const { password, idempotencyKey, ...input } = body;
    return executeTransfer(customer, input, password, idempotencyKey);
  }
  if (method === "POST" && key === "payments") {
    const body = await readBody(
      request,
      z.object({
        billerId: z.string(),
        referenceNumber: z.string().min(4),
        amount: z.number().positive(),
        sourceAccountId: z.string(),
        password: z.string().min(8),
        idempotencyKey: z.string().min(8),
      }),
    );
    return payBill(customer, body);
  }
  if (method === "POST" && key === "topup") {
    const body = await readBody(
      request,
      z.object({
        providerId: z.string(),
        mobile: z.string().min(10),
        amount: z.number().positive(),
        sourceAccountId: z.string(),
        password: z.string().min(8),
        idempotencyKey: z.string().min(8),
      }),
    );
    return topUp(customer, body);
  }
  if (method === "POST" && /^cards\/[^/]+\/status$/.test(key)) {
    const body = await readBody(request, z.object({ action: z.enum(["freeze", "unfreeze", "block"]), password: z.string().min(8) }));
    return changeCardStatus(customer, slug[1], body.action, body.password);
  }
  if (method === "POST" && /^cards\/[^/]+\/pin$/.test(key)) {
    const body = await readBody(
      request,
      z.object({ currentPin: z.string().length(4), newPin: z.string().length(4), password: z.string().min(8) }),
    );
    return changePin(customer, slug[1], body.currentPin, body.newPin, body.password);
  }
  if (method === "POST" && /^cards\/[^/]+\/controls$/.test(key)) {
    const body = await readBody(
      request,
      z.object({
        online: z.boolean(),
        atm: z.boolean(),
        pos: z.boolean(),
        international: z.boolean(),
        password: z.string().min(8),
      }),
    );
    const { password, ...controls } = body;
    return updateControls(customer, slug[1], controls, password);
  }
  if (method === "POST" && /^cards\/[^/]+\/limits$/.test(key)) {
    const body = await readBody(request, limitsSchema.extend({ password: z.string().min(8) }));
    const { password, ...limits } = body;
    return requestLimit(customer, slug[1], limits, password);
  }
  if (method === "POST" && key === "requests") {
    const body = await readBody(
      request,
      z.object({
        type: z.enum(["new_card", "replacement_card", "card_activation"]),
        cardId: z.string().optional(),
        note: z.string().max(240).optional(),
        password: z.string().min(8),
      }),
    );
    return createCardRequest(customer, body);
  }
  if (method === "POST" && key === "notifications/read") {
    const body = await readBody(request, z.object({ ids: z.array(z.string()).optional() }));
    return markNotificationsRead(customer._id, body.ids);
  }
  if (method === "PATCH" && key === "profile") {
    const body = await readBody(
      request,
      z.object({
        fullName: z.string().min(2).optional(),
        language: z.enum(["en", "fil"]).optional(),
        notificationPrefs: z
          .object({
            inApp: z.boolean(),
            push: z.boolean(),
            sms: z.boolean(),
            email: z.boolean(),
            transactions: z.boolean(),
            security: z.boolean(),
            cards: z.boolean(),
            announcements: z.boolean(),
          })
          .optional(),
      }),
    );
    const saved = await updateProfile(customer, body);
    return publicCustomer(saved);
  }
  if (method === "POST" && key === "profile/sensitive") {
    const body = await readBody(
      request,
      z.object({ email: z.string().email().optional(), mobile: z.string().min(8).optional(), password: z.string().min(8) }),
    );
    const saved = await updateSensitive(customer, body);
    return publicCustomer(saved);
  }
  if (method === "PATCH" && key === "preferences") {
    const body = await readBody(request, z.object({ hideBalance: z.boolean() }));
    return setHideBalance(customer, body.hideBalance);
  }
  throw new HttpError(404, "NOT_FOUND");
}

async function entry(request: Request, context: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await context.params;
  return handle(() => dispatch(request, slug));
}

export const GET = entry;
export const POST = entry;
export const PATCH = entry;
