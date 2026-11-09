// 아이랑 문의 접수 — 공통 부품 v01후보 (2026-11-09, A안: Cloudflare Pages Functions + D1)
// 원본 참고: 피트 airang-inquiry-v01 (Flask) — 유형·상태·검증·보안 머리말 구조를 옮기고, 058 재시험에서 나온 문제를 보완.
// 이 파일은 경로(route)를 만들지 않는다(onRequest 없음). 운영 연결 전 시험용.

export const TYPES = { use: "이용 문의", fix: "정보 수정·오류 신고", ad: "광고·제휴 문의" };
export const STATES = ["새 문의", "처리 중", "완료"];
export const LIMITS = {
  body: 2000,             // 글자 수(한글도 2000자 — 058: 바이트 제한으로 1,810자에서 끊기던 문제 해결)
  reply: 254,
  perIp10m: 5,            // 같은 기기(주소)에서 10분에 5건
  perIpDay: 20,           // 하루 20건
  globalDay: 300,         // 전체 하루 300건(도배 방어)
  doneKeepDays: 90,       // 완료 후 90일 뒤 자동 삭제(대표 결정 대기 — 추천값)
  maxKeepDays: 180,       // 처리 안 된 문의도 180일 지나면 삭제(11/9 피트 의견: 1년→180일)
  warnDays: 30,           // 삭제 30일 전부터 접수함에 '곧 삭제' 표시
};
const DAY = 86400000;

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...SEC, ...extra } });
}
export const SEC = { "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" };

export async function schema(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, body TEXT NOT NULL, reply TEXT NOT NULL DEFAULT '',
    gu TEXT NOT NULL DEFAULT '', screen TEXT NOT NULL DEFAULT '', state TEXT NOT NULL DEFAULT '새 문의',
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, done_at INTEGER)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS inquiry_rate (ip_hash TEXT NOT NULL, at INTEGER NOT NULL)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS inquiry_rate_ip ON inquiry_rate(ip_hash, at)`).run();
}

// 보관 기간 지난 문의·접수 기록 지우기(관리자 화면 열 때마다 + 접수 때 실행 → 따로 예약 작업 불필요)
export async function purge(db, now = Date.now()) {
  await db.prepare(`DELETE FROM inquiries WHERE (state='완료' AND done_at < ?) OR created_at < ?`)
    .bind(now - LIMITS.doneKeepDays * DAY, now - LIMITS.maxKeepDays * DAY).run();
  await db.prepare(`DELETE FROM inquiry_rate WHERE at < ?`).bind(now - DAY).run();
}

const EMAIL = /^[^\s@<>()"',;]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
const RRN = /\d{6}\s*-?\s*[1-8]\d{6}/;                       // 주민등록번호 형태
const PHONE = /01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}/;       // 휴대전화 형태

// 입력 검사 → { ok, value } 또는 { ok:false, field, msg }
export function validate(input) {
  const kindKey = String(input.kind || "");
  if (!TYPES[kindKey]) return { ok: false, field: "kind", msg: "문의 유형을 골라 주세요." };
  const body = String(input.body || "").replace(/\r\n/g, "\n").trim();
  if (!body) return { ok: false, field: "body", msg: "문의 내용을 적어 주세요." };
  if ([...body].length > LIMITS.body) return { ok: false, field: "body", msg: `문의 내용은 ${LIMITS.body}자까지 쓸 수 있어요.` };
  const reply = String(input.reply || "").trim();
  if (reply && (reply.length > LIMITS.reply || !EMAIL.test(reply))) return { ok: false, field: "reply", msg: "회신 이메일 형식을 확인해 주세요. (비워 두어도 돼요)" };
  if (RRN.test(body)) return { ok: false, field: "body", msg: "주민등록번호처럼 보이는 숫자가 있어요. 지우고 보내 주세요." };
  if (kindKey !== "ad" && PHONE.test(body)) return { ok: false, field: "body", msg: "전화번호는 지워 주세요. 답장이 필요하면 아래 회신 이메일 칸을 써 주세요." };
  const clip = (s, n) => String(s || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
  return { ok: true, value: { kind: TYPES[kindKey], body, reply, gu: clip(input.gu, 20), screen: clip(input.screen, 40) } };
}

export async function ipHash(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const day = new Date().toISOString().slice(0, 10);          // 날마다 바뀌는 값을 섞어 하루 넘게 추적 불가
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${env.HASH_SALT || "dev-only"}|${day}|${ip}`));
  return [...new Uint8Array(buf)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── 관리자 확인 v02 (2026-11-09 대표 결정: 카드 등록 없는 무료 방식) ──
// 대표만 아는 비밀번호(ADMIN_PASSWORD, Cloudflare 화면의 '비밀(Secret)'로 대표가 직접 등록 — 코드·GitHub에 없음)
// 로그인하면 12시간짜리 서명 쿠키를 줌. 비밀번호를 바꾸면 기존 로그인은 모두 풀림.
// 비밀번호가 없거나 12자 미만이면 관리자 기능은 닫힘(503) — 실수로 열린 채 공개되지 않게.
export const SESSION_HOURS = 12;
export const LOGIN_LIMIT = { perIp15m: 5, global1h: 30 };     // 틀린 비밀번호: 같은 기기 15분 5번, 전체 1시간 30번까지
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function hmac(keyText, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(keyText), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}
export function passwordReady(env) { return typeof env.ADMIN_PASSWORD === "string" && [...env.ADMIN_PASSWORD].length >= 12; }
// 같은 길이 비교(글자마다 시간 차이로 비밀번호를 알아내는 방법 차단): 둘 다 서명값으로 바꿔 비교
export async function passwordMatches(env, given) {
  const a = await hmac("pw-check", String(given || "")), b = await hmac("pw-check", env.ADMIN_PASSWORD);
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export async function sessionCookie(env, request) {
  const exp = Date.now() + SESSION_HOURS * 3600000;
  const v = `${exp}.${await hmac("session|" + env.ADMIN_PASSWORD, String(exp))}`;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `airang_admin=${v}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}${secure}`;
}
export function clearCookie(request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `airang_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}
export async function adminUser(request, env) {
  if (!passwordReady(env)) return { status: 503, msg: "관리자 비밀번호가 아직 설정되지 않았어요." };
  const m = (request.headers.get("cookie") || "").match(/(?:^|;\s*)airang_admin=(\d+)\.([0-9a-f]{64})(?:;|$)/);
  if (!m || +m[1] < Date.now()) return { status: 401, msg: "관리자 로그인이 필요해요." };
  if ((await hmac("session|" + env.ADMIN_PASSWORD, m[1])) !== m[2]) return { status: 401, msg: "관리자 로그인이 필요해요." };
  return { status: 200 };
}

// 다른 사이트에서 몰래 보낸 요청 차단(쿠키 로그인이라 필요)
export function sameOrigin(request) {
  const o = request.headers.get("origin");
  return !!o && o === new URL(request.url).origin;
}
