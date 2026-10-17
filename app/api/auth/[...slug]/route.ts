import { authenticator } from "otplib";
import { z } from "zod";
import { currentCustomer, loginCustomer, logoutCustomer, publicCustomer } from "@/lib/auth";
import { currentStaff, loginStaff, logoutStaff, publicStaff, verifyStaffMfa } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { handle, readBody } from "@/lib/http";
import { Notification } from "@/lib/models";
import { getSettings } from "@/lib/settings";

const credentials = z.object({
  identifier: z.string().min(3).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8),
});

export async function POST(request: Request, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const key = slug.join("/");
  return handle(async () => {
    if (key === "customer/login") {
      const body = await readBody(request, credentials.extend({ identifier: z.string().min(3) }));
      return loginCustomer(body.identifier, body.password);
    }
    if (key === "customer/logout") {
      await logoutCustomer();
      return { ok: true };
    }
    if (key === "admin/login") {
      const body = await readBody(request, z.object({ email: z.string().email(), password: z.string().min(8) }));
      return loginStaff(body.email, body.password);
    }
    if (key === "admin/mfa") {
      const body = await readBody(request, z.object({ mfaToken: z.string().min(10), code: z.string().min(6).max(6) }));
      return verifyStaffMfa(body.mfaToken, body.code);
    }
    if (key === "admin/logout") {
      await logoutStaff();
      return { ok: true };
    }
    throw new HttpError(404, "NOT_FOUND");
  });
}

export async function GET(_request: Request, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const key = slug.join("/");
  return handle(async () => {
    if (key === "customer/me") {
      const { customer } = await currentCustomer();
      const [settings, unread] = await Promise.all([
        getSettings(),
        Notification.countDocuments({ customerId: customer._id, read: false }),
      ]);
      return { ...publicCustomer(customer), currency: settings.currency, unread };
    }
    if (key === "admin/demo-code") {
      return { code: authenticator.generate("JBSWY3DPEHPK3PXP"), secondsRemaining: authenticator.timeRemaining() };
    }
    if (key === "admin/me") {
      const { staff } = await currentStaff();
      const settings = await getSettings();
      return { ...publicStaff(staff), currency: settings.currency, sessionTimeoutMinutes: settings.sessionTimeoutMinutes };
    }
    throw new HttpError(404, "NOT_FOUND");
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const key = slug.join("/");
  return handle(async () => {
    if (key === "admin/me") {
      const { staff } = await currentStaff();
      const body = await readBody(request, z.object({ language: z.enum(["en", "fil"]) }));
      staff.language = body.language;
      await staff.save();
      return publicStaff(staff);
    }
    throw new HttpError(404, "NOT_FOUND");
  });
}
