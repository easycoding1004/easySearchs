import { config } from "dotenv";
config({ path: ".env.local" });

import { Client, isFullPage } from "@notionhq/client";
import { USER_PROPS, AUTH_PROVIDER, BOARD_POST_PROPS, BOARD_COMMENT_PROPS } from "../src/lib/notion/schema";

const notionToken = process.env.NOTION_TOKEN;
const usersDataSourceId = process.env.NOTION_USERS_DB_ID;
const postsDataSourceId = process.env.NOTION_BOARD_POSTS_DB_ID;
const commentsDataSourceId = process.env.NOTION_BOARD_COMMENTS_DB_ID;

if (!notionToken || !usersDataSourceId || !postsDataSourceId || !commentsDataSourceId) {
  console.error(
    "Missing NOTION_TOKEN or NOTION_USERS_DB_ID or NOTION_BOARD_POSTS_DB_ID or NOTION_BOARD_COMMENTS_DB_ID in .env.local."
  );
  process.exit(1);
}

// board.ts/users.ts는 일부러 안 씀 — tsx가 이 스크립트를 진짜 ESM으로
// 실행해서 import가 전부 호이스팅되는데, board.ts가 간접 import하는
// src/lib/notion/client.ts는 모듈 로드 시점에 즉시
// `new Client({auth: process.env.NOTION_TOKEN})`을 실행하는 싱글턴이라,
// 이 스크립트 본문의 dotenv config()보다 먼저 평가되어 토큰이 비어있는
// 채로 생성돼버림(실측 확인 — "API token is invalid" 오류). 그래서 이
// 스크립트는 config() 이후에 직접 만든 Client 인스턴스만 쓴다(다른
// scripts/*.ts들과 동일한 안전한 패턴).
const notion = new Client({ auth: notionToken });

// 데모/시연용 가상 회원 10명 — 실제 로그인은 안 되는 계정(비밀번호 없음,
// 이메일도 가짜 도메인)이고, 게시판 글/댓글 작성자 표시용으로만 씀.
// 2026-08 닉네임을 영문 핸들로 변경 — "필라테스원장" 같은 한국어 직업+
// 직함 조합이 부자연스럽다는 사용자 피드백(scripts/rename-seed-persona-
// nicknames.ts로 기존 계정·게시글에도 소급 적용함).
const PERSONAS = [
  { email: "seed-cafe01@ezzsearch.local", nickname: "mia_cafe" },
  { email: "seed-bakery02@ezzsearch.local", nickname: "tom_bakes" },
  { email: "seed-pilates03@ezzsearch.local", nickname: "jenny_flow" },
  { email: "seed-cleaning04@ezzsearch.local", nickname: "alex_clean" },
  { email: "seed-tutor05@ezzsearch.local", nickname: "kate_tutors" },
  { email: "seed-nail06@ezzsearch.local", nickname: "sophie_nails" },
  { email: "seed-pension07@ezzsearch.local", nickname: "mark_stay" },
  { email: "seed-shop08@ezzsearch.local", nickname: "liam_shop" },
  { email: "seed-studio09@ezzsearch.local", nickname: "noah_shoots" },
  { email: "seed-marketer10@ezzsearch.local", nickname: "emma_mkt" },
] as const;

interface SeedPost {
  personaIndex: number; // 0-based into PERSONAS
  date: string; // YYYY-MM-DD (KST)
  hour: number;
  minute: number;
  title: string;
  body: string;
  answer: string;
  answerHourOffset: number; // hours after the question, admin reply
}

