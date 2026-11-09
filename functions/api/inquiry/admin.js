// /api/inquiry/admin — 관리자 접수함 v01후보 (2026-11-09). Cloudflare Access 로그인 + 허용 메일만.
import { STATES, json, schema, purge, adminUser, sameOrigin } from "../../_shared/inquiry.js";
const PAGE = 30;

async function guard(request, env) {
  const u = await adminUser(request, env);
  if (u.status !== 200) return json({ ok: false, msg: u.msg }, u.status);
  if (!env.INQ_DB) return json({ ok: false, msg: "저장소가 연결되지 않았어요." }, 503);
  return null;
}

export async function onRequestGet({ request, env }) {
  const bad = await guard(request, env); if (bad) return bad;
  const db = env.INQ_DB; await schema(db); await purge(db);
  const u = new URL(request.url);
  const state = STATES.includes(u.searchParams.get("state")) ? u.searchParams.get("state") : null;
  const page = Math.max(1, Math.min(1000, parseInt(u.searchParams.get("page"), 10) || 1));
  const where = state ? "WHERE state=?" : "", args = state ? [state] : [];
  const total = (await db.prepare(`SELECT COUNT(*) AS n FROM inquiries ${where}`).bind(...args).first()).n;
  const items = (await db.prepare(`SELECT id,kind,body,reply,gu,screen,state,created_at,done_at FROM inquiries ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .bind(...args, PAGE, (page - 1) * PAGE).all()).results;
  const counts = Object.fromEntries(STATES.map((s) => [s, 0]));
  for (const r of (await db.prepare("SELECT state, COUNT(*) AS n FROM inquiries GROUP BY state").all()).results) counts[r.state] = r.n;
  return json({ ok: true, items, total, page, pages: Math.max(1, Math.ceil(total / PAGE)), counts });
}

export async function onRequestPost({ request, env }) {
  const bad = await guard(request, env); if (bad) return bad;
  if (!sameOrigin(request)) return json({ ok: false, msg: "이 화면에서만 바꿀 수 있어요." }, 403);
  let a; try { a = JSON.parse(await request.text()); } catch (e) { return json({ ok: false, msg: "요청을 읽을 수 없어요." }, 400); }
  const id = Number.isInteger(a && a.id) ? a.id : NaN;
  if (!(id > 0)) return json({ ok: false, msg: "문의 번호가 없어요." }, 400);
  const db = env.INQ_DB; await schema(db); const now = Date.now();
  let r;
  if (a.action === "state") {
    if (!STATES.includes(a.state)) return json({ ok: false, msg: "처리 상태를 확인해 주세요." }, 400);
    r = await db.prepare("UPDATE inquiries SET state=?, updated_at=?, done_at=CASE WHEN ?='완료' THEN COALESCE(done_at, ?) ELSE NULL END WHERE id=?")
      .bind(a.state, now, a.state, now, id).run();
  } else if (a.action === "delete") {
    r = await db.prepare("DELETE FROM inquiries WHERE id=?").bind(id).run();
  } else return json({ ok: false, msg: "알 수 없는 작업이에요." }, 400);
  if (!r.meta.changes) return json({ ok: false, msg: `#${id} 문의를 찾을 수 없어요.` }, 404);   // 058: 없는 번호도 성공처럼 보이던 문제
  return json({ ok: true });
}

