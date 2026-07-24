// 진행률 모달이 100%를 찍고 사라진 뒤에도, 이 페이지의 "키워드 노출·빈도"
// 탭은 저장된 데이터가 아니라 방문할 때마다 네이버에 실시간으로 재조회하기
// 때문에 몇 초 더 걸린다 (dashboard/[sessionId]/page.tsx 상단 주석 참고).
// loading.tsx가 없으면 그 사이 화면이 그냥 멈춘 것처럼 보여서 "느리게
// 뜬다"는 느낌을 주므로, 최소한 뭔가 진행 중이라는 걸 바로 보여준다.
export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-2">
        <div className="h-6 w-48 animate-pulse rounded bg-hairline" />
        <div className="h-4 w-64 animate-pulse rounded bg-hairline" />
      </div>
      <div className="flex gap-1 border-b border-hairline">
        <div className="h-9 w-28 animate-pulse rounded-t-md bg-hairline" />
        <div className="h-9 w-32 animate-pulse rounded-t-md bg-hairline" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="h-40 w-full animate-pulse rounded-lg bg-hairline" />
        <div className="h-40 w-full animate-pulse rounded-lg bg-hairline" />
      </div>
    </main>
  );
}
