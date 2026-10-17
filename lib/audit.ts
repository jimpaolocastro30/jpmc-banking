import { AuditLog } from "@/lib/models";

type AuditInput = {
  actorType: "customer" | "staff" | "system";
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  action: string;
  targetType: string;
  targetId?: string;
  result: "success" | "failure";
  remarks?: string;
  reference?: string;
};

export async function writeAudit(entry: AuditInput) {
  await AuditLog.create({
    actorType: entry.actorType,
    actorId: entry.actorId ?? "",
    actorName: entry.actorName ?? "",
    actorRole: entry.actorRole ?? "",
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? "",
    result: entry.result,
    remarks: entry.remarks ?? "",
    reference: entry.reference ?? "",
  });
}
