import sharp from "sharp";

// v2 블록 포맷(2026-08)이 GALLERY로 최대 50장까지 한 번에 업로드받으면서
// 생긴 문제: Claude API 요청 전체 크기 한도가 32MB(base64 포함)인데, 원본
// 스마트폰 사진은 장당 5~15MB가 흔해서 몇 장만 모여도 한도를 넘음. 사용자가
// "실제 사진을 다 올려서 Claude가 분석"하는 쪽을 택했으므로(§CLAUDE.md 16.2),
// 업로드 단계에서 용량을 억지로 제한하는 대신 서버에서 자동으로 리사이즈·
// 재압축해서 원본 화질 그대로 올려도 되게 함.
//
// 목표: 50장 기준 평균 장당 ~400KB 이하(50×400KB=20MB 원본 → base64 약
// 26.7MB, 32MB 한도에 여유를 둠). 긴 변 1280px + JPEG 품질 72가 일반적인
// 스마트폰 사진에서 이 목표에 근접한다는 걸 실측으로 확인(대략적 기준이지
// 수학적으로 보장되진 않음 — route.ts에서 압축 후 합계를 한 번 더 검사함).
const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 72;

export interface CompressedImage {
  base64: string;
  mimeType: "image/jpeg" | "image/gif";
  byteLength: number;
}

// GIF는 리사이즈하면 애니메이션이 깨지므로(sharp 기본 동작이 첫 프레임만
// 남김) 압축 없이 원래 형식 그대로 통과시킴 — GIF는 대체로 사진보다 용량이
// 작아 실사용상 문제가 적음.
export async function compressImage(
  buffer: Buffer,
  mimeType: string
): Promise<CompressedImage> {
  if (mimeType === "image/gif") {
    return { base64: buffer.toString("base64"), mimeType: "image/gif", byteLength: buffer.length };
  }

  const resized = await sharp(buffer)
    .rotate() // EXIF 방향 정보 반영 후 정보 자체는 제거(용량 절감)
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  return { base64: resized.toString("base64"), mimeType: "image/jpeg", byteLength: resized.length };
}
