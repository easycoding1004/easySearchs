import { notion } from "./client";
import { BILLING_HISTORY_PROPS, BILLING_STATUS } from "./schema";

// 결제내역(토스페이먼츠 월 구독제, 2026-08 추가) — 최초 결제·매달 정기 청구
// 시도마다 1건씩 기록하는 감사 로그. 고객 문의 대응·디버깅용, 화면에 직접
// 노출되지 않음(§CLAUDE.md 신규 섹션 참고).
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function dataSourceId(): string {
  return requireEnv("NOTION_BILLING_HISTORY_DB_ID");
}

// 결제 자체의 성공/실패와 별개로, 이 기록 자체가 실패해도 결제 흐름을 막으면
// 안 되므로 호출자가 감싸서 쓴다(throw 여부는 이 함수는 그대로 두고, 호출부인
// billingJob.ts/confirm 라우트가 try/catch로 감쌈 — Pixabay/OpenAI 이미지처럼
// "이 함수 자체가 절대 안 던진다"는 계약은 아님, 결제 감사 로그 실패는 콘솔에
// 남겨서 알아챌 수 있어야 하므로).
export async function createBillingRecord(input: {
  authorId: string;
  email: string;
  amount: number;
  success: boolean;
  orderId: string;
  failureReason?: string | null;
}): Promise<void> {
  await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: dataSourceId() },
    properties: {
      [BILLING_HISTORY_PROPS.title]: {
        type: "title",
        title: [{ type: "text", text: { content: `${input.email} - ${new Date().toISOString().slice(0, 10)}` } }],
      },
      [BILLING_HISTORY_PROPS.authorId]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.authorId } }],
      },
      [BILLING_HISTORY_PROPS.amount]: { type: "number", number: input.amount },
      [BILLING_HISTORY_PROPS.status]: {
        type: "select",
        select: { name: input.success ? BILLING_STATUS.success : BILLING_STATUS.failure },
      },
      [BILLING_HISTORY_PROPS.orderId]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.orderId } }],
      },
      [BILLING_HISTORY_PROPS.failureReason]: {
        type: "rich_text",
        rich_text: input.failureReason ? [{ type: "text", text: { content: input.failureReason.slice(0, 1900) } }] : [],
      },
    },
  });
}