// "지난 5일간 낮 시간대" — 오늘(2026-08-03) 기준 직전 5일, 09:00~19:00 KST.
const POSTS: SeedPost[] = [
  {
    personaIndex: 0,
    date: "2026-07-29",
    hour: 10,
    minute: 12,
    title: "네이버 지도에 저희 카페가 상위 노출되는지 확인할 수 있나요?",
    body: "카페를 오픈한 지 얼마 안 됐는데, 네이버에서 저희 카페 이름 치면 순위가 어느 정도인지 궁금해서요. 블로그지수에서 확인 가능한가요?",
    answer:
      "네, 블로그지수 조회 시 업체명을 입력하시면 '메인' 탭에 지역·플레이스 진단 카드가 뜨는데, 여기서 지역검색 기준 순위를 확인하실 수 있어요. 다만 네이버 지역검색 API가 상위 5위까지만 결과를 줘서 6위 밖이면 '미노출'로만 표시돼요. 비교하고 싶은 다른 카페 상호명도 같이 넣으시면 나란히 비교도 가능합니다.",
    answerHourOffset: 3,
  },
  {
    personaIndex: 1,
    date: "2026-07-29",
    hour: 11,
    minute: 40,
    title: "블로그지수 점수가 낮게 나왔는데 어떻게 올리나요?",
    body: "저희 블로그로 지수 조회해봤는데 4점대가 나왔어요. 뭘 기준으로 계산되는 건가요?",
    answer:
      "블로그지수는 검색 상위노출·게시글 수·댓글 수·공감 수·공유수 5개 항목을 종합한 저희 자체 점수예요(네이버 공식 지표는 아니에요). 특히 게시글 수·댓글·공감·공유는 최근 게시물 최대 50개 평균이라, 꾸준히 올리고 독자와 소통하는 게 점수에 가장 크게 반영돼요. 결과 화면 하단에 어떤 항목이 부족한지도 같이 안내해 드려요.",
    answerHourOffset: 5,
  },
  {
    personaIndex: 2,
    date: "2026-07-29",
    hour: 13,
    minute: 5,
    title: "회원가입 없이도 계속 무료로 쓸 수 있나요?",
    body: "키워드 검색량이랑 블로그지수 둘 다 매번 무료인지 궁금합니다.",
    answer:
      "네, 키워드 검색량 조회(홈)와 블로그지수 조회 둘 다 로그인 없이 언제든 무료로 이용하실 수 있어요. 회원가입이 필요한 건 AI 블로그 글쓰기 기능 하나뿐이고, 그마저도 하루 1회 무료로 제공돼요.",
    answerHourOffset: 2,
  },
  {
    personaIndex: 3,
    date: "2026-07-29",
    hour: 15,
    minute: 20,
    title: "연관검색어는 몇 개까지 나오나요?",
    body: "청소 관련 키워드로 검색했는데 연관검색어가 꽤 많이 나오던데 최대 몇 개까지 보여주는 건가요?",
    answer:
      "네이버 검색광고 API가 주는 연관 키워드를 최대 50개까지 같이 보여드려요. 검색량이 너무 적은 키워드가 섞여 있으면 표에서 정렬해서 큰 것부터 보시면 편해요.",
    answerHourOffset: 4,
  },
  {
    personaIndex: 4,
    date: "2026-07-29",
    hour: 17,
    minute: 50,
    title: "AI 블로그 글쓰기에서 사진은 꼭 있어야 하나요?",
    body: "과외 후기 글을 쓰고 싶은데 사진이 마땅치 않아서요. 사진 없이도 되나요?",
    answer:
      "네, 사진 없이도 글 생성이 가능해요. 사진이 없으면 AI가 이미지 자리 추천을 안 하고 텍스트 위주로 써드려요. 다만 제품 비교처럼 사진으로 설명하기 어려운 부분은 AI 이미지 생성을 활용하실 수도 있어요.",
    answerHourOffset: 1,
  },
  {
    personaIndex: 5,
    date: "2026-07-30",
    hour: 9,
    minute: 30,
    title: "요즘 뜨는 검색어는 어디서 봐요?",
    body: "네이버 실검이 없어진 뒤로 지금 사람들이 뭘 많이 검색하는지 알 방법이 없더라고요.",
    answer:
      "상단 메뉴의 '검색량 급상승'(/trending)에서 확인하실 수 있어요. 구글 트렌드 한국 일간 트렌드랑 저희 자체 검색량 스냅샷을 같이 보여드려요. 다만 네이버 자체 실검 데이터는 아니라서 참고용으로 봐주세요.",
    answerHourOffset: 3,
  },
  {
    personaIndex: 6,
    date: "2026-07-30",
    hour: 11,
    minute: 15,
    title: "비교 블로그는 몇 개까지 넣을 수 있나요?",
    body: "저희 펜션이랑 근처 다른 펜션들 블로그를 같이 비교해보고 싶은데요.",
    answer:
      "블로그지수 조회 시 비교 블로그는 최대 10개까지 같이 넣으실 수 있어요. 결과 페이지에서 내 블로그를 포함한 전체 순위표로 한눈에 비교되니 참고해보세요.",
    answerHourOffset: 6,
  },
  {
    personaIndex: 7,
    date: "2026-07-30",
    hour: 14,
    minute: 0,
    title: "PC랑 모바일 검색량이 왜 따로 나오나요?",
    body: "검색량 조회하면 PC랑 모바일이 나눠서 나오던데 둘 다 봐야 하나요?",
    answer:
      "네이버 검색광고 API가 원래 PC/모바일을 구분해서 제공해요. 요즘은 모바일 검색 비중이 훨씬 높은 경우가 많아서, 광고나 콘텐츠 전략 짤 때는 합계보다 모바일 수치를 더 눈여겨보시는 걸 추천드려요.",
    answerHourOffset: 2,
  },
  {
    personaIndex: 8,
    date: "2026-07-30",
    hour: 16,
    minute: 45,
    title: "결과 페이지 링크를 다른 사람한테 공유해도 되나요?",
    body: "블로그지수 조회한 결과를 직원이나 지인한테 링크로 보내줘도 문제없나요?",
    answer:
      "네, 결과 URL은 로그인 없이 누구나 볼 수 있는 공개 링크라 자유롭게 공유하셔도 돼요. 이미지로 저장해서 카카오톡으로 보내는 것도 결과 화면의 '이미지로 저장' 버튼으로 가능합니다.",
    answerHourOffset: 2,
  },
  {
    personaIndex: 9,
    date: "2026-07-31",
    hour: 9,
    minute: 50,
    title: "CSV 다운로드는 어떤 정보가 들어있나요?",
    body: "검색량 결과 CSV 받으면 표에 있는 항목이 다 들어있는 건가요?",
    answer:
      "네, 결과 화면 표에 보이는 PC/모바일/합계 검색량, 경쟁정도, 월평균노출광고수, 블로그 발행량·포화도까지 전부 CSV에 담겨서 나와요. 엑셀로 바로 열어서 정렬·필터링하시기 편하실 거예요.",
    answerHourOffset: 3,
  },
  {
    personaIndex: 0,
    date: "2026-07-31",
    hour: 11,
    minute: 25,
    title: "카카오 로그인으로도 AI 블로그 글쓰기 되나요?",
    body: "네이버 계정이 없는데 카카오로도 가입 가능한가요?",
    answer:
      "네, 이메일 가입 외에 네이버·카카오·구글 로그인 세 가지를 모두 지원해요. 어떤 방법으로 가입하셔도 바로 AI 블로그 글쓰기를 이용하실 수 있어요.",
    answerHourOffset: 4,
  },
  {
    personaIndex: 1,
    date: "2026-07-31",
    hour: 13,
    minute: 10,
    title: "블로그지수 재조회하면 점수가 바뀌나요?",
    body: "예전에 조회했던 결과 링크로 다시 들어가면 그때 그 점수 그대로 나오나요?",
    answer:
      "네, '메인(블로그지수)' 탭의 점수는 세션을 만든 시점에 계산해서 저장해두는 거라 다시 방문해도 그대로 보여요. 최신 점수를 다시 보고 싶으시면 홈에서 새로 조회하시면 됩니다.",
    answerHourOffset: 2,
  },
  {
    personaIndex: 2,
    date: "2026-07-31",
    hour: 15,
    minute: 35,
    title: "게시판에 사진 몇 장까지 올릴 수 있나요?",
    body: "이 게시판에 글 쓸 때 사진 업로드 개수 제한이 있나요?",
    answer:
      "게시판 글 하나에 최대 10장까지 올리실 수 있어요. 붙여넣기(Ctrl+V)로도 바로 삽입되니까 참고해주세요.",
    answerHourOffset: 1,
  },
  {
    personaIndex: 3,
    date: "2026-07-31",
    hour: 17,
    minute: 5,
    title: "AI 블로그 글쓰기, 하루에 한 번만 되는 이유가 뭔가요?",
    body: "하루 1회 제한이 좀 아쉬운데 늘려줄 계획은 없나요?",
    answer:
      "AI 호출 비용 때문에 남용을 막으려고 계정당 하루 1회로 제한하고 있어요. 대신 생성된 글은 '수정 요청'으로 같은 날 최대 5번까지 다듬으실 수 있으니 그 안에서 최대한 원하시는 결과로 맞춰보세요.",
    answerHourOffset: 1,
  },
  {
    personaIndex: 4,
    date: "2026-07-31",
    hour: 18,
    minute: 20,
    title: "지역 검색 순위가 6위 밖이면 아예 안 보이나요?",
    body: "저희는 아마 순위가 꽤 밀릴 것 같은데, 그래도 조회하는 의미가 있을까요?",
    answer:
      "네이버 지역검색 API 자체가 상위 5개까지만 결과를 주는 구조라 6위 밖은 정확한 순위 대신 '미노출'로만 표시돼요. 그래도 상위 5위 안에 드는지 아닌지는 확인할 수 있어서 현황 파악에는 도움이 되실 거예요.",
    answerHourOffset: 1,
  },
  {
    personaIndex: 5,
    date: "2026-08-01",
    hour: 9,
    minute: 40,
    title: "검색어 하나로 여러 번 조회하면 데이터가 계속 바뀌나요?",
    body: "며칠 간격으로 같은 키워드를 여러 번 검색해봤는데 숫자가 조금씩 다르더라고요.",
    answer:
      "네이버가 집계하는 월간 검색량 자체가 주기적으로 갱신돼서, 조회 시점에 따라 조금씩 달라질 수 있어요. 저희 쪽에서 임의로 가공하는 게 아니라 네이버 검색광고 API가 그 순간 주는 값을 그대로 보여드리는 거예요.",
    answerHourOffset: 3,
  },
  {
    personaIndex: 6,
    date: "2026-08-01",
    hour: 12,
    minute: 15,
    title: "블로그 발행량이랑 포화도는 무슨 뜻인가요?",
    body: "표에 있는 '총 블로그 발행량', '블로그 포화도'가 정확히 뭘 의미하는 건지 궁금해요.",
    answer:
      "총 블로그 발행량은 그 키워드로 지금까지 발행된 전체 블로그 글 수, 포화도는 그중 최근 한 달 사이 새로 올라온 글의 비율이에요. 포화도가 높을수록 요즘도 활발하게 그 키워드로 글이 올라오고 있다는 뜻이라 경쟁이 치열하다고 보시면 돼요.",
    answerHourOffset: 5,
  },
  {
    personaIndex: 7,
    date: "2026-08-01",
    hour: 14,
    minute: 50,
    title: "구글 트렌드 데이터가 네이버 실검이랑 같은 건가요?",
    body: "요즘 뜨는 검색어 페이지에 구글 트렌드라고 써있던데 그럼 네이버 검색이랑은 다른 건가요?",
    answer:
      "맞아요, 네이버는 2021년에 실시간급상승검색어를 완전히 폐지해서 저희가 직접 구할 방법이 없어요. 그래서 구글 트렌드 한국 일간 트렌드를 대신 보여드리고, 항목마다 실제 네이버 검색량도 같이 교차 조회해서 참고하실 수 있게 해뒀어요. 화면에도 '구글 트렌드 기준'이라고 항상 표시돼요.",
    answerHourOffset: 3,
  },
  {
    personaIndex: 8,
    date: "2026-08-01",
    hour: 17,
    minute: 30,
    title: "AI가 만든 이미지에 저작권 문제는 없나요?",
    body: "AI 이미지 생성 기능으로 만든 사진, 블로그에 그대로 써도 괜찮을까요?",
    answer:
      "저희 서비스가 OpenAI의 이미지 생성 API로 그 자리에서 새로 만드는 이미지라 별도 저작권 소유자가 있는 사진을 가져오는 게 아니에요. 다만 정확한 상업적 이용 범위는 OpenAI 자체 이용약관을 한번 확인해보시는 걸 권해드려요.",
    answerHourOffset: 1,
  },
  {
    personaIndex: 9,
    date: "2026-08-02",
    hour: 10,
    minute: 5,
    title: "여러 업체 계정을 관리하려면 로그인을 여러 개 만들어야 하나요?",
    body: "대행하는 업체가 여러 곳인데 계정 하나로 다 관리 가능한가요?",
    answer:
      "지금은 계정별로 저장되는 '내 업체 목록' 같은 기능이 없고, 조회할 때마다 즉석으로 입력해서 결과 URL로 남기는 방식이에요. 업체별로 결과 링크를 따로 저장해두고 필요할 때 다시 열어보시는 걸 추천드려요.",
    answerHourOffset: 4,
  },
  {
    personaIndex: 0,
    date: "2026-08-02",
    hour: 12,
    minute: 40,
    title: "문의는 어디로 하면 되나요?",
    body: "버그를 하나 발견한 것 같은데 어디로 알려드리면 될까요?",
    answer:
      "상단 메뉴의 '문의하기' 페이지에서 남겨주시면 확인 후 이메일로 답변드려요. 스크린샷이나 어떤 키워드로 조회하셨는지 같이 적어주시면 원인 파악이 훨씬 빨라요.",
    answerHourOffset: 2,
  },
  {
    personaIndex: 1,
    date: "2026-08-02",
    hour: 15,
    minute: 10,
    title: "협찬받은 글도 이 사이트에서 쓸 수 있나요?",
    body: "재료 협찬받고 후기 쓰는 글인데 표기 규정 같은 게 있나요?",
    answer:
      "네, AI 블로그 글쓰기에서 유형 선택 아래 '협찬이에요' 체크박스를 켜시면 공정위 표기 문구를 본문 첫 줄에 자동으로 넣어드려요. 어떤 글 유형을 고르셔도 이 토글은 별도로 켜고 끄실 수 있어요.",
    answerHourOffset: 3,
  },
  {
    personaIndex: 2,
    date: "2026-08-02",
    hour: 17,
    minute: 55,
    title: "네이버 블로그에 자동으로 발행까지 되나요?",
    body: "글 생성하고 나면 자동으로 제 블로그에 올라가는 건가요?",
    answer:
      "완전 자동 발행은 아니에요. 네이버가 블로그 글쓰기 오픈API를 2020년에 폐지해서 저희 쪽에서 직접 올려드릴 방법이 없거든요. 대신 생성된 제목·본문을 복사해서 네이버 에디터에 붙여넣으시면 되고, 크롬 확장 프로그램을 쓰시면 붙여넣기까지 자동으로 도와드려요. 마지막 '등록' 버튼은 직접 눌러주셔야 해요.",
    answerHourOffset: 1,
  },
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function kst(date: string, hour: number, minute: number): string {
  return `${date}T${pad(hour)}:${pad(minute)}:00+09:00`;
}

// 답변 시각 = 질문 시각 + offset시간, 단 19시(낮 시간대 상한)를 넘기지 않도록 캡.
function answerTime(date: string, hour: number, minute: number, offsetHours: number): string {
  const cappedHour = Math.min(hour + offsetHours, 19);
  return kst(date, cappedHour, minute);
}

async function findOrCreatePersona(email: string, nickname: string): Promise<string> {
  const existing = await notion.dataSources.query({
    data_source_id: usersDataSourceId!,
    filter: { property: USER_PROPS.title, title: { equals: email } },
    page_size: 1,
  });
  const found = existing.results.find(isFullPage);
  if (found) {
    console.log(`  이미 존재: ${nickname} (${email})`);
    return found.id;
  }

  const page = await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: usersDataSourceId! },
    properties: {
      [USER_PROPS.title]: { type: "title", title: [{ type: "text", text: { content: email } }] },
      [USER_PROPS.emailVerified]: { type: "checkbox", checkbox: true },
      [USER_PROPS.authProvider]: { type: "select", select: { name: AUTH_PROVIDER.email } },
      [USER_PROPS.createdAt]: { type: "date", date: { start: new Date().toISOString() } },
      [USER_PROPS.nickname]: { type: "rich_text", rich_text: [{ type: "text", text: { content: nickname } }] },
    },
  });
  console.log(`  생성: ${nickname} (${email})`);
  return page.id;
}

