// ───────────────────────────────────────────────────────────────
// 아이랑 브랜드 아이콘 한 벌 v1후보 (2026-11-02, 작업 가지 work)
// 규칙: 24px 격자 · 선 굵기 1.75 · 둥근 끝 · 단색(네이비, 상태색은 CSS로) · 연한 둥근 바탕
// 외부 파일·CDN 없음(인라인 SVG). 같은 벌을 앱·입구·관리자가 공유한다.
// ───────────────────────────────────────────────────────────────
const BI = {
  home: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/><path d="M10 19v-5h4v5"/>',
  ticket: '<path d="M4 9V7h16v2a2 2 0 0 0 0 4v2H4v-2a2 2 0 0 0 0-4z"/><path d="M12 7v10" stroke-dasharray="2 2"/>',
  gift: '<rect x="4" y="10" width="16" height="10" rx="1.5"/><path d="M3.5 7.5h17v2.5h-17z"/><path d="M12 7.5v12.5"/><path d="M12 7.5c-1.5-3.5-5-3.5-5-1.5s3 1.5 5 1.5c2 0 5 .5 5-1.5s-3.5-2-5 1.5"/>',
  hospital: '<rect x="4" y="5" width="16" height="15" rx="1.5"/><path d="M12 9v6M9 12h6"/><path d="M9 20v-3h6v3"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  pencil: '<path d="m4 20 1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z"/><path d="m14 7 3 3"/>',
  bear: '<circle cx="12" cy="13" r="6"/><circle cx="6.5" cy="7.5" r="2"/><circle cx="17.5" cy="7.5" r="2"/><path d="M10 14h4M12 14v1.5"/>',
  book: '<path d="M4 5.5A2 2 0 0 1 6 4h5v15H6a2 2 0 0 0-2 1.5z"/><path d="M20 5.5A2 2 0 0 0 18 4h-5v15h5a2 2 0 0 1 2 1.5z"/>',
  books: '<rect x="4" y="15" width="16" height="4" rx="1"/><rect x="5" y="10" width="14" height="4" rx="1"/><rect x="6" y="5" width="12" height="4" rx="1"/>',
  school: '<path d="M3 20V11l9-5 9 5v9"/><path d="M9 20v-6h6v6"/><path d="M12 6V3"/>',
  coins: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
  cap: '<path d="m3 9 9-4 9 4-9 4z"/><path d="M7 11v4c0 1.5 2.5 3 5 3s5-1.5 5-3v-4"/><path d="M21 9v5"/>',
  tag: '<path d="M4 4h7l9 9-7 7-9-9z"/><circle cx="8" cy="8" r="1.25"/>',
  swim: '<path d="M3 17c2 0 2-1.5 4-1.5S9 17 11 17s2-1.5 4-1.5 2 1.5 4 1.5"/><circle cx="16" cy="8" r="2"/><path d="m5 12 4-5 4 3"/>',
  briefcase: '<rect x="3" y="8" width="18" height="11" rx="2"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
  stethoscope: '<path d="M6 4v5a4 4 0 0 0 8 0V4"/><path d="M10 13v3a4 4 0 0 0 8 0v-1"/><circle cx="18" cy="13" r="2"/>',
  pill: '<rect x="3" y="9" width="18" height="7" rx="3.5" transform="rotate(-45 12 12.5)"/><path d="m9 9 6 6"/>',
  ambulance: '<path d="M3 16V8h10l4 4h4v4"/><circle cx="7" cy="17" r="1.75"/><circle cx="17" cy="17" r="1.75"/><path d="M8 10v4M6 12h4"/>',
  card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/><path d="M7 14h4"/>',
  bag: '<path d="M5 9h14l-1 11H6z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/>',
  store: '<path d="M4 10 5 5h14l1 5"/><path d="M4 10c0 1.5 1.3 2.5 2.7 2.5S9.3 11.5 9.3 10c0 1.5 1.3 2.5 2.7 2.5s2.7-1 2.7-2.5c0 1.5 1.3 2.5 2.7 2.5S20 11.5 20 10"/><path d="M5 12.5V20h14v-7.5"/><path d="M10 20v-4h4v4"/>',
  child: '<circle cx="12" cy="8" r="3.5"/><path d="M6 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/>',
  chart: '<path d="M4 20h16"/><rect x="6" y="11" width="3" height="7"/><rect x="11" y="6" width="3" height="12"/><rect x="16" y="9" width="3" height="9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  suncloud: '<circle cx="8" cy="8" r="3"/><path d="M8 2v1.5M2 8h1.5M3.8 3.8l1 1"/><path d="M9 19h8a3.5 3.5 0 0 0 .5-7A5 5 0 0 0 8 13.5 2.8 2.8 0 0 0 9 19z"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 11.5 3.3 3.3 0 0 0 7 18z"/>',
  rain: '<path d="M7 15h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 8.5 3.3 3.3 0 0 0 7 15z"/><path d="M9 18v2M13 18v2M17 18v2"/>',
  pin: '<path d="M12 21s6-6 6-11a6 6 0 0 0-12 0c0 5 6 11 6 11z"/><circle cx="12" cy="10" r="2"/>',
  puzzle: '<path d="M10 4h4v3a2 2 0 1 0 0 2v3h3a2 2 0 1 1 0 4h-3v4h-4v-3a2 2 0 1 0 0-2v-3H7a2 2 0 1 1 0-4h3z"/>',
  shield: '<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z"/><path d="m9.5 12 2 2 3.5-4"/>',
  rice: '<path d="M4 12h16a8 8 0 0 1-16 0z"/><path d="M8 12c0-3 2-5 4-5s4 2 4 5"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4-4"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5c3 0 5.5 2.5 5.5 5.5"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  megaphone: '<path d="M4 10v4h3l8 4V6l-8 4z"/><path d="M18 9a4 4 0 0 1 0 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  rocket: '<path d="M14 4c3 0 6 3 6 6l-6 6-4-4z"/><path d="M8 12l-4 1 2-5 3 1M12 16l-1 4 5-2-1-3"/><circle cx="15" cy="9" r="1.25"/>',
  key: '<circle cx="8" cy="14" r="4"/><path d="M11 11l8-8M16 6l2 2M19 3l2 2"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  city: '<path d="M3 20V9h6v11M9 20V4h6v16M15 20v-8h6v8"/><path d="M5 12h2M5 15h2M11 8h2M11 11h2M11 14h2M17 15h2"/>',
};
const EMOJI_ICON = { "🏠": "home", "🎟️": "ticket", "🎁": "gift", "🏥": "hospital", "🚑": "ambulance", "🩺": "stethoscope", "💊": "pill", "🛡️": "shield",
  "🏷️": "tag", "💳": "card", "🛍️": "bag", "🏪": "store", "🧒": "child", "📊": "chart", "☀️": "sun", "🌤️": "suncloud", "⛅": "suncloud", "☁️": "cloud", "🌧️": "rain", "🌦️": "rain",
  "📚": "books", "📖": "book", "✏️": "pencil", "🧸": "bear", "📍": "pin", "🍚": "rice", "🏊": "swim", "🧘": "swim", "🏋️": "swim", "💃": "swim", "♨️": "sun", "🧩": "puzzle",
  "🏫": "school", "🎓": "cap", "💼": "briefcase", "🔍": "search", "📞": "phone", "📅": "calendar", "⭐": "cap" };
