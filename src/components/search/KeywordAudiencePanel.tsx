"use client";

import { useEffect, useState } from "react";
import type { TrendDirection } from "@/lib/naver/trendDirection";
import type { AudienceDimension } from "@/lib/naver/audienceGroups";

interface GroupResult {
  label: string;
  direction: TrendDirection | null;
}

type DimensionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; groups: GroupResult[] };

const DIRECTION_STYLE: Record<TrendDirection, { arrow: string; color: string }> = {
  상승: { arrow: "▲", color: "text-success" },
  보합: { arrow: "－", color: "text-ink-muted" },
  하락: { arrow: "▼", color: "text-error" },
};

function GroupRow({ group }: { group: GroupResult }) {
  const style = group.direction ? DIRECTION_STYLE[group.direction] : null;
  return (
    <div className="flex items-center justify-between rounded-md border border-hairline bg-bg px-3 py-2 text-sm">
      <span className="text-ink">{group.label}</span>
      {style ? (
        <span className={`font-semibold ${style.color}`}>
          {style.arrow} {group.direction}
        </span>
      ) : (
        <span className="text-ink-muted">데이터 없음</span>
      )}
    </div>
  );
}

async function fetchDimension(keyword: string, dimension: AudienceDimension): Promise<GroupResult[]> {
  const res = await fetch("/api/keyword-audience", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keyword, dimension }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { groups?: GroupResult[] };
  return data.groups ?? [];
}

export default function KeywordAudiencePanel({ keyword }: { keyword: string }) {
  const [gender, setGender] = useState<DimensionState>({ status: "loading" });
  const [device, setDevice] = useState<DimensionState>({ status: "loading" });
  const [age, setAge] = useState<DimensionState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    fetchDimension(keyword, "gender")
      .then((groups) => {
        if (!cancelled) setGender({ status: "ok", groups });
      })
      .catch(() => {
        if (!cancelled) setGender({ status: "error" });
      });
    fetchDimension(keyword, "device")
      .then((groups) => {
        if (!cancelled) setDevice({ status: "ok", groups });
      })
      .catch(() => {
        if (!cancelled) setDevice({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [keyword]);

  function loadAge() {
    setAge({ status: "loading" });
    fetchDimension(keyword, "age")
      .then((groups) => setAge({ status: "ok", groups }))
      .catch(() => setAge({ status: "error" }));
  }

  return (
    <div className="flex w-full flex-col gap-4 rounded-lg border border-hairline bg-surface p-4">
      <div>
        <h2 className="text-base font-semibold text-ink">&quot;{keyword}&quot;는 누가 찾을까?</h2>
        <p className="text-sm text-ink-muted">
          그룹별로 각자 안에서 다시 정규화된 지수라 그룹 간 크기 비교는 어려워요. 대신 최근
          3개월간 각 그룹에서 이 키워드 관심이 오르는지 내리는지만 보여드려요.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">성별</h3>
          {gender.status === "loading" && <p className="text-sm text-ink-muted">불러오는 중...</p>}
          {gender.status === "error" && (
            <p className="text-sm text-error">불러오지 못했어요.</p>
          )}
          {gender.status === "ok" &&
            gender.groups.map((g) => <GroupRow key={g.label} group={g} />)}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">기기</h3>
          {device.status === "loading" && <p className="text-sm text-ink-muted">불러오는 중...</p>}
          {device.status === "error" && (
            <p className="text-sm text-error">불러오지 못했어요.</p>
          )}
          {device.status === "ok" &&
            device.groups.map((g) => <GroupRow key={g.label} group={g} />)}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">연령대</h3>
          {age.status === "idle" && (
            <button
              type="button"
              onClick={loadAge}
              className="rounded-md border border-hairline px-3 py-1 text-xs font-semibold text-ink transition hover:bg-bg"
            >
              연령대 더보기
            </button>
          )}
        </div>
        {age.status === "loading" && <p className="text-sm text-ink-muted">불러오는 중...</p>}
        {age.status === "error" && <p className="text-sm text-error">불러오지 못했어요.</p>}
        {age.status === "ok" && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {age.groups.map((g) => (
              <GroupRow key={g.label} group={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
