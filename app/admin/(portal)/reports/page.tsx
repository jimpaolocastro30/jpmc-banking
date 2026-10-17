"use client";

import { useState } from "react";
import { Can } from "@/components/admin-shell";
import { useI18n } from "@/components/i18n";
import { Button, Select } from "@/components/ui";
import { api } from "@/lib/client";

const types = ["transaction_summary", "failed_transactions", "accounts", "cards", "bill_payments", "service_requests", "admin_activity"];

export default function ReportsPage() {
  const { t } = useI18n();
  const [type, setType] = useState(types[0]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">{t("adminNav.reports")}</h1>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64">
          <Select label={t("accounts.type")} value={type} onChange={(event) => setType(event.target.value)}>
            {types.map((item) => <option key={item} value={item}>{t(`reports.${item}`)}</option>)}
          </Select>
        </div>
        <Button onClick={() => api<Record<string, unknown>[]>(`/api/admin/reports?type=${type}`).then(setRows)}>{t("common.search")}</Button>
        <Can permission="reports.export">
          <a className="rounded-2xl bg-gold px-4 py-3 text-sm font-semibold" href={`/api/admin/reports/export?type=${type}`}>{t("common.export")}</a>
        </Can>
      </div>
      <div className="overflow-x-auto rounded-3xl bg-white">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr>{rows[0] ? Object.keys(rows[0]).map((key) => <th key={key} className="px-3 py-2">{key}</th>) : null}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-sand-2">
                {Object.values(row).map((value, cell) => <td key={cell} className="px-3 py-2">{String(value ?? "")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