async function createSeedPost(input: {
  title: string;
  body: string;
  authorNickname: string;
  authorId: string;
  postedAt: string;
}): Promise<string> {
  const page = await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: postsDataSourceId! },
    properties: {
      [BOARD_POST_PROPS.title]: { type: "title", title: [{ type: "text", text: { content: input.title } }] },
      [BOARD_POST_PROPS.body]: { type: "rich_text", rich_text: [{ type: "text", text: { content: input.body } }] },
      [BOARD_POST_PROPS.authorNickname]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.authorNickname } }],
      },
      [BOARD_POST_PROPS.authorId]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.authorId } }],
      },
      [BOARD_POST_PROPS.images]: { type: "files", files: [] },
      [BOARD_POST_PROPS.postedAt]: { type: "date", date: { start: input.postedAt } },
    },
  });
  return page.id;
}

async function createSeedComment(input: {
  postId: string;
  content: string;
  authorNickname: string;
  postedAt: string;
}): Promise<void> {
  await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: commentsDataSourceId! },
    properties: {
      [BOARD_COMMENT_PROPS.title]: { type: "title", title: [{ type: "text", text: { content: input.content } }] },
      [BOARD_COMMENT_PROPS.authorNickname]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.authorNickname } }],
      },
      [BOARD_COMMENT_PROPS.post]: { type: "relation", relation: [{ id: input.postId }] },
      [BOARD_COMMENT_PROPS.postedAt]: { type: "date", date: { start: input.postedAt } },
    },
  });
}

