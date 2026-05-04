"""
End-to-end smoke test for the demo stack.
Runs against http://localhost (nginx) and http://localhost:8080 (backend direct).

Stdlib-only — no `pip install` required.

Each test is independent and reports PASS/FAIL with a one-line reason.
The suite is ordered so destructive tests (rate-limit spam) run last.
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

# Force UTF-8 stdout on Windows consoles (cp1252 by default).
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

NGINX_BASE   = "http://localhost"
BACKEND_BASE = "http://localhost:8080"

ADMIN_USER, ADMIN_PASS       = "admin",          "ChangeMe!2026"
SECTION_USER, SECTION_PASS   = "section_fi_dam", "ChangeMe!2026"
LAWYER_USER, LAWYER_PASS     = "lawyer_fi_dam",  "ChangeMe!2026"
CLERK_USER,  CLERK_PASS      = "clerk_fi_dam",   "ChangeMe!2026"
VIEWER_USER, VIEWER_PASS     = "viewer",         "ChangeMe!2026"

# ──────────────────────────────────────────────────────────────
# Tiny HTTP helper (stdlib only)
# ──────────────────────────────────────────────────────────────

class Resp:
    def __init__(self, status: int, headers: dict[str, str], body: bytes):
        self.status = status
        self.headers = {k.lower(): v for k, v in headers.items()}
        self.body = body
        try:
            self.json: Any = json.loads(body) if body else None
        except (json.JSONDecodeError, UnicodeDecodeError):
            # Binary payload (e.g. PDF download) — body is bytes; .json stays None.
            self.json = None

    @property
    def text(self) -> str:
        return self.body.decode("utf-8", errors="replace")


def request(method: str, url: str, *, headers: dict | None = None,
            json_body: Any = None, raw_body: bytes | None = None,
            content_type: str | None = None, timeout: float = 30.0,
            client_ip: str | None = None) -> Resp:
    data: bytes | None = None
    h = dict(headers or {})
    if json_body is not None:
        data = json.dumps(json_body).encode("utf-8")
        h.setdefault("Content-Type", "application/json")
    elif raw_body is not None:
        data = raw_body
        if content_type:
            h.setdefault("Content-Type", content_type)
    # The Spring rate-limit filter buckets per-IP and trusts X-Forwarded-For
    # when present (so the proxy chain works in production). Tests spoof a
    # unique IP per section to keep buckets isolated — otherwise all tests
    # would shadow each other through the single 10/min bucket.
    if client_ip:
        h.setdefault("X-Forwarded-For", client_ip)

    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return Resp(r.status, dict(r.headers.items()), r.read())
    except urllib.error.HTTPError as e:
        return Resp(e.code, dict(e.headers.items()) if e.headers else {}, e.read() or b"")
    except urllib.error.URLError as e:
        return Resp(0, {}, str(e).encode())


# ──────────────────────────────────────────────────────────────
# Multipart helper for upload tests
# ──────────────────────────────────────────────────────────────

def multipart_body(field: str, filename: str, content_type: str,
                   payload: bytes) -> tuple[bytes, str]:
    boundary = "----E2EBoundary7d3a9b1c"
    parts = [
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'.encode(),
        f"Content-Type: {content_type}\r\n\r\n".encode(),
        payload,
        f"\r\n--{boundary}--\r\n".encode(),
    ]
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


# ──────────────────────────────────────────────────────────────
# Test reporter
# ──────────────────────────────────────────────────────────────

results: list[tuple[str, bool, str, str]] = []  # (id, ok, name, detail)


def record(test_id: str, name: str, ok: bool, detail: str = "") -> bool:
    results.append((test_id, ok, name, detail))
    icon = "✅" if ok else "❌"
    print(f"  {icon} [{test_id}] {name}" + (f" — {detail}" if detail else ""))
    return ok


def section(title: str) -> None:
    print(f"\n━━━ {title} ━━━")


# ──────────────────────────────────────────────────────────────
# Auth helpers
# ──────────────────────────────────────────────────────────────

def login(username: str, password: str, base: str = BACKEND_BASE,
          client_ip: str | None = None) -> Resp:
    return request("POST", f"{base}/api/v1/auth/login",
                   json_body={"username": username, "password": password},
                   client_ip=client_ip)


def login_and_get_token(username: str, password: str,
                        client_ip: str | None = None) -> str | None:
    r = login(username, password, client_ip=client_ip)
    if r.status == 200 and r.json and "accessToken" in r.json:
        return r.json["accessToken"]
    return None


# ──────────────────────────────────────────────────────────────
# Tests
# ──────────────────────────────────────────────────────────────

def test_section_health() -> None:
    section("Health probes (PR-5: Actuator)")

    r = request("GET", f"{BACKEND_BASE}/actuator/health/liveness")
    record("HEALTH-1", "GET /actuator/health/liveness → UP",
           r.status == 200 and r.json and r.json.get("status") == "UP",
           f"status={r.status} body={r.text[:60]}")

    r = request("GET", f"{BACKEND_BASE}/actuator/health/readiness")
    record("HEALTH-2", "GET /actuator/health/readiness → UP (DB connected)",
           r.status == 200 and r.json and r.json.get("status") == "UP",
           f"status={r.status} body={r.text[:60]}")

    r = request("GET", f"{NGINX_BASE}/nginx-health")
    record("HEALTH-3", "GET nginx /nginx-health → 200 ok",
           r.status == 200 and r.text.strip() == "ok",
           f"status={r.status} body={r.text[:30]}")


def test_section_security_headers() -> None:
    section("Security headers (PR-6)")

    # Backend → expect Spring Security headers
    r = request("GET", f"{BACKEND_BASE}/actuator/health/liveness")
    expected_backend = {
        "x-frame-options":         "DENY",
        "x-content-type-options":  "nosniff",
        "referrer-policy":         "strict-origin-when-cross-origin",
    }
    for header, expected in expected_backend.items():
        actual = r.headers.get(header, "<missing>")
        record(f"HDR-B-{header}",
               f"backend response has {header}: {expected}",
               expected.lower() in actual.lower(),
               f"got: {actual}")
    # NOTE: Spring Security only emits HSTS over HTTPS by design. Hitting the
    # backend over plain HTTP omits the header — that's CORRECT behavior. The
    # nginx layer (which is the public face) emits HSTS unconditionally; that
    # assertion is the meaningful one and is checked below.
    record("HDR-B-csp",
           "backend response has Content-Security-Policy",
           "content-security-policy" in r.headers,
           f"got: {r.headers.get('content-security-policy', '<missing>')[:80]}")

    # Nginx (the SPA) → expect HSTS, CSP, Permissions-Policy
    r = request("GET", f"{NGINX_BASE}/")
    nginx_required = [
        "strict-transport-security",
        "x-frame-options",
        "x-content-type-options",
        "referrer-policy",
        "content-security-policy",
        "permissions-policy",
    ]
    for h in nginx_required:
        record(f"HDR-N-{h}",
               f"nginx response has {h}",
               h in r.headers,
               f"got: {r.headers.get(h, '<missing>')[:80]}")


def test_section_login() -> None:
    section("Login flows")
    ip = "10.10.10.1"

    r = login(ADMIN_USER, ADMIN_PASS, client_ip=ip)
    record("LOGIN-1", "admin login → 200 with tokens",
           r.status == 200 and r.json and "accessToken" in r.json,
           f"status={r.status}")

    # Dev-seed verification (PR-3 P8b-01)
    r = login(SECTION_USER, SECTION_PASS, client_ip=ip)
    record("LOGIN-2", "dev-seed user section_fi_dam login → 200 (P8b-01 fix)",
           r.status == 200 and r.json and "accessToken" in r.json,
           f"status={r.status}")

    r = login(LAWYER_USER, LAWYER_PASS, client_ip=ip)
    record("LOGIN-3", "dev-seed user lawyer_fi_dam login → 200",
           r.status == 200,
           f"status={r.status}")

    r = login(CLERK_USER, CLERK_PASS, client_ip=ip)
    record("LOGIN-4", "dev-seed user clerk_fi_dam login → 200",
           r.status == 200,
           f"status={r.status}")

    r = login("nonexistent_user_zzz", "whatever", client_ip=ip)
    record("LOGIN-5", "unknown username → 401 INVALID_CREDENTIALS",
           r.status == 401 and r.json and r.json.get("code") == "INVALID_CREDENTIALS",
           f"status={r.status} body={r.text[:80]}")


def test_section_refresh_and_family_revocation() -> None:
    section("Refresh-token rotation + family revocation (PR-4 P1-01)")
    ip = "10.10.10.2"

    r = login(ADMIN_USER, ADMIN_PASS, client_ip=ip)
    if r.status != 200:
        record("RT-PRE", "could not get tokens; skipping refresh tests", False, f"status={r.status}")
        return

    rt1 = r.json["refreshToken"]

    # Rotate once
    r2 = request("POST", f"{BACKEND_BASE}/api/v1/auth/refresh-token",
                 json_body={"refreshToken": rt1}, client_ip=ip)
    record("RT-1", "refresh-token rotation → new pair",
           r2.status == 200 and r2.json and "refreshToken" in r2.json
           and r2.json["refreshToken"] != rt1,
           f"status={r2.status}")
    if r2.status != 200:
        return
    rt2 = r2.json["refreshToken"]

    # Replay the OLD (revoked) refresh-token → must fail
    r3 = request("POST", f"{BACKEND_BASE}/api/v1/auth/refresh-token",
                 json_body={"refreshToken": rt1}, client_ip=ip)
    record("RT-2", "replay of revoked RT → 401",
           r3.status == 401,
           f"status={r3.status} body={r3.text[:80]}")

    # The replay should have killed the FAMILY — the new RT (rt2) must also be dead.
    r4 = request("POST", f"{BACKEND_BASE}/api/v1/auth/refresh-token",
                 json_body={"refreshToken": rt2}, client_ip=ip)
    record("RT-3", "replay revoked WHOLE FAMILY: rt2 also rejected (P1-01)",
           r4.status == 401,
           f"status={r4.status} body={r4.text[:80]}")


def test_section_change_password() -> None:
    section("Change-password endpoint (PR-4 D-049)")
    ip = "10.10.10.3"

    # Use the lawyer user — fresh login each test
    r = login(LAWYER_USER, LAWYER_PASS, client_ip=ip)
    if r.status != 200:
        record("CP-PRE", "could not log in for change-password test", False, f"status={r.status}")
        return
    token = r.json["accessToken"]

    # Wrong old password → BAD_OLD_PASSWORD
    r1 = request("POST", f"{BACKEND_BASE}/api/v1/auth/change-password",
                 headers={"Authorization": f"Bearer {token}"},
                 json_body={"oldPassword": "WrongOld!", "newPassword": "NewPass!23"})
    record("CP-1", "wrong oldPassword → 400 BAD_OLD_PASSWORD",
           r1.status == 400 and r1.json and r1.json.get("code") == "BAD_OLD_PASSWORD",
           f"status={r1.status} body={r1.text[:80]}")

    # Same new = old → WEAK_PASSWORD
    r2 = request("POST", f"{BACKEND_BASE}/api/v1/auth/change-password",
                 headers={"Authorization": f"Bearer {token}"},
                 json_body={"oldPassword": LAWYER_PASS, "newPassword": LAWYER_PASS})
    record("CP-2", "new == old → 400 WEAK_PASSWORD",
           r2.status == 400 and r2.json and r2.json.get("code") == "WEAK_PASSWORD",
           f"status={r2.status} body={r2.text[:80]}")

    # Real change → 200, then login with NEW password works, OLD does not
    new_pwd = "NewLawyerPass!23"
    r3 = request("POST", f"{BACKEND_BASE}/api/v1/auth/change-password",
                 headers={"Authorization": f"Bearer {token}"},
                 json_body={"oldPassword": LAWYER_PASS, "newPassword": new_pwd})
    record("CP-3", "valid change → 200",
           r3.status == 200,
           f"status={r3.status} body={r3.text[:80]}")

    if r3.status == 200:
        r4 = login(LAWYER_USER, new_pwd, client_ip=ip)
        record("CP-4", "login with NEW password → 200",
               r4.status == 200,
               f"status={r4.status}")
        r5 = login(LAWYER_USER, LAWYER_PASS, client_ip=ip)
        record("CP-5", "login with OLD password → 401",
               r5.status == 401,
               f"status={r5.status}")
        # restore for any later tests
        if r4.status == 200:
            request("POST", f"{BACKEND_BASE}/api/v1/auth/change-password",
                    headers={"Authorization": f"Bearer {r4.json['accessToken']}"},
                    json_body={"oldPassword": new_pwd, "newPassword": LAWYER_PASS},
                    client_ip=ip)


def test_section_uploads() -> None:
    section("Upload safety (PR-5 P2-01..P2-05)")
    ip = "10.10.10.4"

    # Need a section head + an existing case. Section head creates one for us.
    sec_token = login_and_get_token(SECTION_USER, SECTION_PASS, client_ip=ip)
    if not sec_token:
        record("UP-PRE", "could not log in section head", False, "")
        return

    # section_fi_dam from V20 dev seed lives at:
    #   branch  = 1 (DAMASCUS)
    #   dept    = 2 (FIRST_INSTANCE of branch 1)
    #   court   = 2 (محكمة البداية - دمشق, branch 1's FIRST_INSTANCE court)
    case_body = {
        "publicEntityName": "وزارة (e2e)",
        "publicEntityPosition": "PLAINTIFF",
        "opponentName": "خصم",
        "originalBasisNumber": f"E2E-{int(time.time())}",
        "basisYear": 2026,
        "originalRegistrationDate": "2026-02-01",
        "branchId": 1, "departmentId": 2, "courtId": 2,
        "stageType": "FIRST_INSTANCE",
        "stageBasisNumber": f"S-E2E-{int(time.time())}",
        "stageYear": 2026,
        "firstHearingDate": "2026-04-01",
        "firstPostponementReason": "تعيين أول",
    }
    rc = request("POST", f"{BACKEND_BASE}/api/v1/cases",
                 headers={"Authorization": f"Bearer {sec_token}"},
                 json_body=case_body)
    if rc.status != 201:
        record("UP-PRE-CASE", "could not create case for upload test", False,
               f"status={rc.status} body={rc.text[:200]}")
        return
    stage_id = rc.json["stages"][0]["id"]
    record("UP-PRE-CASE", f"case + stage created (stageId={stage_id})", True, "")

    # Test 1: upload a real PDF (magic bytes = %PDF-1.7)
    pdf_bytes = b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\nfake-pdf-content"
    body, ct = multipart_body("file", "valid.pdf", "application/pdf", pdf_bytes)
    r = request("POST", f"{BACKEND_BASE}/api/v1/stages/{stage_id}/attachments",
                headers={"Authorization": f"Bearer {sec_token}"},
                raw_body=body, content_type=ct)
    pdf_id = r.json["id"] if (r.status == 200 and r.json) else None
    record("UP-1", "upload real PDF → 200",
           r.status == 200 and r.json and r.json.get("contentType") == "application/pdf",
           f"status={r.status} body={r.text[:120]}")

    # Test 2: upload a .txt file → reject
    body, ct = multipart_body("file", "notes.txt", "text/plain", b"Just plain text")
    r = request("POST", f"{BACKEND_BASE}/api/v1/stages/{stage_id}/attachments",
                headers={"Authorization": f"Bearer {sec_token}"},
                raw_body=body, content_type=ct)
    record("UP-2", "upload .txt → 400 DISALLOWED_FILE_TYPE",
           r.status == 400 and r.json and r.json.get("code") == "DISALLOWED_FILE_TYPE",
           f"status={r.status} body={r.text[:80]}")

    # Test 3: renamed binary (.pdf extension, not PDF magic) → reject
    body, ct = multipart_body("file", "fake.pdf", "application/pdf",
                              b"This is NOT a PDF, attacker-controlled content")
    r = request("POST", f"{BACKEND_BASE}/api/v1/stages/{stage_id}/attachments",
                headers={"Authorization": f"Bearer {sec_token}"},
                raw_body=body, content_type=ct)
    record("UP-3", "renamed binary (txt-as-pdf) → 400 DISALLOWED_FILE_TYPE",
           r.status == 400 and r.json and r.json.get("code") == "DISALLOWED_FILE_TYPE",
           f"status={r.status} body={r.text[:80]}")

    # Test 4: download the legitimate PDF — verify P2-03 hardening
    if pdf_id is not None:
        r = request("GET", f"{BACKEND_BASE}/api/v1/attachments/{pdf_id}/download",
                    headers={"Authorization": f"Bearer {sec_token}"})
        record("UP-4-status", "download → 200",
               r.status == 200,
               f"status={r.status}")
        record("UP-4-ct", "download Content-Type: application/octet-stream",
               r.headers.get("content-type", "").startswith("application/octet-stream"),
               f"got: {r.headers.get('content-type', '<missing>')}")
        record("UP-4-disp", "download Content-Disposition: attachment",
               "attachment" in r.headers.get("content-disposition", "").lower(),
               f"got: {r.headers.get('content-disposition', '<missing>')[:80]}")
        record("UP-4-nosniff", "download X-Content-Type-Options: nosniff",
               r.headers.get("x-content-type-options", "").lower() == "nosniff",
               f"got: {r.headers.get('x-content-type-options', '<missing>')}")


def test_section_forgot_password_no_leak() -> None:
    section("Forgot-password flow (PR-4 P1-07/P1-08)")

    # Hit forgot-password with an unknown mobile — must NOT reveal that.
    r = request("POST", f"{BACKEND_BASE}/api/v1/auth/forgot-password",
                json_body={"mobileNumber": "0999999999"})
    record("FP-1", "unknown mobile → 200 (constant-time mask)",
           r.status == 200,
           f"status={r.status} body={r.text[:60]}")

    # Hit it with a known mobile — also 200 (same external behavior).
    r = request("POST", f"{BACKEND_BASE}/api/v1/auth/forgot-password",
                json_body={"mobileNumber": "0000000004"})  # lawyer_fi_dam mobile
    record("FP-2", "known mobile → 200 (no enumeration signal)",
           r.status == 200,
           f"status={r.status} body={r.text[:60]}")


def reset_user_lockout(username: str) -> bool:
    """Test fixture: clear failed_login_count + locked_until via direct SQL.
    Necessary because the lockout state is intentionally sticky across requests
    (that's the point of P1-06), but harmless to wipe between test runs."""
    try:
        subprocess.run(
            ["docker", "exec", "court-platform-db-1",
             "psql", "-U", "sla", "-d", "sla_demo", "-c",
             f"UPDATE users SET failed_login_count=0, locked_until=NULL, "
             f"last_failed_login_at=NULL WHERE username='{username}'"],
            check=True, capture_output=True, timeout=10,
        )
        return True
    except Exception as ex:
        print(f"  (warn) could not reset lockout for {username}: {ex}")
        return False


def test_section_lockout() -> None:
    section("Login lockout (PR-4 P1-06)")
    ip = "10.10.10.5"

    user = VIEWER_USER  # use viewer for lockout — least disruptive
    target_pwd = VIEWER_PASS

    # Wipe any leftover lockout from a previous run (volumes persist).
    reset_user_lockout(user)

    # 5 wrong attempts → still INVALID_CREDENTIALS
    for i in range(1, 6):
        r = login(user, "definitely-wrong-pwd", client_ip=ip)
        if r.status != 401:
            record(f"LO-{i}",
                   f"wrong pwd attempt #{i} → 401",
                   False,
                   f"status={r.status} body={r.text[:80]}")
            return
        record(f"LO-{i}",
               f"wrong pwd attempt #{i} → 401 {r.json.get('code') if r.json else '?'}",
               r.json and r.json.get("code") == "INVALID_CREDENTIALS",
               f"code={r.json.get('code') if r.json else '?'}")

    # 6th attempt — even with the CORRECT password — should be ACCOUNT_LOCKED.
    r = login(user, target_pwd, client_ip=ip)
    record("LO-6",
           "after 5 fails, login refused with ACCOUNT_LOCKED (even with correct pwd)",
           r.status == 401 and r.json and r.json.get("code") == "ACCOUNT_LOCKED",
           f"status={r.status} body={r.text[:80]}")


def test_section_rate_limit() -> None:
    """
    Floods /auth/login on a dedicated client IP. Spring filter limit = 10/min/IP.
    Expect ≤ 10 successes/401s before the 11th+ returns 429.
    """
    section("Rate-limit on /auth/login (PR-5 P1-09)")
    ip = "10.10.10.6"

    seen_429 = False
    for i in range(15):
        r = login("nonexistent_user_for_rl", "x", client_ip=ip)
        if r.status == 429:
            seen_429 = True
            record(f"RL-{i+1}",
                   f"attempt #{i+1} → 429 RATE_LIMIT_EXCEEDED",
                   r.json and r.json.get("code") == "RATE_LIMIT_EXCEEDED",
                   f"retry-after={r.headers.get('retry-after', '?')}")
            break
        # otherwise 401 INVALID_CREDENTIALS as expected pre-cap
    if not seen_429:
        record("RL-cap",
               "rate-limit triggered within 15 attempts",
               False,
               "no 429 seen — limiter may be disabled or threshold higher than expected")


# ──────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────

def wait_until_ready(deadline_seconds: int = 60) -> bool:
    """Poll the backend until it answers /actuator/health/liveness with 200."""
    deadline = time.time() + deadline_seconds
    while time.time() < deadline:
        try:
            r = request("GET", f"{BACKEND_BASE}/actuator/health/liveness", timeout=3)
            if r.status == 200:
                return True
        except Exception:
            pass
        time.sleep(2)
    return False


def main() -> int:
    print("Waiting for backend to be ready…")
    if not wait_until_ready():
        print("❌ Backend never came up. Check `docker logs court-platform-backend-1`.")
        return 2
    print("Backend is ready.\n")

    # Run sections in order. Lockout MUST run before any /auth/login spam
    # (rate-limit) because the per-IP bucket is shared across all login
    # attempts in the JVM and would shadow ACCOUNT_LOCKED with 429s.
    test_section_health()
    test_section_security_headers()
    test_section_lockout()        # uses 6 failed logins; runs early on a fresh bucket
    test_section_login()
    test_section_refresh_and_family_revocation()
    test_section_change_password()
    test_section_uploads()
    test_section_forgot_password_no_leak()
    test_section_rate_limit()     # destructive: floods /auth/login

    # Summary
    print()
    passed = sum(1 for _, ok, *_ in results if ok)
    failed = len(results) - passed
    print("━" * 60)
    print(f"  {passed} passed   {failed} failed   {len(results)} total")
    print("━" * 60)
    if failed:
        print("\nFailures:")
        for tid, ok, name, detail in results:
            if not ok:
                print(f"  ❌ [{tid}] {name}\n     {detail}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
