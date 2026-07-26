import { ImageResponse } from "next/og";

export const alt = "ezzsearch — 네이버 키워드 검색량 조회 & 블로그지수";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const HEADLINE = "네이버 키워드 검색량 & 블로그지수";
const SUBTEXT = "회원가입 없이 무료로 바로 확인하세요";

// next/og's built-in font has no Korean glyphs — without a Korean font,
// HEADLINE/SUBTEXT would render as blank boxes. Google Fonts' css2 endpoint
// serves a Satori-compatible TTF (instead of woff2) when asked with an old
// Chrome user agent — a well-known workaround for CJK og-images, since
// Satori can't parse woff2.
async function loadNotoSansKR(text: string): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(text)}`;
    const css = await fetch(cssUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36",
      },
    }).then((res) => res.text());

    const fontUrl = css.match(/src: url\(([^)]+)\)/)?.[1];
    if (!fontUrl) return null;

    return await fetch(fontUrl).then((res) => res.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const fontData = await loadNotoSansKR(HEADLINE + SUBTEXT);

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
          ezzsearch
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
