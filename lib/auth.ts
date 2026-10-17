import { compare, hash } from "bcryptjs";
import { cookies } from "next/headers";
import { writeAudit } from "@/lib/audit";
import { connectDb } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { CUSTOMER_COOKIE, STAFF_COOKIE, readToken, signToken } from "@/lib/jwt";
import { Customer, Settings, Staff, type CustomerDoc, type StaffDoc } from "@/lib/models";
import { can, permissionsFor, type Permission, type StaffRole } from "@/lib/rbac";
import { authenticator } from "otplib";

authenticator.options = { window: 1 };

let dummyHash: string | null = null;

async function burnPasswordCheck(password: string) {
  dummyHash ??= await hash("bankak-unknown-user", 10);
  await compare(password, dummyHash);
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

async function settings() {
  return (await Settings.findOne({ key: "default" })) ?? (await Settings.create({ key: "default" }));
}

async function trackFailure(user: { failedLoginAttempts?: number; lockedUntil?: Date | null; save: () => Promise<unknown> }) {
  const config = await settings();
  const attempts = (user.failedLoginAttempts ?? 0) + 1;
  user.failedLoginAttempts = attempts;
  if (attempts >= config.maxFailedLogins) {
    user.lockedUntil = new Date(Date.now() + config.lockoutMinutes * 60 * 1000);
  }
  await user.save();
}

function assertNotLocked(lockedUntil?: Date | null) {
  if (lockedUntil && lockedUntil.getTime() > Date.now()) {
    throw new HttpError(423, "LOCKED");
  }
}

export async function loginCustomer(identifier: string, password: string) {
  await connectDb();
  const key = identifier.trim().toLowerCase();
  const customer = await Customer.findOne({
    $or: [{ email: key }, { mobile: identifier.trim() }],
  });
  if (!customer) {
    await burnPasswordCheck(password);
    await writeAudit({
      actorType: "customer",
      action: "auth.login",
      targetType: "customer",
      result: "failure",
      remarks: "Unknown identifier",
    });
    throw new HttpError(401, "INVALID_CREDENTIALS");
  }
  assertNotLocked(customer.lockedUntil);
  if (customer.lockedUntil && customer.lockedUntil.getTime() <= Date.now()) {
    customer.failedLoginAttempts = 0;
    customer.lockedUntil = null;
  }
  const ok = await compare(password, customer.passwordHash);
  if (!ok || customer.status !== "active") {
    await trackFailure(customer);
    await writeAudit({
      actorType: "customer",
      actorId: customer._id.toString(),
      actorName: customer.fullName,
      actorRole: "customer",
      action: "auth.login",
      targetType: "customer",
      targetId: customer._id.toString(),
      result: "failure",
    });
    throw new HttpError(401, "INVALID_CREDENTIALS");
  }
  customer.failedLoginAttempts = 0;
  customer.lockedUntil = null;
  await customer.save();
  const token = await signToken(
    { sub: customer._id.toString(), kind: "customer", role: "customer", name: customer.fullName, purpose: "session" },
    "8h",
  );
  const jar = await cookies();
  jar.set(CUSTOMER_COOKIE, token, cookieOptions(60 * 60 * 8));
  await writeAudit({
    actorType: "customer",
    actorId: customer._id.toString(),
    actorName: customer.fullName,
    actorRole: "customer",
    action: "auth.login",
    targetType: "customer",
    targetId: customer._id.toString(),
    result: "success",
  });
  return publicCustomer(customer);
}

export async function logoutCustomer() {
  const session = await currentCustomer().catch(() => null);
  const jar = await cookies();
  jar.set(CUSTOMER_COOKIE, "", cookieOptions(0));
  if (session) {
    await writeAudit({
      actorType: "customer",
      actorId: session.customer._id.toString(),
      actorName: session.customer.fullName,
      actorRole: "customer",
      action: "auth.logout",
      targetType: "customer",
      targetId: session.customer._id.toString(),
      result: "success",
    });
  }
}

export async function loginStaff(email: string, password: string) {
  await connectDb();
  const staff = await Staff.findOne({ email: email.trim().toLowerCase() });
  if (!staff) {
    await burnPasswordCheck(password);
    throw new HttpError(401, "INVALID_CREDENTIALS");
  }
  assertNotLocked(staff.lockedUntil);
  if (staff.lockedUntil && staff.lockedUntil.getTime() <= Date.now()) {
    staff.failedLoginAttempts = 0;
    staff.lockedUntil = null;
  }
  const ok = await compare(password, staff.passwordHash);
  if (!ok || staff.status !== "active") {
    await trackFailure(staff);
    await writeAudit({
      actorType: "staff",
      actorId: staff._id.toString(),
      actorName: staff.fullName,
      actorRole: staff.role,
      action: "auth.login",
      targetType: "staff",
      targetId: staff._id.toString(),
      result: "failure",
    });
    throw new HttpError(401, "INVALID_CREDENTIALS");
  }
  const mfaToken = await signToken(
    { sub: staff._id.toString(), kind: "staff", role: staff.role, name: staff.fullName, purpose: "mfa" },
    "5m",
  );
  return { mfaToken };
}

export async function verifyStaffMfa(mfaToken: string, code: string) {
  await connectDb();
  let payload;
  try {
    payload = await readToken(mfaToken);
  } catch {
    throw new HttpError(401, "MFA_INVALID");
  }
  if (payload.purpose !== "mfa" || payload.kind !== "staff") {
    throw new HttpError(401, "MFA_INVALID");
  }
  const staff = await Staff.findById(payload.sub);
  if (!staff || staff.status !== "active") throw new HttpError(401, "MFA_INVALID");
  assertNotLocked(staff.lockedUntil);
  const valid = authenticator.check(code.trim(), staff.totpSecret);
  if (!valid) {
    await trackFailure(staff);
    await writeAudit({
      actorType: "staff",
      actorId: staff._id.toString(),
      actorName: staff.fullName,
      actorRole: staff.role,
      action: "auth.mfa",
      targetType: "staff",
      targetId: staff._id.toString(),
      result: "failure",
    });
    throw new HttpError(401, "MFA_INVALID");
  }
  staff.failedLoginAttempts = 0;
  staff.lockedUntil = null;
  staff.lastLoginAt = new Date();
  await staff.save();
  const config = await settings();
  const maxAge = config.sessionTimeoutMinutes * 60;
  const token = await signToken(
    { sub: staff._id.toString(), kind: "staff", role: staff.role, name: staff.fullName, purpose: "session" },
    `${config.sessionTimeoutMinutes}m`,
  );
  const jar = await cookies();
  jar.set(STAFF_COOKIE, token, cookieOptions(maxAge));
  await writeAudit({
    actorType: "staff",
    actorId: staff._id.toString(),
    actorName: staff.fullName,
    actorRole: staff.role,
    action: "auth.login",
    targetType: "staff",
    targetId: staff._id.toString(),
    result: "success",
  });
  return publicStaff(staff);
}

export async function logoutStaff() {
  const session = await currentStaff().catch(() => null);
  const jar = await cookies();
  jar.set(STAFF_COOKIE, "", cookieOptions(0));
  if (session) {
    await writeAudit({
      actorType: "staff",
      actorId: session.staff._id.toString(),
      actorName: session.staff.fullName,
      actorRole: session.staff.role,
      action: "auth.logout",
      targetType: "staff",
      targetId: session.staff._id.toString(),
      result: "success",
    });
  }
}

export async function currentCustomer() {
  await connectDb();
  const jar = await cookies();
  const token = jar.get(CUSTOMER_COOKIE)?.value;
  if (!token) throw new HttpError(401, "UNAUTHORIZED");
  try {
    const payload = await readToken(token);
    if (payload.kind !== "customer" || payload.purpose === "mfa") throw new Error("bad");
    const customer = await Customer.findById(payload.sub);
    if (!customer || customer.status !== "active") throw new Error("bad");
    return { customer };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, "UNAUTHORIZED");
  }
}

