#!/usr/bin/env python3
"""운영 감시 v01후보 (2026-11-03, 024) — 매시간 돌며 '현재 장애 / 검증 필요 / 공개 보류 / 복구 완료'를 한 파일(ops/monitor.json)로 집계한다.

  python3 tools/monitor.py [--out ops/monitor.json] [--log ops/incidents_log.json] [--fixtures fixtures.json] [--dry-run]

읽는 것(외부 공공 API 호출 0 — 저장소·배포 상태만 본다):
- GitHub API: 저장소 기본 가지·가지 head 날짜, 자동 작업(workflow) 최근 실행 결과 (GITHUB_TOKEN 있으면 사용)
- raw.githubusercontent: 앱이 읽는 가지(main)의 data/<구>/_status.json, 기본 가지의 review/<구>/_reverify.json, airang-stats 의 data/cf-apps.txt(배포 기록)
- 고객 사이트: https://airang-daejeon-all.pages.dev/<구>/ 응답 코드
판정(안전 기준은 tools/safety_policy.json — 모든 운영 지역 동일, 서울·경기는 정책 위반):
- 장애(P1~P2): 작업 실패·작업 누락(일정 간격 초과)·올리기 실패·배포 실패·사이트 응답 오류·_status 못 읽음·브랜치 지연(앱이 읽는 가지가 기본 가지보다 오래됨)·자료 만료·검문 멈춤·정책 위반
- 검증 필요(P2~P3): 자동 검사 실패·의미 변경 과다 보류·지역 섞임 의심·재검증 대기(의미 변경)·공개 중이지만 원문 부분 확인
- 공개 보류: 원문 미확인으로 숨긴 자료(급식·특목·날씨 등)
- 복구 완료: 직전 집계에 있던 장애·검증 필요가 사라지면 자동으로 ops/incidents_log.json 에 해결 시각을 적는다
표준 라이브러리만 사용. 종료 코드는 항상 0(감시 자체는 운영을 멈추지 않음). --strict 면 장애가 있을 때 1.
"""
import argparse, json, os, re, sys, glob, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone, date

KST = timezone(timedelta(hours=9))
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
try:
    POLICY = json.load(open(os.path.join(HERE, "safety_policy.json"), encoding="utf-8"))
except Exception:
    POLICY = {}
CITIES_REPO = "leejunsik22-gif/airang-cities"
STATS_REPO = "leejunsik22-gif/airang-stats"
API = "https://api.github.com"
RAW = "https://raw.githubusercontent.com"
CADENCE = {k: v for k, v in POLICY.get("expected_cadence_hours", {"daily": 26, "weather": 8, "hospitals": 192, "cf-apps": 7}).items() if not k.startswith("_")}
WF_REPO = {"daily": CITIES_REPO, "weather": CITIES_REPO, "hospitals": CITIES_REPO, "cf-apps": STATS_REPO}
LOG_MAX = 300


class Fetcher:
    """HTTP GET (텍스트). --fixtures 가 있으면 그 표에서 읽는다(오프라인 시험)."""
    def __init__(self, fixtures=None, token="", live_fallback=False):
        self.fx = fixtures or {}; self.token = token; self.calls = 0; self.errors = []; self.live = live_fallback

    def get(self, url, kind="text"):
        self.calls += 1
        if self.fx and (url in self.fx or not self.live):
            f = self.fx.get(url)
            if f is None:
                return 404, ""
            if "file" in f:
                try:
                    return f.get("status", 200), open(f["file"], encoding="utf-8").read()
                except Exception as e:
                    return 599, str(e)
            return f.get("status", 200), f.get("body", "")
        req = urllib.request.Request(url, headers={"User-Agent": "airang-monitor/1.0", **({"Authorization": "Bearer " + self.token} if self.token and url.startswith(API) else {})})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.status, r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            return e.code, ""
        except Exception as e:
            self.errors.append(f"{url}: {e}")
            return 599, str(e)

    def json(self, url):
        st, body = self.get(url)
        if st != 200:
            return st, None
        try:
            return st, json.loads(body)
        except Exception:
            return 598, None


def operating_cities():
    out = []
    for p in sorted(glob.glob(os.path.join(ROOT, "regions", "*.json"))):
        if os.path.basename(p).startswith("_"):
            continue
        try:
            r = json.load(open(p, encoding="utf-8"))
        except Exception:
            continue
        for k, c in r.get("cities", {}).items():
            st = c.get("stage", r.get("stage", "후보"))
            if st == "운영" and c.get("dir"):
                out.append({"key": k, "dir": c["dir"], "name": c.get("area", k), "sido": c.get("sido", r.get("sido_key", ""))})
    return out


