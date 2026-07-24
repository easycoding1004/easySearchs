"use client";

import { useState } from "react";

export default function DashboardTabs({
  tabs,
}: {
  tabs: { id: string; label: string; content: React.ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-hairline">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`-mb-px rounded-t-md border-b-2 px-4 py-2 text-sm font-medium transition ease-spring ${
              active === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabs.map((tab) =>
        tab.id === active ? (
          <div key={tab.id} className="panel-transition flex flex-col gap-6">
            {tab.content}
          </div>
        ) : null
      )}
    </div>
  );
}
