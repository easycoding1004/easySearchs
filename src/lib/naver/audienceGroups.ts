// 검색어트렌드 API의 ages 파라미터는 코드 1~11이 0~12/13~18/19~24/25~29/30~
// 34/35~39/40~44/45~49/50~54/55~59/60세~ 세분화된 구간이라(실측 확인), 코드
// 여러 개를 한 배열에 담아 호출하면 그 구간들을 합친 결과 하나가 옴(실측
// 확인 — ["1"]과 ["2"] 결과가 다르고 ["1","2"]는 그 둘의 합집합에 해당하는
// 제3의 값). 이를 이용해 자연스러운 10대 단위로 묶음.
//
// 중요: gender/device/age 필터를 건 각 호출은 자기 구간 안에서 다시 0~100으로
// 정규화됨(실측 확인 — 필터 걸어도 최고점이 그대로 100으로 나옴). 그래서
// "여성 지수 60 vs 남성 지수 45"처럼 그룹 간 크기를 비교하는 건 근거 없는
// 비교다. 대신 각 그룹의 최근 3개월 추세 방향(상승/보합/하락)만 보여준다 —
// trendDirection.ts의 computeTrendDirection과 동일한 계산.

export type AudienceDimension = "gender" | "device" | "age";

export interface AudienceGroup {
  label: string;
  gender?: "m" | "f";
  device?: "pc" | "mo";
  ages?: string[];
}

export const GENDER_GROUPS: AudienceGroup[] = [
  { label: "남성", gender: "m" },
  { label: "여성", gender: "f" },
];

export const DEVICE_GROUPS: AudienceGroup[] = [
  { label: "PC", device: "pc" },
  { label: "모바일", device: "mo" },
];

export const AGE_GROUPS: AudienceGroup[] = [
  { label: "10대 이하", ages: ["1", "2"] },
  { label: "20대", ages: ["3", "4"] },
  { label: "30대", ages: ["5", "6"] },
  { label: "40대", ages: ["7", "8"] },
  { label: "50대", ages: ["9", "10"] },
  { label: "60대 이상", ages: ["11"] },
];

export function groupsForDimension(dimension: AudienceDimension): AudienceGroup[] {
  if (dimension === "gender") return GENDER_GROUPS;
  if (dimension === "device") return DEVICE_GROUPS;
  return AGE_GROUPS;
}