def parse_iso(s):
    try:
        return datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except Exception:
        return None


def hours_since(ts, now):
    d = parse_iso(ts)
    return None if d is None else (now - d).total_seconds() / 3600


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "ops", "monitor.json"))
    ap.add_argument("--log", default=os.path.join(ROOT, "ops", "incidents_log.json"))
    ap.add_argument("--fixtures", default="", help="오프라인 시험용 {url: {status, body|file}} JSON")
    ap.add_argument("--now", default="", help="시험용 기준 시각(UTC ISO)")
    ap.add_argument("--dry-run", action="store_true"); ap.add_argument("--strict", action="store_true")
    ap.add_argument("--live-fallback", action="store_true", help="fixtures 에 없는 주소는 실제로 요청(부분 오프라인 시험)")
    a = ap.parse_args()
    fx = json.load(open(a.fixtures, encoding="utf-8")) if a.fixtures else None
    F = Fetcher(fx, os.environ.get("GITHUB_TOKEN", ""), a.live_fallback)
    now = parse_iso(a.now) if a.now else datetime.now(timezone.utc)
    now_kst = now.astimezone(KST); today = now_kst.date()
    app_branch = POLICY.get("app_data_branch", "main"); site = POLICY.get("site_base", "https://airang-daejeon-all.pages.dev")
    cities = operating_cities()
    inc, checks = [], []

    def add(kind, state, sev, title, detail="", city="", url=""):
        inc.append({"id": f"{kind}:{city or '-'}", "kind": kind, "state": state, "severity": sev, "city": city, "title": title, "detail": detail, "url": url})

    # 1) 저장소·가지
    st, repo = F.json(f"{API}/repos/{CITIES_REPO}")
    default_branch = (repo or {}).get("default_branch", "") if st == 200 else ""
    branches = {"default": default_branch, "app_branch": app_branch, "lag": False}
    if default_branch:
        _, bd = F.json(f"{API}/repos/{CITIES_REPO}/branches/{default_branch}")
        _, ba = F.json(f"{API}/repos/{CITIES_REPO}/branches/{app_branch}") if app_branch != default_branch else (None, bd)
        dd = ((bd or {}).get("commit") or {}).get("commit", {}).get("committer", {}).get("date", "")
        da = ((ba or {}).get("commit") or {}).get("commit", {}).get("committer", {}).get("date", "")
        branches.update(default_head_at=dd, app_head_at=da)
        if default_branch != app_branch and dd and da and (parse_iso(dd) - parse_iso(da)).total_seconds() > 3600:
            branches["lag"] = True
            add("branch_lag", "장애", "P1", f"앱이 읽는 가지({app_branch})가 기본 가지({default_branch})보다 오래됨", f"자동 수집은 기본 가지에 쌓이고 앱은 {app_branch} 을 읽는다 — 고객 화면이 최신 수집본이 아님 (기본 가지 {dd} / {app_branch} {da}). 대표가 기본 가지를 {app_branch} 으로 바꾸거나 반영 절차 필요", url=f"https://github.com/{CITIES_REPO}/branches")
        checks.append("가지 비교")
    else:
        add("github_api", "장애", "P2", "GitHub 저장소 정보를 읽지 못함", f"HTTP {st} — 감시 자체가 불완전함")

    # 2) 자동 작업 실행 기록
    runs = {}
    for repo_name in (CITIES_REPO, STATS_REPO):
        st, j = F.json(f"{API}/repos/{repo_name}/actions/runs?per_page=60")
        if st != 200 or not j:
            add("github_api", "장애", "P2", f"{repo_name.split('/')[1]} 작업 기록을 읽지 못함", f"HTTP {st}"); continue
        for w in j.get("workflow_runs", []):
            name = w.get("name", "").split(" (")[0]
            if name not in CADENCE or WF_REPO.get(name) != repo_name:
                continue
            r = runs.setdefault(name, {"last_at": "", "last_conclusion": "", "last_url": "", "last_success_at": "", "overdue": False})
            if not r["last_at"] or w["created_at"] > r["last_at"]:
                r.update(last_at=w["created_at"], last_conclusion=w.get("conclusion") or w.get("status"), last_url=w.get("html_url", ""))
            if w.get("conclusion") == "success" and w["created_at"] > r["last_success_at"]:
                r["last_success_at"] = w["created_at"]
    for name, cad in CADENCE.items():
        r = runs.get(name)
        if not r:
            add("run_missing", "장애", "P3", f"'{name}' 자동 작업 실행 기록 없음", f"최근 실행 목록에 없음 — 일정이 꺼져 있거나 기본 가지에 워크플로가 없음(예상 간격 {cad}시간)", url=f"https://github.com/{WF_REPO[name]}/actions")
            continue
        hs = hours_since(r["last_at"], now)
        if hs is not None and hs > cad:
            r["overdue"] = True
            add("run_missing", "장애", "P2", f"'{name}' 자동 작업이 {hs:.0f}시간째 돌지 않음", f"예상 간격 {cad}시간 — 마지막 실행 {r['last_at']} ({r['last_conclusion']})", url=r["last_url"])
        if r["last_conclusion"] in ("failure", "timed_out", "cancelled") and (not r["last_success_at"] or r["last_success_at"] < r["last_at"]):
            add("run_failed", "장애", "P1", f"'{name}' 마지막 실행 실패({r['last_conclusion']})", f"{r['last_at']} — 수집본·배포가 반영되지 않았을 수 있음(올리기 실패 포함)", url=r["last_url"])
    checks.append(f"자동 작업 {len(runs)}종")

    # 3) 배포 기록(airang-stats cf-apps.txt)
    st, body = F.get(f"{RAW}/{STATS_REPO}/main/data/cf-apps.txt")
    if st == 200:
        if "배포 실패" in body:
            add("deploy_failed", "장애", "P1", "앱 배포(cf-apps) 실패 기록", body.strip().splitlines()[-1][:160] if body.strip() else "", url=f"https://github.com/{STATS_REPO}/actions")
        checks.append("배포 기록")
    else:
        add("deploy_log", "장애", "P3", "배포 기록(cf-apps.txt)을 읽지 못함", f"HTTP {st}")

    # 4) 구별: 사이트 응답 · _status(앱 가지) · 만료 · 검문 결과 · 재검증 대기 · 정책
    city_rows = {}
    excluded = set(POLICY.get("excluded_sido", []))
    for c in cities:
        d = c["dir"]; row = {"name": c["name"], "sido": c["sido"], "site": None, "status_checked_at": "", "published": 0, "hold": [], "fail": [], "expired": [], "region": [], "unverified": [], "reverify": 0, "file_hold": {}, "auto_pass": 0, "official_done": 0, "official_partial": 0}
        if c["sido"] in excluded:
            add("policy_violation", "장애", "P1", f"{c['name']}: 정책 제외 시·도({c['sido']})가 운영 목록에 있음", "서울·경기는 아이랑 대상이 아님 — regions/*.json 확인", city=d)
        st, _ = F.get(f"{site}/{d}/")
        row["site"] = st
        if st != 200:
            add("site_down", "장애", "P1", f"{c['name']} 앱 주소 응답 오류(HTTP {st})", f"{site}/{d}/", city=d, url=f"{site}/{d}/")
        st, sj = F.json(f"{RAW}/{CITIES_REPO}/{app_branch}/data/{d}/_status.json")
        if st != 200 or not sj:
            add("status_unreadable", "장애", "P1", f"{c['name']} 검문 결과(_status.json)를 앱 가지에서 읽지 못함(HTTP {st})", "앱이 검문 상태 없이 동작 → 보류 메뉴가 열릴 수 있음", city=d)
        else:
            row["status_checked_at"] = sj.get("checked_at", "")
            ca = None
            try: ca = date.fromisoformat(sj.get("checked_at", ""))
            except Exception: pass
            if ca is None or (today - ca).days > 2:
                add("gate_stale", "장애", "P2", f"{c['name']} 검문이 {(today - ca).days if ca else '?'}일째 돌지 않음", f"마지막 검문 {sj.get('checked_at','')} — 수집 작업 멈춤 또는 가지 불일치", city=d)
            for fn, e in (sj.get("files") or {}).items():
                lab = e.get("label", fn)
                if e.get("published"):
                    row["published"] += 1
                    if str(e.get("auto_check", "")).startswith("통과"): row["auto_pass"] += 1          # 자동 수집·검사 성공
                    if e.get("official_verify") == "확인 완료": row["official_done"] += 1            # 기관 원문 검증 완료(사람)
                    elif e.get("official_verify") == "부분 확인": row["official_partial"] += 1
                    vd, up = e.get("valid_days"), e.get("updated")
                    if vd and up:
                        try:
                            if (today - date.fromisoformat(up)).days > vd:
                                row["expired"].append(lab)
                        except Exception:
                            pass
                    if e.get("official_verify") and e["official_verify"] != "확인 완료":
                        row["unverified"].append(lab)
                if e.get("hold"):
                    row["hold"].append(lab)
                if re.search(r"실패|만료|과다", e.get("auto_check", "") or ""):
                    row["fail"].append(f"{lab}({e.get('auto_check')})")
                if e.get("region_check") == "실패":
                    row["region"].append(lab)
                if e.get("reverify_pending"):
                    row["reverify"] += int(e["reverify_pending"])
            if row["expired"]:
                add("data_expired", "장애", "P2", f"{c['name']} 공개 자료 유효기간 지남: {', '.join(row['expired'])}", "고객 화면에 오래된 자료 — 수집 작업 확인", city=d)
            if row["fail"]:
                add("gate_failed", "검증 필요", "P2", f"{c['name']} 자동 검사 실패·만료·보류: {', '.join(row['fail'])}", "직전 공개본 유지 중 — 수집기·원천 자료 확인", city=d)
            if row["region"]:
                add("region_mix", "검증 필요", "P2", f"{c['name']} 지역 섞임 의심: {', '.join(row['region'])}", "새 수집본 격리됨 — 수집기 지역 코드 확인", city=d)
            if row["hold"]:
                add("hold", "공개 보류", "P3", f"{c['name']} 원문 미확인 보류: {', '.join(row['hold'])}", "표본 대조 뒤 data_rules.json official_verify 갱신 필요", city=d)
            if row["unverified"]:
                add("partial_verify", "검증 필요", "P3", f"{c['name']} 공개 중·원문 부분 확인: {', '.join(row['unverified'])}", "자동 검사는 통과, 기관 원문 전수 대조는 미완료", city=d)
        # 028: 고객 화면 갱신 판정 — 앱 가지(main)의 검문일 vs 기본 가지의 검문일. 자동 수집 성공 ≠ 고객 화면 갱신
        if default_branch and default_branch != app_branch:
            st2, sj2 = F.json(f"{RAW}/{CITIES_REPO}/{default_branch}/data/{d}/_status.json")
            if st2 == 200 and sj2:
                row["default_checked_at"] = sj2.get("checked_at", "")
                if row["status_checked_at"] and row["default_checked_at"] > row["status_checked_at"]:
                    row["customer_stale"] = True
                    add("customer_stale", "장애", "P1", f"{c['name']} 고객 화면이 최신 수집본이 아님", f"앱이 읽는 {app_branch} 검문 {row['status_checked_at']} < 기본 가지 검문 {row['default_checked_at']} — 자동 수집은 성공했지만 고객 화면은 갱신되지 않음", city=d)
        if sj and sj.get("files"):
            for fn, e in sj["files"].items():
                if e.get("source_outage"):
                    add("source_outage", "검증 필요", "P2", f"{c['name']} {e.get('label', fn)} 원천 누락 의심(직전 기록 유지)", e["source_outage"], city=d)
        # 재검증 대기(의미 변경) — 기본 가지의 review/<구>/_reverify.json
        st, rv = F.json(f"{RAW}/{CITIES_REPO}/{default_branch or app_branch}/review/{d}/_reverify.json")
        if st == 200 and rv:
            pend = rv.get("pending", []) or []
            row["reverify"] = max(row["reverify"], len(pend)); row["file_hold"] = rv.get("file_hold") or {}
            if pend:
                files = sorted({p.get("file", "") for p in pend})
                add("reverify_pending", "검증 필요", "P2" if row["file_hold"] else "P3", f"{c['name']} 의미 변경 재검증 대기 {len(pend)}건: {', '.join(files)}", "직전 공개본 값으로 공개 중 — 원문 대조 뒤 approvals/reverify.json 승인", city=d, url=f"https://github.com/{CITIES_REPO}/blob/{default_branch or app_branch}/review/{d}/_reverify.json")
            for fn, why in (row["file_hold"] or {}).items():
                add("file_hold", "검증 필요", "P2", f"{c['name']} {fn} 파일째 보류(의미 변경 과다)", why, city=d)
        city_rows[d] = row
    checks.append(f"구 {len(cities)}곳 사이트·검문·재검증")

    # 5) 직전 집계와 비교 → since 유지, 사라진 것은 복구 완료로 기록
    prev = {}
    try:
        prev = json.load(open(a.out, encoding="utf-8"))
    except Exception:
        prev = {}
    prev_inc = {i["id"]: i for i in prev.get("incidents", [])}
    now_s = now_kst.strftime("%Y-%m-%d %H:%M")
    for i in inc:
        i["since"] = prev_inc.get(i["id"], {}).get("since", now_s); i["last_seen"] = now_s
    cur_ids = {i["id"] for i in inc}
    try:
        log = json.load(open(a.log, encoding="utf-8"))
    except Exception:
        log = {"_설명": "장애·검증 필요가 사라진 시각을 감시가 자동 기록(복구 완료). 사람이 적는 복구 이력은 ops/recovery_log.json", "items": []}
    resolved_now = []
    for pid, pi in prev_inc.items():
        if pid not in cur_ids and pi.get("state") in ("장애", "검증 필요"):
            item = {"id": pid, "kind": pi.get("kind"), "state": pi.get("state"), "city": pi.get("city", ""), "title": pi.get("title", ""), "since": pi.get("since", ""), "resolved_at": now_s, "how": "자동(감시에서 사라짐)"}
            log["items"].insert(0, item); resolved_now.append(item)
    log["items"] = log["items"][:LOG_MAX]
    week_ago = (now_kst - timedelta(days=7)).strftime("%Y-%m-%d %H:%M")
    recovered = [x for x in log["items"] if x.get("resolved_at", "") >= week_ago]

    sev_order = {"P1": 0, "P2": 1, "P3": 2}
    inc.sort(key=lambda i: (["장애", "검증 필요", "공개 보류"].index(i["state"]), sev_order.get(i["severity"], 9), i["city"]))
    customer_view = {"app_branch": app_branch, "default_branch": default_branch, "fresh": not any(r.get("customer_stale") for r in city_rows.values()), "stale_cities": [r["name"] for r in city_rows.values() if r.get("customer_stale")],
                     "note": "자동 수집 성공(기본 가지 커밋) ≠ 고객 화면 갱신(앱이 읽는 가지). fresh=false 면 고객은 옛 자료를 보고 있음"}
    summary = {"장애": sum(1 for i in inc if i["state"] == "장애"), "검증 필요": sum(1 for i in inc if i["state"] == "검증 필요"), "공개 보류": sum(1 for i in inc if i["state"] == "공개 보류"), "복구 완료(7일)": len(recovered)}
    out = {"_설명": "운영 감시 집계(tools/monitor.py, 매시간). 상태: 장애=지금 고쳐야 함 / 검증 필요=공개 중이거나 보류 중이지만 사람 확인 필요 / 공개 보류=원문 미확인으로 숨김 / 복구 완료=직전 집계에 있던 문제가 사라짐. 앱은 읽지 않음(관리자만)",
           "checked_at": now_s, "checked_at_utc": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "ok": summary["장애"] == 0, "summary": summary, "incidents": inc, "recovered": recovered[:50], "resolved_now": resolved_now,
           "cities": city_rows, "runs": runs, "branches": branches, "customer_view": customer_view, "checks_done": checks, "fetch_errors": F.errors[:20], "http_calls": F.calls, "external_api_calls": 0,
           "preapproval_rules": _rules_state()}
    if not a.dry_run:
        os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
        json.dump(out, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        json.dump(log, open(a.log, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"[{now_s} KST] 장애 {summary['장애']} · 검증 필요 {summary['검증 필요']} · 공개 보류 {summary['공개 보류']} · 복구 완료(7일) {summary['복구 완료(7일)']} · HTTP {F.calls}회 · 외부 공공 API 0회")
    for i in inc:
        print(f"  [{i['state']}/{i['severity']}] {i['title']}" + (f" — {i['detail'][:90]}" if i['detail'] else ""))
    for r in resolved_now:
        print(f"  [복구 완료] {r['title']} (since {r['since']})")
    if a.strict and summary["장애"]:
        sys.exit(1)


def _rules_state():
    try:
        pa = json.load(open(os.path.join(HERE, "change_rules.json"), encoding="utf-8")).get("preapproval", {})
        return {"approved": bool(pa.get("approved_by") and pa.get("approved_at")), "approved_by": pa.get("approved_by", ""), "approved_at": pa.get("approved_at", ""), "label": "사전 승인 규칙 " + ("승인됨" if pa.get("approved_by") else "초안(대표 승인 전)")}
    except Exception:
        return {"approved": False, "label": "규칙 파일 없음"}


if __name__ == "__main__":
    main()
