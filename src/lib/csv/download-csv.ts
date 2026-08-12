"use client";

type CsvCell = string | number | null | undefined;

function escapeCsvCell(value: CsvCell): string {
  const stringValue = value === null || value === undefined ? "" : String(value);
  if (/[",;\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

type DownloadCsvOptions = {
  /** Lignes méta avant le tableau (ex. établissement, période). */
  preamble?: CsvCell[][];
};

/** Génère et télécharge un CSV côté client (compatible Excel FR — séparateur `;`). */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: CsvCell[][],
  options: DownloadCsvOptions = {},
): void {
  const preamble = options.preamble ?? [];
  const lines = [...preamble, headers, ...rows].map((row) =>
    row.map(escapeCsvCell).join(";"),
  );
  const csvContent = `\uFEFF${lines.join("\r\n")}`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
