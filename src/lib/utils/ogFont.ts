// next/og(Satori)의 기본 폰트에는 한글 글리프가 없어서 한글 텍스트가 빈
// 박스로 렌더링됨 — Google Fonts css2 엔드포인트를 구버전 Chrome UA로
// 요청하면 Satori가 못 읽는 woff2 대신 TTF를 내려주는 잘 알려진 우회를 씀
// (실측 확인, §CLAUDE.md 13). 원래 src/app/opengraph-image.tsx 안에 있던
// 로더를 유형진단 결과별 OG 이미지(2026-08 유입 전략)에서도 쓰게 되면서
// 공유 유틸로 추출함. 실패 시 null — 호출부는 fontFamily 미지정 폴백으로
// 렌더링해야 함(그 경우 한글이 깨질 수 있음).
//
// 주의: css2의 `text=` 파라미터는 정확히 넘긴 글자들의 글리프만 포함하는
// 서브셋 폰트를 반환하므로, 이미지에 실제로 그릴 모든 한글 텍스트를 빠짐없이
// 이어붙여 넘겨야 함 — 빠진 글자는 그 글자만 빈 박스로 나옴.
export async function loadNotoSansKR(text: string): Promise<ArrayBuffer | null> {
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