const ROUTE_ICON = { acas: "pencil", kinders: "bear", library: "book", books: "books", schools: "school", premium: "coins", elite: "cap", deals: "tag", hosp: "hospital", sports: "swim", jobs: "briefcase", safety: "shield" };
// 바탕 색조(브랜드 보조색만): 기본 네이비 바탕, 코랄·세이지·골드는 의미 있을 때만
const ICON_TINT = { coral: "var(--coral-bg)", sage: "var(--sage-bg)", gold: "var(--gold-bg)", navy: "var(--navy-soft)", none: "transparent" };
function ico(name, px = 24, tint = "navy", color) {
  const d = BI[name] || BI.grid, box = tint === "none" ? px : Math.round(px * 1.6), inner = tint === "none" ? px : Math.round(px);
  return `<span class="bi" aria-hidden="true" style="width:${box}px;height:${box}px;background:${ICON_TINT[tint] || ICON_TINT.navy}${color ? `;color:${color}` : ""}"><svg viewBox="0 0 24 24" width="${inner}" height="${inner}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${d}</svg></span>`;
}
function icoE(e, px = 24, tint = "navy") { const n = EMOJI_ICON[e]; return n ? ico(n, px, tint) : `<span class="e-flat" style="width:${px}px;height:${px}px;font-size:${Math.round(px * .62)}px" aria-hidden="true">${e}</span>`; }
