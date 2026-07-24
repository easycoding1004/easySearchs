import type { KeywordRecord } from "./notion/types";

const CSV_HEADERS = [
  "키워드",
  "구분",
  "PC 월간검색수",
  "모바일 월간검색수",
  "합계 검색수",
  "경쟁정도",
  "월평균노출광고수",
  "조회일시",
];

function escapeCsvField(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toRow(record: KeywordRecord): string[] {
  return [
    record.keyword,
    record.kind,
    String(record.pcCount),
    String(record.mobileCount),
    String(record.totalCount),
    record.compIdx ?? "",
    String(record.avgAdDepth),
    record.checkedAt,
  ];
}

export function toCsv(records: KeywordRecord[]): string {
  const lines = [CSV_HEADERS, ...records.map(toRow)].map((fields) =>
    fields.map(escapeCsvField).join(",")
  );
  // UTF-8 BOM so Windows Excel renders Korean correctly.
  return "﻿" + lines.join("\r\n");
}
