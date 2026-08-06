"use server";

import { requireAdminContext } from "@/lib/auth/workspace-context";
import { getReportData } from "@/lib/reports/queries";
import { reportFiltersSchema, reportTypeSchema } from "@/lib/reports/schemas";
import type { ReportResult } from "@/lib/reports/types";

export type ReportActionResult = {
  data?: ReportResult;
  error?: string;
};

/** Lecture seule — agrège les mêmes requêtes que les autres écrans Admin. */
export async function getReportDataAction(
  rawType: string,
  rawFilters: { from?: string; to?: string },
): Promise<ReportActionResult> {
  const workspace = await requireAdminContext();

  const typeParsed = reportTypeSchema.safeParse(rawType);
  if (!typeParsed.success) {
    return { error: "Type de rapport invalide." };
  }

  const filtersParsed = reportFiltersSchema.safeParse(rawFilters);
  const filters = filtersParsed.success ? filtersParsed.data : {};

  try {
    const data = await getReportData(workspace, typeParsed.data, filters);
    return { data };
  } catch {
    return { error: "Impossible de charger ce rapport pour le moment." };
  }
}