async function setNicknameDirect(pageId: string, nickname: string): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [USER_PROPS.nickname]: { type: "rich_text", rich_text: [{ type: "text", text: { content: nickname } }] },
    },
  });
}

// "bigi2040"을 이메일 또는 닉네임에 포함하는 기존 계정이 있으면 닉네임을
// "관리자"로 바꿔둠(사용자 요청 — 사이트 운영자 본인 계정 표시명).
async function fixAdminNickname() {
  console.log("\nbigi2040 계정 검색 중...");
  const res = await notion.dataSources.query({
    data_source_id: usersDataSourceId!,
    filter: {
      or: [
        { property: USER_PROPS.title, title: { contains: "bigi2040" } },
        { property: USER_PROPS.nickname, rich_text: { contains: "bigi2040" } },
      ],
    },
  });
  const matches = res.results.filter(isFullPage);
  if (matches.length === 0) {
    console.log(
      "  bigi2040으로 식별되는 계정을 찾지 못했어요 — 아직 실제 로그인을 한 적이 없는 것 같습니다. " +
        "나중에 해당 계정으로 로그인해서 게시판에 처음 글/댓글을 쓸 때 닉네임을 '관리자'로 입력해주시면 됩니다."
    );
    return;
  }
  for (const page of matches) {
    await setNicknameDirect(page.id, "관리자");
    console.log(`  닉네임을 '관리자'로 변경함: ${page.id}`);
  }
}

async function main() {
  console.log("1) 가상 회원 10명 생성 중...");
  const personaIds: string[] = [];
  for (const p of PERSONAS) {
    const id = await findOrCreatePersona(p.email, p.nickname);
    personaIds.push(id);
  }

  console.log("\n2) Q&A 게시글 23건 + 관리자 답변 생성 중...");
  for (const post of POSTS) {
    const persona = PERSONAS[post.personaIndex];
    const authorId = personaIds[post.personaIndex];
    const postedAt = kst(post.date, post.hour, post.minute);

    const postId = await createSeedPost({
      title: post.title,
      body: post.body,
      authorNickname: persona.nickname,
      authorId,
      postedAt,
    });

    await createSeedComment({
      postId,
      content: post.answer,
      authorNickname: "관리자",
      postedAt: answerTime(post.date, post.hour, post.minute, post.answerHourOffset),
    });

    console.log(`  [${post.date} ${pad(post.hour)}:${pad(post.minute)}] ${persona.nickname} — ${post.title}`);
  }

  await fixAdminNickname();

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
