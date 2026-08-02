import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "이지서치가 수집하는 정보와 이용 목적을 안내합니다.",
  robots: { index: false, follow: false },
};

const EFFECTIVE_DATE = "2026-08-02";

interface Section {
  heading: string;
  paragraphs: string[];
}

const SECTIONS: Section[] = [
  {
    heading: "1. 수집하는 개인정보 항목",
    paragraphs: [
      "방문 통계: 방문 시 자동으로 발급되는 임의의 방문자 식별값(쿠키), 방문 일시, 유입 경로(예: 네이버·구글·직접 방문 등 분류값), 최초 진입 페이지. 이름·이메일 등 실명 정보는 포함되지 않으며, 쿠키는 매일 자정(한국 시간) 만료됩니다.",
      "문의하기: 이용자가 문의 시 직접 입력하는 이름(선택), 이메일 주소, 문의 내용.",
      "이메일 뉴스레터 구독: 구독 신청 시 입력하는 이메일 주소. 구독 해지 전까지 보관되며, 구독 해지 링크를 통해 언제든 직접 삭제할 수 있습니다.",
      "키워드 검색량 조회 · 블로그지수 조회: 이용자가 직접 입력하는 검색 키워드, 블로그 주소, 비교 대상 블로그 주소. 로그인이 없어 이 정보들은 특정 개인을 식별하지 않으며, 조회 결과는 URL 형태로 보관되어 같은 URL을 아는 사람은 누구나 열람할 수 있습니다.",
    ],
  },
  {
    heading: "2. 개인정보의 수집 및 이용 목적",
    paragraphs: [
      "키워드 검색량 조회, 블로그지수 진단 등 서비스 제공 및 조회 결과 재확인",
      "문의 접수 및 답변",
      "신청 시 급상승 키워드 요약 이메일 발송",
      "방문자 수, 유입 경로, 인기 페이지 등 서비스 이용 현황 분석 및 개선",
    ],
  },
  {
    heading: "3. 개인정보의 보유 및 이용 기간",
    paragraphs: [
      "방문 통계 기록은 서비스 개선 목적 달성을 위해 필요한 기간 동안 보관 후 삭제합니다.",
      "문의 내용은 처리 완료 후 일정 기간 보관 후 삭제하며, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.",
      "뉴스레터 구독 이메일은 구독 해지 시 즉시 삭제됩니다.",
      "검색·블로그지수 조회 결과는 별도 삭제를 요청하지 않는 한 재조회를 위해 보관됩니다. 삭제를 원하시면 문의하기를 통해 요청해 주세요.",
    ],
  },
  {
    heading: "4. 개인정보의 제3자 제공",
    paragraphs: [
      "이지서치는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 법령에 특별한 규정이 있거나 수사 목적으로 법령에서 정한 절차와 방법에 따라 요청이 있는 경우는 예외로 합니다.",
    ],
  },
  {
    heading: "5. 개인정보 처리 위탁",
    paragraphs: [
      "원활한 서비스 제공을 위해 아래와 같이 개인정보 처리를 위탁하고 있습니다.",
      "Notion Labs, Inc. — 방문 통계·문의 내용·조회 결과 데이터 저장",
      "Resend — 문의하기 접수 내용 및 뉴스레터 이메일 발송",
    ],
  },
  {
    heading: "6. 이용자의 권리",
    paragraphs: [
      "이용자는 언제든지 자신의 개인정보 처리 현황에 대해 열람·정정·삭제·처리정지를 요청할 수 있습니다. 문의하기 페이지를 통해 요청해 주시면 지체 없이 조치하겠습니다.",
    ],
  },
  {
    heading: "7. 쿠키의 운용 및 거부",
    paragraphs: [
      "방문자 통계를 위해 임의의 식별값을 담은 쿠키를 사용합니다. 브라우저 설정에서 쿠키 저장을 거부할 수 있으나, 이 경우 방문 시마다 새 방문으로 집계될 수 있습니다.",
    ],
  },
  {
    heading: "8. 크롬 확장 프로그램(이지서치 키워드 조회)의 데이터 처리",
    paragraphs: [
      "이 확장 프로그램은 로그인 없이 동작하며, 이름·이메일 등 개인 식별 정보를 수집하지 않습니다.",
      "우클릭 조회·주소창 검색·팝업 검색으로 조회한 키워드는 이지서치 서버로 전송되어 검색량 결과를 받아오는 데만 사용되며, 별도로 저장되지 않습니다(서버에서 최대 10분간 캐시 후 자동 삭제).",
      "최근 검색 20건과 즐겨찾기 목록은 이용자의 브라우저(chrome.storage.local)에만 저장되며, 이지서치 서버로 전송되지 않습니다. 확장 프로그램을 삭제하면 함께 삭제됩니다.",
      "'확장으로 보내기' 기능을 사용하면 /write에서 작성한 글의 제목·본문·태그와 업로드한 사진이 브라우저 내부(확장 프로그램의 로컬 저장소)를 통해서만 네이버 블로그 에디터 탭으로 전달됩니다 — 이지서치 서버나 제3자 서버를 거치지 않습니다.",
      "네이버 블로그 에디터에 사진을 자동으로 넣어주는 기능을 위해, 이 확장은 blog.upphoto.naver.com으로 나가는 이미지 업로드 요청의 주소를 관찰(webRequest 권한)합니다 — 요청 내용을 읽거나 가로채거나 변경하지 않으며, 다음 사진을 같은 주소로 올릴 때 재사용하기 위해 주소만 기억합니다.",
      "확장 프로그램에 특화된 문의는 문의하기 페이지를 이용해 주세요.",
    ],
  },
  {
    heading: "9. 개인정보처리방침의 변경",
    paragraphs: [
      "이 방침은 법령이나 서비스 변경 사항을 반영하기 위해 개정될 수 있으며, 변경 시 이 페이지를 통해 공지합니다.",
      `이 방침은 ${EFFECTIVE_DATE}부터 적용됩니다.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-16 sm:px-6 sm:py-20">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            개인정보처리방침
          </h1>
          <p className="mt-2 text-xs text-ink-muted">시행일자: {EFFECTIVE_DATE}</p>
        </div>

        <article className="flex flex-col gap-6">
          {SECTIONS.map((section) => (
            <div key={section.heading} className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-ink">{section.heading}</h2>
              {section.paragraphs.map((p, j) => (
                <p key={j} className="text-sm leading-relaxed text-ink-muted sm:text-base">
                  {p}
                </p>
              ))}
            </div>
          ))}
        </article>
      </main>
    </div>
  );
}