export async function currentStaff(permission?: Permission) {
  await connectDb();
  const jar = await cookies();
  const token = jar.get(STAFF_COOKIE)?.value;
  if (!token) throw new HttpError(401, "UNAUTHORIZED");
  try {
    const payload = await readToken(token);
    if (payload.kind !== "staff" || payload.purpose === "mfa") throw new Error("bad");
    const staff = await Staff.findById(payload.sub);
    if (!staff || staff.status !== "active") throw new Error("bad");
    if (permission && !can(staff.role, permission)) throw new HttpError(403, "FORBIDDEN");
    return { staff };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, "UNAUTHORIZED");
  }
}

export async function assertPassword(passwordHash: string, password: string) {
  const ok = await compare(password, passwordHash);
  if (!ok) throw new HttpError(401, "STEP_UP_FAILED");
}

export async function hashSecret(value: string) {
  return hash(value, 10);
}

export function publicCustomer(customer: CustomerDoc) {
  return {
    id: customer._id.toString(),
    fullName: customer.fullName,
    email: customer.email,
    mobile: customer.mobile,
    language: customer.language,
    status: customer.status,
    hideBalance: customer.hideBalance,
    notificationPrefs: customer.notificationPrefs,
  };
}

export function publicStaff(staff: StaffDoc) {
  const role = staff.role as StaffRole;
  return {
    id: staff._id.toString(),
    fullName: staff.fullName,
    email: staff.email,
    role,
    language: staff.language,
    permissions: permissionsFor(role),
    lastLoginAt: staff.lastLoginAt,
  };
}
