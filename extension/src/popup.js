import { API_BASE_URL } from "./config.js";

const RECENT_KEY = "recentSearches";
const FAVORITES_KEY = "favorites";
const MAX_RECENT = 20;
const MAX_FAVORITES = 30;

const form = document.getElementById("search-form");
const input = document.getElementById("keyword-input");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const resultKeywordEl = document.getElementById("result-keyword");
const resultPcEl = document.getElementById("result-pc");
const resultMobileEl = document.getElementById("result-mobile");
const resultTotalEl = document.getElementById("result-total");
const resultRelatedEl = document.getElementById("result-related");
const favoriteToggleBtn = document.getElementById("favorite-toggle");
const recentListEl = document.getElementById("recent-list");
const favoritesListEl = document.getElementById("favorites-list");
const tabButtons = document.querySelectorAll(".tab-btn");

let currentResult = null;

function formatCount(value) {
  return value.toLocaleString("ko-KR");
}

function setStatus(message, isError = false) {
  if (!message) {
    statusEl.hidden = true;
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

async function getFavorites() {
  const store = await chrome.storage.local.get(FAVORITES_KEY);
  return store[FAVORITES_KEY] || [];
}

async function isFavorite(keyword) {
  const favorites = await getFavorites();
  return favorites.some((f) => f.keyword === keyword);
}

function renderResult(result) {
  currentResult = result;
  resultEl.hidden = false;
  resultKeywordEl.textContent = result.keyword;
  resultPcEl.textContent = formatCount(result.monthlyPcQcCnt);
  resultMobileEl.textContent = formatCount(result.monthlyMobileQcCnt);
  resultTotalEl.textContent = formatCount(result.monthlyPcQcCnt + result.monthlyMobileQcCnt);

  resultRelatedEl.innerHTML = "";
  for (const row of result.related || []) {
    const li = document.createElement("li");
    const nameSpan = document.createElement("span");
    nameSpan.textContent = row.relKeyword;
    const countSpan = document.createElement("span");
    countSpan.textContent = formatCount(row.monthlyPcQcCnt + row.monthlyMobileQcCnt);
    li.append(nameSpan, countSpan);
    resultRelatedEl.appendChild(li);
  }

  isFavorite(result.keyword).then((fav) => {
    favoriteToggleBtn.textContent = fav ? "★" : "☆";
  });
}

async function lookup(keyword) {
  setStatus("조회 중...");
  resultEl.hidden = true;
  try {
    const res = await fetch(`${API_BASE_URL}/api/extension/keyword-lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    setStatus("");
    renderResult(data);
    await pushRecent(data);
    await renderLists();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "조회에 실패했어요.", true);
  }
}

async function pushRecent(result) {
  const store = await chrome.storage.local.get(RECENT_KEY);
  const list = store[RECENT_KEY] || [];
  const filtered = list.filter((item) => item.keyword !== result.keyword);
  filtered.unshift({
    keyword: result.keyword,
    monthlyPcQcCnt: result.monthlyPcQcCnt,
    monthlyMobileQcCnt: result.monthlyMobileQcCnt,
    related: result.related,
    checkedAt: Date.now(),
  });
  await chrome.storage.local.set({ [RECENT_KEY]: filtered.slice(0, MAX_RECENT) });
}

async function toggleFavorite() {
  if (!currentResult) return;
  const favorites = await getFavorites();
  const exists = favorites.some((f) => f.keyword === currentResult.keyword);
  const next = exists
    ? favorites.filter((f) => f.keyword !== currentResult.keyword)
    : [
        {
          keyword: currentResult.keyword,
          monthlyPcQcCnt: currentResult.monthlyPcQcCnt,
          monthlyMobileQcCnt: currentResult.monthlyMobileQcCnt,
          related: currentResult.related,
        },
        ...favorites,
      ].slice(0, MAX_FAVORITES);
  await chrome.storage.local.set({ [FAVORITES_KEY]: next });
  favoriteToggleBtn.textContent = exists ? "☆" : "★";
  await renderLists();
}

function renderItemList(container, items, { removable }) {
  container.innerHTML = "";
  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = removable ? "즐겨찾기한 키워드가 없어요." : "최근 조회한 키워드가 없어요.";
    container.appendChild(li);
    return;
  }
  for (const item of items) {
    const li = document.createElement("li");
    const nameSpan = document.createElement("span");
    nameSpan.textContent = item.keyword;
    li.appendChild(nameSpan);

    const rightWrap = document.createElement("span");
    const countSpan = document.createElement("span");
    countSpan.textContent = formatCount(item.monthlyPcQcCnt + item.monthlyMobileQcCnt);
    rightWrap.appendChild(countSpan);
    li.appendChild(rightWrap);

    li.addEventListener("click", (e) => {
      if (e.target.closest(".item-star")) return;
      renderResult(item);
      input.value = item.keyword;
    });
    container.appendChild(li);
  }
}

async function renderLists() {
  const [recentStore, favorites] = await Promise.all([
    chrome.storage.local.get(RECENT_KEY),
    getFavorites(),
  ]);
  renderItemList(recentListEl, recentStore[RECENT_KEY] || [], { removable: false });
  renderItemList(favoritesListEl, favorites, { removable: true });
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const keyword = input.value.trim();
  if (!keyword) return;
  lookup(keyword);
});

favoriteToggleBtn.addEventListener("click", toggleFavorite);

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    recentListEl.hidden = tab !== "recent";
    favoritesListEl.hidden = tab !== "favorites";
  });
});

renderLists();
