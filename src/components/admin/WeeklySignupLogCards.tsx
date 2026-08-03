import type { User } from "@/lib/notion/users";
import { formatKstDateTime } from "@/lib/utils/formatDate";

// 회원 페이지가 따로 없어서(WeeklySearchLogCards/WeeklyBlogScoreLogCards와
// 달리) Link가 아니라 정적 카드로 보여줌.
export default function WeeklySignupLogCards({ users }: { users: User[] }) {
  if (users.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-hairline p-4 text-sm text-ink-muted">
        최근 7일간 신규 가입이 없어요.
      </p>
    );
  }

  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {users.map((user) => (
        <div key={user.pageId} className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface p-4">
          <span className="line-clamp-1 text-sm font-medium text-ink">{user.email || "(이메일 없음)"}</span>
          {user.nickname && <span className="text-xs text-ink-muted">닉네임: {user.nickname}</span>}
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <span className="rounded-full bg-bg px-2 py-0.5">{user.authProvider || "미확인"}</span>
            {!user.emailVerified && user.authProvider === "이메일" && (
              <span className="rounded-full bg-bg px-2 py-0.5 text-error">이메일 미인증</span>
            )}
          </div>
          <span className="text-xs text-ink-muted">{formatKstDateTime(user.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}
