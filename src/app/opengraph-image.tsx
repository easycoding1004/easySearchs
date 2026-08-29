import { ImageResponse } from "next/og";
// 한글 폰트 로더는 유형진단 결과 OG 이미지와 공유 — src/lib/utils/ogFont.ts
// (원래 이 파일 안에 있었음, 2026-08 추출).
import { loadNotoSansKR } from "@/lib/utils/ogFont";

export const alt = "이지서치 — 네이버 키워드 검색량 조회 & 블로그지수";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND_NAME = "이지서치";
const HEADLINE = "네이버 키워드 검색량 & 블로그지수";
const SUBTEXT = "회원가입 없이 무료로 바로 확인하세요";

export default async function OpengraphImage() {
  // BRAND_NAME's own characters must be in the requested subset too —
  // Google's css2 `text=` param only includes glyphs for exactly the
  // characters given, so leaving it out would risk BRAND_NAME rendering as
  // blank boxes while HEADLINE/SUBTEXT (which were already covered) render fine.
  const fontData = await loadNotoSansKR(BRAND_NAME + HEADLINE + SUBTEXT);

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
        <div
          style={{
            display: "flex",
            fontSize: 44,
            fontWeight: 800,
            color: "#E06B3D",
            marginBottom: 44,
          }}
        >
          {BRAND_NAME}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 60,
            fontWeight: 700,
            color: "#3D2E1F",
            lineHeight: 1.25,
            maxWidth: 940,
          }}
        >
          {HEADLINE}
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#8A7B6C", marginTop: 28 }}>
          {SUBTEXT}
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
