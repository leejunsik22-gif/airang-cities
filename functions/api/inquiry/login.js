// /api/inquiry/login — 관리자 로그인(POST)·로그아웃(DELETE) v02 (2026-11-09, 카드 없는 무료 방식)
import { json, schema, ipHash, sameOrigin, passwordReady, passwordMatches, sessionCookie, clearCookie, LOGIN_LIMIT } from "../../_shared/inquiry.js";

export async function onRequestPost({ request, env }) {
  if (!passwordReady(env)) return json({ ok: false, msg: "관리자 비밀번호가 아직 설정되지 않았어요." }, 503);
  if (!env.INQ_DB) return json({ ok: false, msg: "저장소가 연결되지 않았어요." }, 503);
  if (!sameOrigin(request)) return json({ ok: false, msg: "이 화면에서만 로그인할 수 있어요." }, 403);
  let a; try { a = JSON.parse(await request.text()); } catch (e) { return json({ ok: false, msg: "요청을 읽을 수 없어요." }, 400); }
  const db = env.INQ_DB; await schema(db);
  await db.prepare("CREATE TABLE IF NOT EXISTS inquiry_login_fail (ip_hash TEXT NOT NULL, at INTEGER NOT NULL)").run();
  const now = Date.now(), ip = await ipHash(request, env);
  await db.prepare("DELETE FROM inquiry_login_fail WHERE at < ?").bind(now - 3600000).run();
  const mine = (await db.prepare("SELECT COUNT(*) AS n FROM inquiry_login_fail WHERE ip_hash=? AND at>?").bind(ip, now - 900000).first()).n;
  const all = (await db.prepare("SELECT COUNT(*) AS n FROM inquiry_login_fail WHERE at>?").bind(now - 3600000).first()).n;
  if (mine >= LOGIN_LIMIT.perIp15m || all >= LOGIN_LIMIT.global1h)
    return json({ ok: false, msg: "비밀번호를 여러 번 틀려 잠시 잠겼어요. 15분 뒤에 다시 시도해 주세요." }, 429);
  if (!(await passwordMatches(env, a && a.password))) {
    await db.prepare("INSERT INTO inquiry_login_fail (ip_hash, at) VALUES (?, ?)").bind(ip, now).run();
    return json({ ok: false, msg: "비밀번호가 맞지 않아요." }, 401);
  }
  return json({ ok: true }, 200, { "set-cookie": await sessionCookie(env, request) });
}

export async function onRequestDelete({ request }) {
  if (!sameOrigin(request)) return json({ ok: false, msg: "이 화면에서만 할 수 있어요." }, 403);
  return json({ ok: true }, 200, { "set-cookie": clearCookie(request) });
}
