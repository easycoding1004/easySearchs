"use client";

import { useState } from "react";
import Link from "next/link";
import type { BlogGroup } from "@/lib/write/blogCategories";
import { QUIZ_QUESTIONS, GROUP_RESULTS, computeResultGroup, getCategoriesForGroup } from "@/lib/blogType/quizData";
import { AI_WRITE_ENABLED } from "@/lib/constants";
import ShareResultButton from "@/components/ShareResultButton";

export default function BlogTypeQuiz() {
  const [answers, setAnswers] = useState<BlogGroup[]>([]);
  const step = answers.length; // 0..QUIZ_QUESTIONS.length
  const done = step >= QUIZ_QUESTIONS.length;

  function handleAnswer(group: BlogGroup) {
    setAnswers((prev) => [...prev, group]);
  }

  function handleRestart() {
    setAnswers([]);
  }

  if (done) {
    const group = computeResultGroup(answers);
    return <ResultScreen group={group} onRestart={handleRestart} />;
  }

  const question = QUIZ_QUESTIONS[step];

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-center gap-1.5">
        {QUIZ_QUESTIONS.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i < step ? "bg-primary" : i === step ? "bg-primary/40" : "bg-hairline"}`}
          />
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-ink-muted">
          {step + 1} / {QUIZ_QUESTIONS.length}
        </p>
        <h2 className="text-lg font-bold leading-snug text-ink sm:text-xl">{question.question}</h2>
      </div>

      <div className="flex flex-col gap-2.5">
        {question.options.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => handleAnswer(option.group)}
            className="rounded-lg border border-hairline bg-surface px-4 py-3.5 text-left text-sm font-medium text-ink transition ease-spring hover:border-primary hover:bg-bg motion-safe:active:scale-[0.98]"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultScreen({ group, onRestart }: { group: BlogGroup; onRestart: () => void }) {
  const result = GROUP_RESULTS[group];
  const categories = getCategoriesForGroup(group);

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-hairline bg-surface p-8 text-center">
        <span className="text-5xl">{result.emoji}</span>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">당신의 블로그 유형은</p>
        <h2 className="text-2xl font-extrabold tracking-tight text-ink">{result.headline}</h2>
        <p className="max-w-sm text-sm text-ink-muted">{result.description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ShareResultButton title={`나는 ${result.headline}! - 이지서치 블로그 유형 진단`} text={result.description} />
        <button
          type="button"
          onClick={onRestart}
          className="rounded-md border border-hairline px-4 py-2 text-sm font-medium text-ink-muted transition ease-spring hover:bg-bg"
        >
          다시 진단하기
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-ink">이번 주엔 이런 글감 어때요?</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {categories.map((category) => (
            <div key={category.id} className="flex flex-col gap-1.5 rounded-lg border border-hairline bg-surface p-4">
              <span className="text-sm font-semibold text-ink">{category.label}</span>
              <p className="text-xs text-ink-muted">{category.description}</p>
              <p className="mt-1 text-xs italic text-ink-muted">예: {category.sampleTitle}</p>
            </div>
          ))}
        </div>
      </div>

      {AI_WRITE_ENABLED ? (
        <Link
          href="/write"
          className="self-start rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97]"
        >
          이 글감으로 AI가 바로 써드릴게요 →
        </Link>
      ) : (
        <span
          title="AI 자동글쓰기는 최종 점검 중이에요. 곧 만나보실 수 있어요!"
          className="flex w-fit cursor-not-allowed items-center gap-1.5 rounded-md bg-hairline px-5 py-2.5 text-sm font-semibold text-ink-muted"
        >
          이 글감으로 AI가 바로 써드릴게요
          <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">곧 출시</span>
        </span>
      )}
    </div>
  );
}
