import { randomUUID } from "node:crypto";
import { getErrorMessage } from "@/lib/utils/errors";

// 토스페이먼츠 정기결제(빌링) API — 공식 문서(docs.tosspayments.com)로 확인한
// 요청/응답 형태만 사용, 추측 없음. 아직 가맹점 미가입 상태라 테스트 키로만
// 개발됨 — 실 서비스 전환 시 .env의 TOSS_SECRET_KEY/NEXT_PUBLIC_TOSS_CLIENT_KEY만
// 라이브 키로 바꾸면 되고 이 파일은 코드 변경이 필요 없도록 설계함.
const ISSUE_ENDPOINT = "https://api.tosspayments.com/v1/billing/authorizations/issue";
const CHARGE_ENDPOINT_BASE = "https://api.tosspayments.com/v1/billing";
const FETCH_TIMEOUT_MS = 30000;

function authHeader(): string {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) throw new Error("TOSS_SECRET_KEY가 설정되어 있지 않습니다.");
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

// customerKey는 2~50자, 예측 불가능한 값이어야 함(이메일·순번 등 금지, 공식
// 문서 기준). randomUUID()는 소문자 hex+숫자+대시뿐이라 "대문자/소문자/숫자"
// 조합 요건 해석에 따라 걸릴 수 있어, 앞에 대문자 접두사를 하나 붙여 세
// 문자 종류(대문자/소문자/숫자)를 항상 포함하도록 방어적으로 만듦.
export function generateCustomerKey(): string {
  return `U${randomUUID()}`;
}

// 결제 주문마다 고유해야 하는 orderId(6~64자, 영숫자+-_)도 같은 이유로
// UUID 기반 생성.
export function generateOrderId(): string {
  return `order-${randomUUID()}`;
}

// 다음 결제일 계산 — 입력/출력 모두 YYYY-MM-DD 순수 달력 문자열(시각·타임존
// 의미 없음, Date.UTC는 달 계산용 도구로만 씀). 말일 기준 구독이 다음 달로
// 밀리지 않도록(1/31 구독 → 2/31이 없으니 2/28로) 대상 월의 마지막 날로
// 클램프함.
export function nextBillingDateFrom(fromDateStr: string): string {
  const [y, m, d] = fromDateStr.split("-").map(Number);
  const targetMonthIndex0 = m - 1 + 1; // 0-indexed 다음 달
  const daysInTargetMonth = new Date(Date.UTC(y, targetMonthIndex0 + 1, 0)).getUTCDate();
  const targetDay = Math.min(d, daysInTargetMonth);
  return new Date(Date.UTC(y, targetMonthIndex0, targetDay)).toISOString().slice(0, 10);
}

export interface TossBillingCard {
  issuerCode: string;
  acquirerCode: string | null;
  number: string;
  cardType: string;
  ownerType: string;
}

export interface TossBillingKeyResult {
  billingKey: string;
  customerKey: string;
  authenticatedAt: string;
  method: string;
  card: TossBillingCard | null;
}

// 카드 등록 인증 성공 후 받은 authKey를 실제 청구 가능한 billingKey로 교환.
// 이 시점의 실패는 사용자에게 바로 보여줘야 하는 명확한 에러라 그냥 throw함
// (billingJob의 정기 청구와 달리, 여기는 사용자가 화면 앞에서 기다리는 흐름).
export async function issueBillingKey(authKey: string, customerKey: string): Promise<TossBillingKeyResult> {
  const res = await fetch(ISSUE_ENDPOINT, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ authKey, customerKey }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const data = (await res.json()) as {
    billingKey?: string;
    customerKey?: string;
    authenticatedAt?: string;
    method?: string;
    card?: TossBillingCard;
    code?: string;
    message?: string;
  };
  if (!res.ok || !data.billingKey) {
    throw new Error(data.message || `토스 빌링키 발급 실패 (HTTP ${res.status})`);
  }
  return {
    billingKey: data.billingKey,
    customerKey: data.customerKey ?? customerKey,
    authenticatedAt: data.authenticatedAt ?? new Date().toISOString(),
    method: data.method ?? "CARD",
    card: data.card ?? null,
  };
}

export type TossChargeResult =
  | { success: true; paymentKey: string; status: string; approvedAt: string | null }
  | { success: false; code: string; message: string };

// 정기 청구 — 최초 결제(구독 시작 직후)와 매달 billingJob 양쪽에서 재사용.
// 절대 throw 안 함(billingJob이 여러 사용자를 순회하며 호출하므로, 한 명의
// 카드 실패가 나머지 청구까지 막으면 안 됨) — 성공/실패를 판별 가능한
// discriminated union으로 반환.
export async function chargeBilling(params: {
  billingKey: string;
  customerKey: string;
  amount: number;
  orderId: string;
  orderName: string;
  customerEmail?: string;
}): Promise<TossChargeResult> {
  try {
    const res = await fetch(`${CHARGE_ENDPOINT_BASE}/${encodeURIComponent(params.billingKey)}`, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        customerKey: params.customerKey,
        amount: params.amount,
        orderId: params.orderId,
        orderName: params.orderName,
        ...(params.customerEmail ? { customerEmail: params.customerEmail } : {}),
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const data = (await res.json()) as {
      paymentKey?: string;
      status?: string;
      approvedAt?: string;
      code?: string;
      message?: string;
    };
    if (!res.ok || !data.paymentKey) {
      return { success: false, code: data.code ?? `HTTP_${res.status}`, message: data.message ?? "결제에 실패했습니다." };
    }
    return {
      success: true,
      paymentKey: data.paymentKey,
      status: data.status ?? "DONE",
      approvedAt: data.approvedAt ?? null,
    };
  } catch (err) {
    return { success: false, code: "NETWORK_ERROR", message: getErrorMessage(err) };
  }
}
