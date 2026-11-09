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
  maxKeepDays: 365,       // 처리 안 된 문의도 1년 지나면 삭제
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

// ── 관리자 확인: Cloudflare Access 가 붙여 주는 서명된 증표(JWT)를 직접 검증 ──
// 필요한 설정(운영 연결 때): ACCESS_TEAM_DOMAIN(https://<팀>.cloudflareaccess.com), ACCESS_AUD, ADMIN_EMAILS(쉼표 구분)
// 설정이 없으면 관리자 기능은 닫힘(503) — 실수로 열린 채 공개되지 않게.
const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
let certCache = { at: 0, keys: [] };
async function accessKeys(env) {
  if (env.ACCESS_JWKS_TEST) return JSON.parse(env.ACCESS_JWKS_TEST).keys;   // 로컬 시험 전용
  if (Date.now() - certCache.at < 3600000 && certCache.keys.length) return certCache.keys;
  const r = await fetch(`${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);
  certCache = { at: Date.now(), keys: (await r.json()).keys || [] };
  return certCache.keys;
}
export async function adminUser(request, env) {
  if (!env.ACCESS_AUD || !env.ACCESS_TEAM_DOMAIN || !env.ADMIN_EMAILS) return { status: 503, msg: "관리자 로그인이 아직 설정되지 않았어요." };
  const cookie = (request.headers.get("cookie") || "").match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  const token = request.headers.get("cf-access-jwt-assertion") || (cookie && cookie[1]);
  if (!token) return { status: 401, msg: "관리자 로그인이 필요해요." };
  try {
    const [h, p, s] = token.split(".");
    const head = JSON.parse(new TextDecoder().decode(b64u(h))), claims = JSON.parse(new TextDecoder().decode(b64u(p)));
    if (head.alg !== "RS256") throw 0;
    const jwk = (await accessKeys(env)).find((k) => k.kid === head.kid);
    if (!jwk) throw 0;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(s), new TextEncoder().encode(`${h}.${p}`)))) throw 0;
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const now = Date.now() / 1000;
    if (!aud.includes(env.ACCESS_AUD) || claims.iss !== env.ACCESS_TEAM_DOMAIN || !(claims.exp > now) || (claims.nbf && claims.nbf > now + 60)) throw 0;
    const allow = env.ADMIN_EMAILS.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (!allow.includes(String(claims.email || "").toLowerCase())) return { status: 403, msg: "이 계정은 접수함을 볼 수 없어요." };
    return { status: 200, email: claims.email };
  } catch (e) {
    return { status: 401, msg: "관리자 로그인이 필요해요." };
  }
}

// 다른 사이트에서 몰래 보낸 요청 차단(쿠키 로그인이라 필요)
export function sameOrigin(request) {
  const o = request.headers.get("origin");
  return !!o && o === new URL(request.url).origin;
}
