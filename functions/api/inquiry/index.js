// POST /api/inquiry — 이용자 문의 접수 v01후보 (2026-11-09). 메일 발송 없음, D1(INQ_DB)에 저장만.
import { LIMITS, json, schema, purge, validate, ipHash, sameOrigin } from "../../_shared/inquiry.js";

export async function onRequestPost({ request, env }) {
  const db = env.INQ_DB;
  if (!db) return json({ ok: false, msg: "지금은 문의를 받을 수 없어요. 잠시 뒤 다시 시도해 주세요." }, 503);
  if (!sameOrigin(request)) return json({ ok: false, msg: "이 화면에서만 보낼 수 있어요." }, 403);
  const len = Number(request.headers.get("content-length") || 0);
  if (len > 32768) return json({ ok: false, msg: "내용이 너무 길어요." }, 413);
  let input;
  try { input = JSON.parse(await request.text()); } catch (e) { return json({ ok: false, msg: "보낸 내용을 읽을 수 없어요." }, 400); }
  if (!input || typeof input !== "object") return json({ ok: false, msg: "보낸 내용을 읽을 수 없어요." }, 400);
  if (input.website) return json({ ok: true, ticket: 0 });          // 자동 로봇용 숨은 칸 — 저장하지 않고 조용히 끝냄
  const v = validate(input);
  if (!v.ok) return json({ ok: false, field: v.field, msg: v.msg }, 400);

  await schema(db);
  const now = Date.now(), ip = await ipHash(request, env);
  await purge(db, now);
  const cnt = async (sql, ...b) => (await db.prepare(sql).bind(...b).first()).n;
  if (await cnt("SELECT COUNT(*) AS n FROM inquiry_rate WHERE ip_hash=? AND at>?", ip, now - 600000) >= LIMITS.perIp10m
    || await cnt("SELECT COUNT(*) AS n FROM inquiry_rate WHERE ip_hash=? AND at>?", ip, now - 86400000) >= LIMITS.perIpDay)
    return json({ ok: false, msg: "문의를 짧은 시간에 여러 번 보냈어요. 조금 뒤에 다시 보내 주세요." }, 429);
  if (await cnt("SELECT COUNT(*) AS n FROM inquiry_rate WHERE at>?", now - 86400000) >= LIMITS.globalDay)
    return json({ ok: false, msg: "오늘은 문의가 많아 잠시 쉬고 있어요. 내일 다시 보내 주세요." }, 429);

  const x = v.value;
  const r = await db.prepare("INSERT INTO inquiries (kind,body,reply,gu,screen,state,created_at,updated_at) VALUES (?,?,?,?,?,'새 문의',?,?)")
    .bind(x.kind, x.body, x.reply, x.gu, x.screen, now, now).run();
  await db.prepare("INSERT INTO inquiry_rate (ip_hash,at) VALUES (?,?)").bind(ip, now).run();
  return json({ ok: true, ticket: r.meta.last_row_id });
}

