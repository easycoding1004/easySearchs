import { searchBlog, searchCafe } from "../naver/openApiClient";

export interface MentionVolume {
  keyword: string;
  blogTotal: number;
  cafeTotal: number;
}

// Sequential, not Promise.all — halves the peak burst rate against Naver's
// shared per-app rate limit (each tracked keyword already fans out across
// several panels' worth of concurrent requests).
export async function getMentionVolume(keyword: string): Promise<MentionVolume> {
  const blog = await searchBlog(keyword);
  const cafe = await searchCafe(keyword);

  return {
    keyword,
    blogTotal: blog.total,
    cafeTotal: cafe.total,
  };
}
