#!/usr/bin/env python3
"""
FocusQuiz quiz server (Python stdlib only).

Serves quiz questions from the Adobe cert question bank and logs answers back
into the study tracker (GOAL.md).

Endpoints:
  GET  /api/health    -> {"ok": true}
  GET  /api/quiz/next -> oldest unused bank set, preferring Phase AJO/CJA.
                         Marks the set `used YYYY-MM-DD` atomically so the
                         twice-daily quiz crons never repeat it.
  POST /api/answer    -> {"bank_id","chosen_letter","correct","at"}
                         Appends a bullet to GOAL.md under "## Blocker quiz log".

Env:
  BANK_PATH  question bank markdown (default: the goal's hidden_files/question-bank.md)
  GOAL_PATH  study tracker markdown (default: the goal's GOAL.md)
  PORT       listen port (default 8077)
  TZ         timezone for timestamps (default America/New_York)
"""

import json
import os
import re
import sys
import tempfile
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from zoneinfo import ZoneInfo

BANK_PATH = os.environ.get(
    "BANK_PATH",
    os.path.expanduser(
        "~/workspace/goals/adobe-expert-certification-aep-ajo-cja/hidden_files/question-bank.md"
    ),
)
GOAL_PATH = os.environ.get(
    "GOAL_PATH",
    os.path.expanduser("~/workspace/goals/adobe-expert-certification-aep-ajo-cja/GOAL.md"),
)
PORT = int(os.environ.get("PORT", "8077"))
TZ = ZoneInfo(os.environ.get("TZ", "America/New_York"))

LOCK = threading.Lock()

SET_RE = re.compile(r"^##\s+(BANK-\d+)\s+—\s+status:\s*(.+?)\s*$", re.M)
FIELD_RES = {
    "phase": re.compile(r"^\*\*Phase:\*\*\s*(.+?)\s*$", re.M),
    "subtopic": re.compile(r"^\*\*Subtopic:\*\*\s*(.+?)\s*$", re.M),
    "question": re.compile(r"^\*\*Question:\*\*\s*(.+?)\s*$", re.M),
    "answer_key": re.compile(r"^\*\*Answer key:\*\*\s*([A-D])\s*$", re.M),
    "why_correct": re.compile(r"^\*\*Why correct:\*\*\s*(.+?)\s*$", re.M),
    "why_wrong": re.compile(r"^\*\*Why others are wrong:\*\*\s*(.+?)\s*$", re.M),
}
OPTION_RE = re.compile(r"^-\s*([A-D])\.\s*(.+?)\s*$", re.M)
URL_RE = re.compile(r"https?://[^\s)]+")
WHY_LETTER_RE = re.compile(r"(?<![A-Za-z])([A-D])\s+—\s*")
PREFERRED_PHASES = ("AJO", "CJA")


def warn(msg: str) -> None:
    print(f"[quiz-server] WARNING: {msg}", file=sys.stderr, flush=True)


def split_why_wrong(text: str) -> dict:
    """Split 'A — ... B — ...' into {letter: explanation}."""
    matches = list(WHY_LETTER_RE.finditer(text))
    if len(matches) < 2:
        return {"note": text.strip()}
    out = {}
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        out[m.group(1)] = text[start:end].strip().rstrip(";")
    return out


def extract_sources(block: str) -> list:
    m = re.search(r"^\*\*Sources?:\*\*(.*)$", block, re.M)
    if not m:
        return []
    urls = URL_RE.findall(m.group(1))
    # Also consume following "- ..." bullet lines (multi-line Sources: lists).
    for line in block[m.end():].splitlines():
        if line.startswith("-"):
            urls.extend(URL_RE.findall(line))
        elif line.strip() == "":
            continue
        else:
            break
    return urls


def parse_block(bank_id: str, status: str, block: str, loud: bool = True) -> dict | None:
    fields = {}
    for key, rx in FIELD_RES.items():
        m = rx.search(block)
        fields[key] = m.group(1).strip() if m else ""
    options = [
        {"letter": m.group(1), "text": m.group(2).strip()}
        for m in OPTION_RE.finditer(block)
    ]
    missing = [k for k in ("phase", "question", "answer_key", "why_correct") if not fields[k]]
    if missing or len(options) < 2:
        if loud:
            warn(f"{bank_id}: skipping (missing: {missing}, options: {len(options)})")
        return None
    return {
        "bank_id": bank_id,
        "status": status,
        "phase": fields["phase"],
        "subtopic": fields["subtopic"],
        "question": fields["question"],
        "options": options,
        "answer_key": fields["answer_key"],
        "why_correct": fields["why_correct"],
        "why_wrong": split_why_wrong(fields["why_wrong"]) if fields["why_wrong"] else {},
        "sources": extract_sources(block),
    }


