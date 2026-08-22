import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "이용약관",
  description: "이지서치 서비스 이용에 관한 약관을 안내합니다.",
  robots: { index: false, follow: false },
};

const EFFECTIVE_DATE = "2026-08-08";

interface Section {
  heading: string;
  paragraphs: string[];
}

const SECTIONS: Section[] = [
  {
    heading: "1. 목적",
    paragraphs: [
      "이 약관은 이지서치(이하 \"회사\")가 제공하는 키워드 검색량 조회, 블로그지수 진단, AI 블로그 자동글쓰기, 게시판 등 일체의 서비스(이하 \"서비스\")의 이용과 관련하여 회사와 이용자 간의 권리·의무 및 책임사항을 정하는 것을 목적으로 합니다.",
    ],
  },
  {
    heading: "2. 서비스의 이용",
    paragraphs: [
      "키워드 검색량 조회, 블로그지수 진단은 로그인 없이 누구나 이용할 수 있습니다.",
      "AI 블로그 자동글쓰기, 게시판 글쓰기·댓글 작성은 회원가입(소셜 로그인)이 필요합니다.",
      "만 14세 미만은 서비스에 가입할 수 없습니다.",
    ],
  },
  {
    heading: "3. 회원가입",
    paragraphs: [
      "회원가입은 네이버·카카오·구글 소셜 로그인으로만 가능하며, 이 약관과 개인정보처리방침에 모두 동의해야 가입이 완료됩니다.",
      "소셜 로그인 제공자가 제공하는 이메일 또는 표시 이름을 계정 식별에 사용하며, 이메일을 제공하지 않는 경우(예: 카카오 개인 개발자 앱) 소셜 로그인 제공자의 계정 ID를 기준으로 별도 식별합니다.",
    ],
  },
  {
    heading: "4. 유료 구독 서비스",
    paragraphs: [
      "AI 블로그 자동글쓰기(무료 이용 횟수 소진 후)와 블로그지수 AI 인사이트는 유료 구독(월 9,900원, 토스페이먼츠 정기결제)을 통해 이용할 수 있습니다.",
      "구독은 매달 자동으로 갱신되며, 결제 수단(카드) 정보로 매 결제주기마다 자동 청구됩니다.",
      "구독 해지는 언제든 할 수 있으며, 해지해도 이미 결제한 결제주기가 끝날 때까지는 계속 이용할 수 있습니다. 해지 즉시 환불되지 않습니다.",
      "결제 수단 오류 등으로 정기 결제가 실패하면 별도 유예 기간 없이 무료 회원으로 즉시 전환됩니다.",
      "환불 문의는 문의하기 페이지를 통해 개별적으로 접수·처리합니다.",
    ],
  },
  {
    heading: "5. 회원의 의무",
    paragraphs: [
      "이용자는 서비스 이용 시 관계 법령, 이 약관, 이용안내 및 서비스와 관련하여 회사가 공지한 사항을 준수해야 합니다.",
      "타인의 정보를 도용하거나 허위 정보를 등록하는 행위, 서비스를 이용해 법령을 위반하는 콘텐츠(명예훼손, 저작권 침해, 청소년 유해 정보 등)를 게시하는 행위, 서비스의 정상적인 운영을 방해하는 행위를 해서는 안 됩니다.",
    ],
  },
  {
    heading: "6. AI 생성 콘텐츠에 대한 안내",
    paragraphs: [
      "AI 블로그 자동글쓰기가 생성한 제목·본문·이미지 등은 참고용 초안이며, 사실관계 오류나 부적절한 표현이 포함될 수 있습니다. 최종 검수와 게시 여부에 대한 책임은 이용자에게 있으며, 회사는 AI 생성 콘텐츠의 정확성을 보증하지 않습니다.",
      "회사는 이용자가 게시한 글의 자동 발행을 대신하지 않으며, 이용자가 직접 확인 후 게시해야 합니다.",
    ],
  },
  {
    heading: "7. 서비스 지표에 대한 안내",
    paragraphs: [
      "블로그지수, 키워드 검색량 트렌드 방향성, 카테고리별 쇼핑 관심도 등은 회사가 공개된 데이터를 자체적으로 가공·산정한 참고 지표이며, 네이버의 공식 지표나 다른 제3자 서비스의 산정 방식과 다릅니다. 각 화면에 표기된 안내 문구를 참고해 주세요.",
    ],
  },
  {
    heading: "8. 서비스 제공의 중단",
    paragraphs: [
      "회사는 시스템 점검, 외부 API(네이버·토스페이먼츠 등)의 장애나 정책 변경 등 부득이한 사유가 있는 경우 서비스 제공을 일시적으로 중단할 수 있습니다.",
    ],
  },
  {
    heading: "9. 면책조항",
    paragraphs: [
      "회사는 천재지변, 외부 API 제공업체의 장애 등 회사가 통제할 수 없는 사유로 발생한 서비스 중단에 대해 책임을 지지 않습니다.",
      "회사는 이용자가 서비스를 이용해 얻은 정보나 생성한 콘텐츠로 인해 발생한 손해에 대해 관계 법령이 허용하는 범위에서 책임을 지지 않습니다.",
    ],
  },
  {
    heading: "10. 약관의 개정",
    paragraphs: [
      "이 약관은 법령이나 서비스 변경 사항을 반영하기 위해 개정될 수 있으며, 변경 시 이 페이지를 통해 공지합니다.",
      `이 약관은 ${EFFECTIVE_DATE}부터 적용됩니다.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-16 sm:px-6 sm:py-20">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">이용약관</h1>
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
