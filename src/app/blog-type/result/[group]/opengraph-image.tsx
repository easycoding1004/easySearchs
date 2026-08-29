import { ImageResponse } from "next/og";
import { GROUP_RESULTS, groupFromSlug } from "@/lib/blogType/quizData";
import { loadNotoSansKR } from "@/lib/utils/ogFont";

export const alt = "이지서치 블로그 유형 진단 결과";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND_NAME = "이지서치 · 블로그 유형 진단";
const CTA_TEXT = "나는 어떤 유형일까? 30초 만에 확인해보세요";

// 2026-08 유입 전략(바이럴 장치) — 유형진단 결과 공유 링크에 붙는 결과별
// OG 카드. 카톡/인스타에 공유됐을 때 "나는 ○○형 블로거!"가 카드로 보여야
// 진단류 콘텐츠의 공유가 실제 유입으로 이어짐. 한글 폰트 로딩은 루트
// opengraph-image와 같은 공유 로더(ogFont.ts) 재사용 — 이미지에 그릴 모든
// 한글을 서브셋 요청에 빠짐없이 포함해야 함(빠진 글자는 빈 박스).
export default async function ResultOgImage({ params }: { params: Promise<{ group: string }> }) {
  const { group: slug } = await params;
  const group = groupFromSlug(slug);
  const result = group ? GROUP_RESULTS[group] : null;

  const headline = result ? `나는 ${result.headline}!` : "내 블로그 유형 진단";
  const description = result ? result.description : CTA_TEXT;
  const fontData = await loadNotoSansKR(BRAND_NAME + headline + description + CTA_TEXT);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "90px",
          backgroundColor: "#FFFBF7",
          backgroundImage: "linear-gradient(135deg, #FFFBF7 0%, #FDE3CE 100%)",
          fontFamily: fontData ? "Noto Sans KR" : undefined,
        }}
      >
        <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: "#E06B3D", marginBottom: 40 }}>
          {BRAND_NAME}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 700,
            color: "#3D2E1F",
            lineHeight: 1.2,
            maxWidth: 980,
          }}
        >
          {headline}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            color: "#8A7B6C",
            marginTop: 28,
            maxWidth: 980,
            lineHeight: 1.5,
          }}
        >
          {description}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: 48,
            fontSize: 28,
            fontWeight: 700,
            color: "#FFFFFF",
            backgroundColor: "#E06B3D",
            padding: "18px 34px",
            borderRadius: 14,
            alignSelf: "flex-start",
          }}
        >
          {CTA_TEXT}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData
        ? [{ name: "Noto Sans KR", data: fontData, weight: 700, style: "normal" }]
        : [],
    }
  );
}