def parse_bank(text: str) -> list:
    """Parse all sets; returns list of dicts in file order."""
    headers = list(SET_RE.finditer(text))
    sets = []
    for i, h in enumerate(headers):
        bank_id, status = h.group(1), h.group(2).strip()
        end = headers[i + 1].start() if i + 1 < len(headers) else len(text)
        block = text[h.end():end]
        # Only warn about sets that could actually be served (unused ones);
        # legacy used sets predate the Phase: tags and are never candidates.
        parsed = parse_block(bank_id, status, block, loud=(status == "unused"))
        if parsed:
            parsed["_header_start"] = h.start()
            parsed["_header_end"] = h.end()
            parsed["_header_text"] = h.group(0)
            sets.append(parsed)
    return sets


def claim_oldest() -> dict | None:
    """
    Atomically pick the oldest unused set (preferring AJO/CJA phases),
    mark it used in the bank file, and return it.
    """
    with LOCK:
        with open(BANK_PATH, encoding="utf-8") as f:
            text = f.read()
        sets = parse_bank(text)
        unused = [s for s in sets if s["status"] == "unused"]
        if not unused:
            return None
        preferred = [s for s in unused if s["phase"] in PREFERRED_PHASES]
        pool = preferred or unused
        chosen = sorted(pool, key=lambda s: s["bank_id"])[0]

        today = datetime.now(TZ).strftime("%Y-%m-%d")
        new_header = re.sub(
            r"status:\s*unused",
            f"status: used {today}",
            chosen["_header_text"],
        )
        new_text = text[: chosen["_header_start"]] + new_header + text[chosen["_header_end"]:]
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(BANK_PATH) or ".", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(new_text)
            os.replace(tmp, BANK_PATH)
        except BaseException:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise
        return {k: v for k, v in chosen.items() if not k.startswith("_")}


def find_set(bank_id: str) -> dict | None:
    with open(BANK_PATH, encoding="utf-8") as f:
        text = f.read()
    for s in parse_bank(text):
        if s["bank_id"] == bank_id:
            return s
    return None


def log_answer(bank_id: str, chosen: str, correct: bool) -> None:
    now = datetime.now(TZ).strftime("%Y-%m-%d %H:%M")
    s = find_set(bank_id) or {}
    phase = s.get("phase", "?")
    subtopic = (s.get("subtopic") or "").strip()
    if len(subtopic) > 90:
        subtopic = subtopic[:87] + "…"
    head = f"- Blocker quiz ({now} ET): {bank_id} ({phase}, {subtopic})"
    if correct:
        bullet = f"{head} — answered {chosen}, correct.\n"
    else:
        why = (s.get("why_correct") or "").strip().replace("\n", " ")
        if len(why) > 150:
            why = why[:147] + "…"
        bullet = (
            f"{head} — answered {chosen}, wrong; "
            f"correct {s.get('answer_key', '?')} ({why}).\n"
        )
    with LOCK:
        with open(GOAL_PATH, encoding="utf-8") as f:
            content = f.read()
        if "## Blocker quiz log" not in content:
            if not content.endswith("\n"):
                content += "\n"
            content += "\n## Blocker quiz log\n"
        content += bullet
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(GOAL_PATH) or ".", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(content)
            os.replace(tmp, GOAL_PATH)
        except BaseException:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise


class Handler(BaseHTTPRequestHandler):
    server_version = "FocusQuizServer/1.0"

    def _json(self, code: int, obj: dict) -> None:
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/health":
            self._json(200, {"ok": True})
        elif path == "/api/quiz/next":
            try:
                q = claim_oldest()
            except FileNotFoundError:
                self._json(500, {"error": "question bank not found"})
                return
            except Exception as e:  # noqa: BLE001
                warn(f"claim failed: {e}")
                self._json(500, {"error": "claim failed"})
                return
            if q is None:
                self._json(404, {"error": "bank exhausted — no unused sets"})
            else:
                self._json(200, q)
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path != "/api/answer":
            self._json(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length) or b"{}")
        except Exception:  # noqa: BLE001
            self._json(400, {"error": "invalid JSON"})
            return
        bank_id = str(payload.get("bank_id", ""))
        chosen = str(payload.get("chosen_letter", "")).upper()
        correct = bool(payload.get("correct", False))
        if not re.fullmatch(r"BANK-\d+", bank_id) or chosen not in ("A", "B", "C", "D"):
            self._json(400, {"error": "bad payload"})
            return
        try:
            log_answer(bank_id, chosen, correct)
        except Exception as e:  # noqa: BLE001
            warn(f"log_answer failed: {e}")
            self._json(500, {"error": "log failed"})
            return
        self._json(200, {"ok": True})

    def log_message(self, fmt, *args):
        sys.stderr.write(f"[quiz-server] {fmt % args}\n")
        sys.stderr.flush()


def main() -> None:
    if not os.path.exists(BANK_PATH):
        print(f"[quiz-server] ERROR: bank not found at {BANK_PATH}", file=sys.stderr)
        sys.exit(1)
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"[quiz-server] listening on 127.0.0.1:{PORT} (bank: {BANK_PATH})", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
