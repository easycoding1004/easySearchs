"use client";

import { useState } from "react";
import Image from "next/image";

// 2026-08 추가(사용자 요청 — "이미지가 많이 깨지는데, 로드되는데 시간이
// 걸리면 progress를 달아줘" + "이미지가 없는 경우엔 이지로고를 넣어줘").
// 외부 사이트(루리웹 썸네일/구매처 og:image)에서 가져온 이미지라 핫링크
// 제한·만료 등으로 실제로 깨지는 경우가 있음 — <img>만 쓰면 브라우저 기본
// "깨진 이미지" 아이콘이 그대로 노출됨. 클라이언트 컴포넌트로 분리해
// onLoad/onError를 잡아, 로딩 중엔 펄스 스켈레톤을, 실패하면(또는 애초에
// 썸네일 자체가 없으면) 사이트 파비콘(정사각형이라 이 자리에 자연스럽게
// 맞음)을 보여줌.
export default function HotdealThumbnail({ src, alt }: { src: string; alt: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(src ? "loading" : "error");

  if (!src || status === "error") {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-hairline bg-bg">
        <Image src="/favicon.png" alt="이지서치" width={32} height={32} className="opacity-60" />
      </div>
    );
  }

  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-hairline bg-bg">
      {status === "loading" && <div className="absolute inset-0 animate-pulse bg-hairline" aria-hidden />}
      {/* 외부(루리웹/구매처) 이미지라 next/image remotePatterns 설정 없이 그대로 씀
          (§CLAUDE.md 18.3의 board 이미지와 같은 패턴) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        className={`h-full w-full object-cover transition-opacity ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
