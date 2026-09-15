# FocusQuiz quiz server

Python-stdlib HTTP server that feeds quiz questions to the FocusQuiz Android app
from the Adobe cert question bank, and logs answers back into the study tracker.

## Run

```sh
./start.sh            # background on 127.0.0.1:8077, logs to server.log
# or foreground:
python3 server.py
```

Env overrides: `PORT`, `BANK_PATH`, `GOAL_PATH`, `TZ` (default America/New_York).

## Endpoints

- `GET /api/health` → `{"ok": true}`
- `GET /api/quiz/next` → oldest `unused` bank set, preferring Phase AJO/CJA
  (falls back to oldest unused overall). The set is atomically marked
  `used YYYY-MM-DD` in the bank file so the twice-daily quiz crons never repeat it.
- `POST /api/answer` `{"bank_id","chosen_letter","correct","at"}` →
  appends a bullet under `## Blocker quiz log` in GOAL.md.

## Public access (for the phone)

The server only listens on 127.0.0.1. Expose it with a Cloudflare quick tunnel:

```sh
/usr/local/bin/cloudflared tunnel --url http://localhost:8077
```

Copy the `https://…trycloudflare.com` URL it prints into the app's
**Settings → Quiz server URL** (or bake it into `app.json` → `extra.serverUrl`
before building). Quick-tunnel URLs change on every restart — if the app can't
reach the server, grab a fresh URL and update the setting.

## Notes

- The question bank itself is NOT in this repo; the server reads it from the VM
  path in `BANK_PATH` at runtime.
- `GET /api/quiz/next` consumes a bank set on every call (including the spare
  the app pre-fetches while online). The twice-daily quiz crons share the same
  bank file; both mark sets used, so a question is never asked twice — the only
  race is if a cron fires in the same millisecond as an app fetch, which is
  harmless (worst case one duplicate question).
- Answer secrecy: the server returns `answer_key`/`why_correct` with the
  question (the app needs them to grade), but the app UI never reveals them
  before she taps an answer.
