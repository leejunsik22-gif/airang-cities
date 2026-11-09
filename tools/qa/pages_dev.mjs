// 아이랑 문의 A안 로컬 시험 서버 v01후보 (2026-11-09) — 운영·Cloudflare 계정과 무관
// Cloudflare Pages(화면) + Pages Functions(functions/) + D1(저장소)을 내 컴퓨터에서 흉내 낸다.
//   node tools/qa/pages_dev.mjs [PORT=8791]
// - 화면: app/build.py 로 임시 폴더에 만든 것을 그대로 보여 줌
// - D1: Node 내장 sqlite 로 같은 사용법(prepare/bind/run/first/all)을 흉내 냄(메모리 저장 — 끄면 사라짐)
// - 관리자 비밀번호: 시험용 가상값(test-password-가상-1234)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = +(process.argv[2] || 8791);
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "airang-pages-"));
execFileSync("python3", [path.join(ROOT, "app/build.py"), "--out", OUT, "--city", "yuseong", "--city", "entry"], { cwd: ROOT, stdio: "ignore" });

// ── D1 흉내 ──
const sql = new DatabaseSync(":memory:");
class Stmt {
  constructor(q, args = []) { this.q = q; this.args = args; }
  bind(...a) { return new Stmt(this.q, a); }
  async run() { const r = sql.prepare(this.q).run(...this.args); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; }
  async first() { return sql.prepare(this.q).get(...this.args) ?? null; }
  async all() { return { success: true, results: sql.prepare(this.q).all(...this.args) }; }
}
const D1 = { prepare: (q) => new Stmt(q) };

// ── 관리자 비밀번호(시험용 가상값 — 운영 비밀번호 아님) ──
export const TEST_ADMIN_PASSWORD = "test-password-가상-1234";
const ENV = { INQ_DB: D1, HASH_SALT: "local-test-salt", ADMIN_PASSWORD: TEST_ADMIN_PASSWORD };

// ── functions/ 경로 만들기(Pages 규칙: 파일 경로 = 주소, onRequestGet/Post…) ──
const ROUTES = {};
for (const f of ["api/inquiry/index.js", "api/inquiry/admin.js", "api/inquiry/login.js"]) {
  const mod = await import(pathToFileURL(path.join(ROOT, "functions", f)).href);
  ROUTES["/" + f.replace(/(\/index)?\.js$/, "")] = mod;
}
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (url.pathname === "/__test/age") {     // 시험 전용: 보관 기간 시험용으로 문의 날짜를 과거로 돌림
      sql.prepare("UPDATE inquiries SET created_at=created_at-?, done_at=CASE WHEN done_at IS NULL THEN NULL ELSE done_at-? END WHERE id=?").run(+url.searchParams.get("ms"), +url.searchParams.get("ms"), +url.searchParams.get("id"));
      res.writeHead(200); return res.end("ok");
    }
    const mod = ROUTES[url.pathname.replace(/\/$/, "")];
    if (mod) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
      headers.set("cf-connecting-ip", req.headers["x-test-ip"] || req.socket.remoteAddress);
      const request = new Request(url, { method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
      const fn = mod["onRequest" + req.method[0] + req.method.slice(1).toLowerCase()] || mod.onRequest;
      const r = fn ? await fn({ request, env: ENV, params: {} }) : new Response("Method Not Allowed", { status: 405 });
      res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
    }
    let p = path.join(OUT, decodeURIComponent(url.pathname));
    if (!p.startsWith(OUT)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
    if (!fs.existsSync(p)) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
  } catch (e) { console.error(e); res.writeHead(500); res.end("error"); }
}).listen(PORT, "127.0.0.1", () => console.log(`문의 A안 시험 서버: http://127.0.0.1:${PORT}/inquiry/  (관리자: /inquiry/admin/)`));
