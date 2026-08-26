import { config } from "dotenv";
config({ path: ".env.local" });

import { Client } from "@notionhq/client";
import { BOARD_POST_PROPS } from "../src/lib/notion/schema";

const notionToken = process.env.NOTION_TOKEN;
const postsDataSourceId = process.env.NOTION_BOARD_POSTS_DB_ID;
if (!notionToken || !postsDataSourceId) {
  console.error("Missing NOTION_TOKEN or NOTION_BOARD_POSTS_DB_ID in .env.local.");
  process.exit(1);
}

const notion = new Client({ auth: notionToken });

// 2026-08 추가(사용자 요청 — "게시판에 매일 가짜 회원 댓글/글을 자동으로
// 만들어달라"는 요청을 프라이버시/기만 우려로 거절하고, 대안으로 합의한
// 방식: 가짜 회원을 만들지 않고, 실제 운영자(관리자) 계정으로 진짜 도움이
// 되는 글 몇 개를 한 번만 직접 작성해서 추가함. §18.7.1의 데모 시드
// 페르소나와 달리 이건 정직하게 "관리자" 명의로 실제 기능 안내 글임.
const ADMIN_ID = "3ac5ac20-1cc9-81bb-9d46-e313ba3e7ea1";
const ADMIN_NICKNAME = "관리자";

const POSTS = [
  {
    title: "핫딜정보 게시판, 직접 등록도 가능해요",
    body: "핫딜정보 게시판(/hotdeal)은 회원이라면 누구나 발견한 최저가 정보를 직접 등록할 수 있어요.\n\n등록할 때 쇼핑몰별 가격을 최대 5곳까지 입력하면 자동으로 최저가를 계산해서 배지로 보여드려요. 모델명을 입력해두면 나중에 다른 분들이 검색으로 쉽게 찾을 수 있고요.\n\n등록은 /hotdeal 페이지 우측 상단의 \"핫딜 등록\" 버튼으로 시작하시면 됩니다. 좋은 딜 발견하시면 공유해주세요!",
  },
  {
    title: "소상공인 정책정보는 어디서 오는 정보인가요?",
    body: "소상공인 정책정보 게시판(/policy-board)의 대출정보·정부지원금·공모전·소상공인뉴스는 전부 기업마당(bizinfo.go.kr) 공식 오픈API로 가져오는 데이터예요. 매일 자동으로 새 공고를 확인해서 게시판에 채워드리고 있어요.\n\n제목으로 검색도 가능하고, 카테고리 탭으로 필터링해서 볼 수 있어요. 댓글로 궁금한 점을 남기시면 다른 회원분들과 정보를 나눌 수 있습니다.",
  },
  {
    title: "\"내 정보\" 페이지 안내",
    body: "로그인하시면 헤더에 \"내 정보\" 버튼이 생겨요. 여기서 확인할 수 있는 것들이에요.\n\n- 로그인 상태로 진행한 키워드 검색 기록\n- 게시판에 직접 쓴 글\n- 핫딜정보에 등록한 글\n\n비로그인 상태로 진행한 검색은 계정에 연결되지 않으니(이지서치는 기본적으로 로그인 없이 쓸 수 있는 사이트예요), 검색 기록을 남기고 싶으시면 로그인 후 검색해주세요.",
  },
];

async function main() {
  for (const post of POSTS) {
    const page = await notion.pages.create({
      parent: { type: "data_source_id", data_source_id: postsDataSourceId! },
      properties: {
        [BOARD_POST_PROPS.title]: { type: "title", title: [{ type: "text", text: { content: post.title } }] },
        [BOARD_POST_PROPS.body]: { type: "rich_text", rich_text: [{ type: "text", text: { content: post.body } }] },
        [BOARD_POST_PROPS.authorNickname]: {
          type: "rich_text",
          rich_text: [{ type: "text", text: { content: ADMIN_NICKNAME } }],
        },
        [BOARD_POST_PROPS.authorId]: { type: "rich_text", rich_text: [{ type: "text", text: { content: ADMIN_ID } }] },
        [BOARD_POST_PROPS.postedAt]: { type: "date", date: { start: new Date().toISOString() } },
      },
    });
    console.log("created:", post.title, page.id);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
