"use client";

import { useRouter } from "next/navigation";
import type { CategoryDef } from "@/lib/naver/categoryTrends";

export default function CategorySelect({
  categories,
  value,
}: {
  categories: CategoryDef[];
  value: string;
}) {
  const router = useRouter();

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-ink">카테고리</span>
      <select
        value={value}
        onChange={(e) => router.push(`/?category=${e.target.value}#category-trends`)}
        className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-sm text-ink transition-colors focus:border-primary focus:outline-none sm:w-auto"
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}
