import { z } from "zod";
import {
  addCustomerNote,
  addRemark,
  adminDashboard,
  createAnnouncement,
  createStaff,
  decideApproval,
  exportReport,
  getCustomer,
  getReport,
  listAnnouncements,
  listApprovals,
  listAudit,
  listBillersAdmin,
  listProvidersAdmin,
  listServiceRequests,
  listStaff,
  requestReversal,
  resolvePending,
  retryTransaction,
  saveBiller,
  saveProvider,
  searchAccounts,
  searchCards,
  searchCustomers,
  searchTransactions,
  setAccountStatus,
  setCardStatus,
  updateBankSettings,
  updateCustomer,
  updateServiceRequest,
  updateStaff,
} from "@/lib/admin";
import { currentStaff } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { handle, json, queryDate, queryNumber, readBody } from "@/lib/http";
import { getSettings } from "@/lib/settings";
import { STAFF_ROLES, type Permission } from "@/lib/rbac";

const integration = z.enum(["healthy", "degraded", "down"]);

async function dispatch(request: Request, slug: string[]) {
  const key = slug.join("/");
  const url = new URL(request.url);
  const method = request.method;
  const guard = (permission?: Permission) => currentStaff(permission);

  if (method === "GET" && key === "dashboard") {
    const { staff } = await guard();
    return adminDashboard(queryDate(url, "from"), queryDate(url, "to", true));
  }
  if (method === "GET" && key === "customers") {
    await guard("customers.read");
    return searchCustomers(url.searchParams.get("q") ?? "");
  }
  if (method === "GET" && /^customers\/[^/]+$/.test(key)) {
    const { staff } = await guard("customers.read");
    return getCustomer(slug[1], staff.role);
  }
  if (method === "PATCH" && /^customers\/[^/]+$/.test(key)) {
    const { staff } = await guard("customers.read");
    const body = await readBody(
      request,
      z.object({
        fullName: z.string().min(2).optional(),
        email: z.string().email().optional(),
        mobile: z.string().min(8).optional(),
        status: z.enum(["active", "inactive"]).optional(),
      }),
    );
    return updateCustomer(staff, slug[1], body);
  }
  if (method === "POST" && /^customers\/[^/]+\/notes$/.test(key)) {
    const { staff } = await guard("customers.note");
    const body = await readBody(request, z.object({ text: z.string().min(2).max(500) }));
    return addCustomerNote(staff, slug[1], body.text);
  }
  if (method === "GET" && key === "accounts") {
    const { staff } = await guard("accounts.read");
    return searchAccounts(staff.role, url.searchParams.get("q") ?? "");
  }
  if (method === "PATCH" && /^accounts\/[^/]+$/.test(key)) {
    const { staff } = await guard("accounts.status");
    const body = await readBody(request, z.object({ status: z.enum(["active", "inactive"]), remarks: z.string().optional() }));
    return setAccountStatus(staff, slug[1], body.status, body.remarks ?? "");
  }
  if (method === "GET" && key === "cards") {
    const { staff } = await guard("cards.read");
    return searchCards(staff.role, url.searchParams.get("q") ?? "");
  }
  if (method === "PATCH" && /^cards\/[^/]+$/.test(key)) {
    const { staff } = await guard("cards.status");
    const body = await readBody(
      request,
      z.object({ status: z.enum(["active", "frozen", "blocked"]), remarks: z.string().optional() }),
    );
    return setCardStatus(staff, slug[1], body.status, body.remarks ?? "");
  }
  if (method === "GET" && key === "transactions") {
    await guard("transactions.read");
    return searchTransactions({
      reference: url.searchParams.get("reference") ?? undefined,
      customerId: url.searchParams.get("customerId") ?? undefined,
      accountId: url.searchParams.get("accountId") ?? undefined,
      type: url.searchParams.get("type") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      from: queryDate(url, "from"),
      to: queryDate(url, "to", true),
      minAmount: queryNumber(url, "minAmount"),
      maxAmount: queryNumber(url, "maxAmount"),
    });
  }
  if (method === "POST" && /^transactions\/[^/]+\/remark$/.test(key)) {
    const { staff } = await guard("transactions.operate");
    const body = await readBody(request, z.object({ text: z.string().min(2).max(300) }));
    return addRemark(staff, slug[1], body.text);
  }
  if (method === "POST" && /^transactions\/[^/]+\/retry$/.test(key)) {
    const { staff } = await guard("transactions.operate");
    const body = await readBody(request, z.object({ remarks: z.string().optional() }));
    return retryTransaction(staff, slug[1], body.remarks ?? "");
  }
  if (method === "POST" && /^transactions\/[^/]+\/resolve$/.test(key)) {
    const { staff } = await guard("transactions.operate");
    const body = await readBody(request, z.object({ outcome: z.enum(["successful", "failed"]), remarks: z.string().optional() }));
    return resolvePending(staff, slug[1], body.outcome, body.remarks ?? "");
  }
  if (method === "POST" && /^transactions\/[^/]+\/reversal$/.test(key)) {
    const { staff } = await guard("transactions.reverse.request");
    const body = await readBody(request, z.object({ reason: z.string().min(3).max(300) }));
    return requestReversal(staff, slug[1], body.reason);
  }
  if (method === "GET" && key === "approvals") {
    const { staff } = await guard();
    return listApprovals(staff);
  }
  if (method === "POST" && /^approvals\/[^/]+$/.test(key)) {
    const { staff } = await guard();
    const body = await readBody(request, z.object({ decision: z.enum(["approved", "rejected"]), remarks: z.string().optional() }));
    return decideApproval(staff, slug[1], body.decision, body.remarks ?? "");
  }
  if (method === "GET" && key === "billers") {
    await guard("billers.manage");
    return listBillersAdmin();
  }
  if (method === "POST" && key === "billers") {
    const { staff } = await guard("billers.manage");
    const body = await readBody(
      request,
      z.object({
        id: z.string().optional(),
        name: z.string().min(2),
        category: z.string().min(2),
        referenceLabel: z.string().min(2),
        fee: z.number().min(0),
        enabled: z.boolean(),
        integrationStatus: integration,
      }),
    );
    return saveBiller(staff, body);
  }
  if (method === "GET" && key === "providers") {
    await guard("billers.manage");
    return listProvidersAdmin();
  }
  if (method === "POST" && key === "providers") {
    const { staff } = await guard("billers.manage");
    const body = await readBody(
      request,
      z.object({
        id: z.string().optional(),
        name: z.string().min(2),
        prefixes: z.array(z.string()).min(1),
        amounts: z.array(z.number().positive()).min(1),
        fee: z.number().min(0),
        enabled: z.boolean(),
        integrationStatus: integration,
      }),
    );
    return saveProvider(staff, body);
  }
  if (method === "GET" && key === "requests") {
    await guard("requests.manage");
    return listServiceRequests(url.searchParams.get("status") ?? undefined);
  }
  if (method === "PATCH" && /^requests\/[^/]+$/.test(key)) {
    const { staff } = await guard("requests.manage");
    const body = await readBody(
      request,
      z.object({
        status: z.enum(["submitted", "under_review", "approved", "rejected", "completed", "cancelled"]),
        remarks: z.string().optional(),
      }),
    );
    return updateServiceRequest(staff, slug[1], body.status, body.remarks ?? "");
  }
  if (method === "GET" && key === "users") {
    await guard("users.manage");
    return listStaff();
  }
  if (method === "POST" && key === "users") {
    const { staff } = await guard("users.manage");
    const body = await readBody(
      request,
      z.object({
        fullName: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8),
        role: z.enum(STAFF_ROLES),
      }),
    );
    return createStaff(staff, body);
  }
  if (method === "PATCH" && /^users\/[^/]+$/.test(key)) {
    const { staff } = await guard("users.manage");
    const body = await readBody(
      request,
      z.object({
        role: z.enum(STAFF_ROLES).optional(),
        status: z.enum(["active", "suspended"]).optional(),
        resetPassword: z.boolean().optional(),
      }),
    );
    return updateStaff(staff, slug[1], body);
  }
  if (method === "GET" && key === "reports") {
    await guard("reports.read");
    const type = url.searchParams.get("type") ?? "";
    return getReport(type, queryDate(url, "from"), queryDate(url, "to", true));
  }
  if (method === "GET" && key === "reports/export") {
    const { staff } = await guard("reports.export");
    const type = url.searchParams.get("type") ?? "";
    const csv = await exportReport(staff, type, queryDate(url, "from"), queryDate(url, "to", true));
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${type}.csv"`,
      },
    });
  }
  if (method === "GET" && key === "audit") {
    const { staff } = await guard();
    if (!staff) throw new HttpError(401, "UNAUTHORIZED");
    return listAudit(staff, url.searchParams.get("action") ?? undefined);
  }
  if (method === "GET" && key === "settings") {
    const { staff } = await guard();
    if (staff.role !== "administrator" && staff.role !== "security_admin") throw new HttpError(403, "FORBIDDEN");
    const settings = await getSettings();
    return {
      currency: settings.currency,
      transferFeeInternal: settings.transferFeeInternal,
      transferFeeExternal: settings.transferFeeExternal,
      dailyTransferLimit: settings.dailyTransferLimit,
      maxCardLimit: settings.maxCardLimit,
      sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
      maxFailedLogins: settings.maxFailedLogins,
      lockoutMinutes: settings.lockoutMinutes,
    };
  }
  if (method === "PATCH" && key === "settings") {
    const { staff } = await guard();
    const body = await readBody(
      request,
      z.object({
        currency: z.string().min(3).max(3).optional(),
        transferFeeInternal: z.number().min(0).optional(),
        transferFeeExternal: z.number().min(0).optional(),
        dailyTransferLimit: z.number().positive().optional(),
        maxCardLimit: z.number().positive().optional(),
        sessionTimeoutMinutes: z.number().int().min(5).max(240).optional(),
        maxFailedLogins: z.number().int().min(3).max(10).optional(),
        lockoutMinutes: z.number().int().min(1).max(120).optional(),
      }),
    );
    return updateBankSettings(staff, body);
  }
  if (method === "GET" && key === "announcements") {
    await guard("announcements.manage");
    return listAnnouncements();
  }
  if (method === "POST" && key === "announcements") {
    const { staff } = await guard("announcements.manage");
    const body = await readBody(
      request,
      z.object({
        title: z.string().min(2),
        titleFil: z.string().optional(),
        body: z.string().min(2),
        bodyFil: z.string().optional(),
      }),
    );
    return createAnnouncement(staff, body);
  }
  throw new HttpError(404, "NOT_FOUND");
}

async function entry(request: Request, context: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await context.params;
  if (slug.join("/") === "reports/export") {
    try {
      const result = await dispatch(request, slug);
      return result instanceof Response ? result : json(result);
    } catch (error) {
      const { handleError } = await import("@/lib/errors");
      return handleError(error);
    }
  }
  return handle(() => dispatch(request, slug));
}

export const GET = entry;
export const POST = entry;
export const PATCH = entry;
