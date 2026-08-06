import type { ReportType } from "@/lib/reports/schemas";

export type ReportColumnFormat = "text" | "number" | "currency" | "date" | "datetime";

export type ReportColumn = {
  key: string;
  label: string;
  format?: ReportColumnFormat;
};

export type ReportRow = Record<string, string | number | null>;

export type ReportSummaryItem = {
  label: string;
  value: string;
};

export type ReportResult = {
  type: ReportType;
  title: string;
  description: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  summary: ReportSummaryItem[];
};
