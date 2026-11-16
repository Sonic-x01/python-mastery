#!/usr/bin/env python3
"""
Python Mastery — local course server.

Serves the course files and exposes a tiny local code runner so the
"Run" buttons work offline with the Python installed on this machine.

Usage:
    python server.py            # starts on 127.0.0.1:8765 and opens the browser
    python server.py --no-browser
    python server.py --port 9000

Security note: /api/run executes the code you send it, locally. It binds to
127.0.0.1 only and is meant for personal learning, never expose it publicly.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import threading
import uuid
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAX_CODE_BYTES = 200_000
MAX_OUTPUT = 120_000
TIMEOUT_SECONDS = 8.0


def run_code(code: str) -> tuple[str, str]:
    """Run a Python snippet in an isolated temp folder and capture output."""
    # Keep temp files inside the project folder: some sandboxes deny %TEMP%.
    # NOTE: do not use TemporaryDirectory/mkdtemp here — their 0o700 mode can
    # replace the inherited Windows ACL and block the sandbox from writing.
    runner_root = ROOT / ".runner"
    runner_root.mkdir(exist_ok=True)

    job_dir = runner_root / ("job-" + uuid.uuid4().hex[:10])
    job_dir.mkdir()
    try:
        script = job_dir / "main.py"
        script.write_text(code, encoding="utf-8")

        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUTF8"] = "1"
        env["PYTHONDONTWRITEBYTECODE"] = "1"

        try:
            proc = subprocess.run(
                [sys.executable, "-X", "utf8", "-u", str(script)],
                cwd=str(job_dir),
                env=env,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired:
            return (
                "",
                f"⏱ الكود استغرق أكثر من {TIMEOUT_SECONDS:.0f} ثوانٍ وتم إيقافه.\n"
                "تأكد من عدم وجود حلقة لا نهائية (infinite loop).",
            )
        except Exception as exc:  # pragma: no cover - defensive
            return "", f"تعذّر تشغيل بايثون: {exc}"

        out = proc.stdout.decode("utf-8", errors="replace")
        err = proc.stderr.decode("utf-8", errors="replace")

        if len(out) > MAX_OUTPUT:
            out = out[:MAX_OUTPUT] + "\n… (تم قص المخرجات الطويلة)"
        if len(err) > MAX_OUTPUT:
            err = err[:MAX_OUTPUT] + "\n… (تم قص رسالة الخطأ)"

        # Hide the temporary path so the error message stays readable.
        err = err.replace(str(script), "<main.py>")
        return out, err
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)


class CourseHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    # ---- helpers -------------------------------------------------
    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def _json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    # ---- routes --------------------------------------------------
    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if self.path.split("?", 1)[0] == "/api/health":
            self._json({"ok": True, "engine": "local", "python": sys.version.split()[0]})
            return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        if self.path.split("?", 1)[0] != "/api/run":
            self.send_error(404, "Not found")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_CODE_BYTES * 2:
                raise ValueError("bad length")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            code = payload.get("code", "")
            if not isinstance(code, str) or len(code.encode("utf-8")) > MAX_CODE_BYTES:
                raise ValueError("bad code")
        except Exception:
            self._json({"out": "", "err": "طلب غير صالح."}, status=400)
            return

        try:
            out, err = run_code(code)
        except Exception as exc:  # never break the HTTP connection on a runner error
            out, err = "", f"تعذّر تشغيل الكود: {exc}"
        self._json({"out": out, "err": err})
    def log_message(self, fmt: str, *args) -> None:
        if self.path.startswith("/api/"):
            return
        super().log_message(fmt, *args)


def main() -> None:
    # Windows consoles may default to a legacy code page; keep Arabic output safe.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    port = 8765
    args = sys.argv[1:]
    if "--port" in args:
        try:
            port = int(args[args.index("--port") + 1])
        except (IndexError, ValueError):
            print("قيمة --port غير صالحة، سيتم استخدام 8765.")
            port = 8765

    server = None
    for candidate in range(port, port + 12):
        try:
            server = ThreadingHTTPServer(("127.0.0.1", candidate), CourseHandler)
            break
        except OSError:
            continue

    if server is None:
        print("تعذّر إيجاد منفذ متاح. اقفل أي خادم يعمل ثم حاول مرة أخرى.")
        return

    url = f"http://127.0.0.1:{server.server_port}/"
    line = "=" * 54
    print(line)
    print("  🐍  Python Mastery — الدليل التفاعلي")
    print(line)
    print(f"  الصفحة: {url}")
    print(f"  بايثون: {sys.version.split()[0]}")
    print("  أوقف الخادم بـ Ctrl+C")
    print(line)

    if "--no-browser" not in args:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nتم إيقاف الخادم. إلى اللقاء!")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
