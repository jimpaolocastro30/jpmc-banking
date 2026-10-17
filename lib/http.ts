import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, handleError } from "@/lib/errors";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function readBody<T>(request: Request, schema: z.ZodType<T>) {
  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new HttpError(400, "VALIDATION");
  return parsed.data;
}

export function queryDate(url: URL, key: string, end = false) {
  const value = url.searchParams.get(key);
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, "VALIDATION");
  if (end && /^\d{4}-\d{2}-\d{2}$/.test(value)) date.setHours(23, 59, 59, 999);
  return date;
}

export function queryNumber(url: URL, key: string) {
  const value = url.searchParams.get(key);
  if (!value) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new HttpError(400, "VALIDATION");
  return number;
}

export async function handle(work: () => Promise<unknown>) {
  try {
    return json(await work());
  } catch (error) {
    return handleError(error);
  }
}
