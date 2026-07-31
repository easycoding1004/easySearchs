"use client";

import { useEffect, useState } from "react";
import { readSseStream } from "@/lib/utils/readSseStream";
import PostAnalysisPanel, { type PostAnalysisEntry } from "./PostAnalysisPanel";
import PanelError from "./PanelError";

interface DomainInput {
  domain: string;
  label: string;
  isMine: boolean;
}

type State =
  | { status: "loading"; progress: number; label: string | null }
  | { status: "error" }
  | { status: "ok"; entries: PostAnalysisEntry[] };

// 게시글별 분석은 도메인당 최대 50개 게시글을 순차 스크래핑해서(§CLAUDE.md
// 10.3) 세션 재방문 시 수십 초~몇 분 걸릴 수 있음 — 정적 스켈레톤만 보여주면
// "멈춘 건가?" 오해가 생겨서, /api/post-analysis의 SSE 진행률을 그대로
// 받아 인라인 진행바로 보여줌(/dashboard 입력 폼의 SearchProgressModal과
// 같은 SSE 패턴이지만, 이건 페이지 전체를 막는 모달이 아니라 이 섹션
// 안에서만 로딩 상태를 보여주는 인라인 버전).
export default function PostAnalysisLive({ domains }: { domains: DomainInput[] }) {
  const [state, setState] = useState<State>({ status: "loading", progress: 0, label: null });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (domains.length === 0) {
        setState({ status: "ok", entries: [] });
        return;
      }
      try {
        const res = await fetch("/api/post-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domains }),
        });
        if (!res.ok) {
          if (!cancelled) setState({ status: "error" });
          return;
        }

        let finished = false;
        await readSseStream(res, (data) => {
          if (cancelled) return;
          if (data.done) {
            finished = true;
            if (typeof data.error === "string") {
              setState({ status: "error" });
            } else {
              setState({ status: "ok", entries: (data.entries as PostAnalysisEntry[]) ?? [] });
            }
            return;
          }
          setState({
            status: "loading",
            progress: typeof data.progress === "number" ? data.progress : 0,
            label: typeof data.status === "string" ? data.status : null,
          });
        });
        if (!cancelled && !finished) setState({ status: "error" });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.status === "error") return <PanelError title="게시글별 분석" />;

  if (state.status === "ok") {
    return <PostAnalysisPanel entries={state.entries} />;
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">게시글별 분석</h2>
        <span className="text-sm font-semibold text-primary">{state.progress}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300 ease-spring"
          style={{ width: `${state.progress}%` }}
        />
      </div>
      <p className="min-h-[1.25em] text-sm text-ink-muted">
        {state.label ?? "게시글별 분석 준비 중..."}
      </p>
    </div>
  );
}
