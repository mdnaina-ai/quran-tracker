# 📖 Quran Tracker for Termux

Local Quran reading tracker with Android widgets and notifications. Designed for Ramadan completion tracking (604 pages).

## Features

- ✅ **Local SQLite database** - No internet needed
- ✅ **REST API** - For AI/Alfred to track your progress
- ✅ **Android widgets** - Home screen progress display
- ✅ **Push notifications** - Daily reminders
- ✅ **Tailscale ready** - Alfred can access directly
- ✅ **Offline capable** - Works without internet

## Quick Start

### 1. Install in Termux

```bash
# Copy all files to phone, then:
cd quran-tracker
bash install.sh
```

### 2. Start the server

```bash
cd ~/quran-tracker
node server.js
```

Server runs on `http://0.0.0.0:8080`

### 3. Add Widget (Optional)

1. Install **Termux:Widget** from F-Droid
2. Long press home screen → Widgets
3. Add "quran-status.sh" for progress display
4. Add "quran-log.sh" for quick logging

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/progress` | GET | Full progress stats |
| `/api/today` | GET | Today's reading status |
| `/api/log` | POST | Log pages read `{pages: 5}` |
| `/api/dashboard` | GET | Dashboard with recent history |
| `/api/streak` | GET | Current streak days |
| `/api/remaining` | GET | Pages left, days left, needed/day |
| `/api/reminder` | POST | Send notification if not read |

### Example: Log 5 pages

```bash
curl -X POST http://localhost:8080/api/log \
  -H "Content-Type: application/json" \
  -d '{"pages": 5}'
```

### Example: Get progress

```bash
curl http://localhost:8080/api/progress
```

**Response:**
```json
{
  "current_page": 23,
  "total_pages": 604,
  "completed": 22,
  "remaining": 582,
  "percent": "3.6",
  "streak_days": 5,
  "daily_goal": 5,
  "today_done": 5,
  "today_goal_remaining": 0,
  "needed_per_day": 23,
  "days_left": 25
}
```

## Daily Workflow

1. **Read on Quran.com** (or your preferred app)
2. **Tell Alfred:** "I read 5 pages"
3. **Alfred logs it:** POST to your local API
4. **Check widget:** See progress on home screen
5. **Evening reminder:** If not logged, notification at 8 PM

## Tailscale Access

Alfred can access your tracker via Tailscale:

```
http://<your-phone-tailscale-ip>:8080/api/progress
```

Or use `tailscale serve` for HTTPS:

```bash
tailscale serve --bg --https=9494 localhost:8080
```

Then: `https://your-phone.tailff5369.ts.net`

## Database

SQLite database at `~/quran-tracker/quran.db`

**Tables:**
- `readings` - Daily reading logs
- `goals` - Ramadan dates and goals
- `state` - Current page, settings

## Auto-start on Boot

Already configured in `~/.termux/boot/start-quran-tracker.sh`

Enable Termux boot in Android settings for auto-start.

## Customization

### Change daily goal
Edit `init-db.sql` and re-run, or use SQLite directly:

```bash
sqlite3 quran.db "UPDATE goals SET daily_goal = 10 WHERE year = 2026;"
```

### Update Ramadan dates

```bash
sqlite3 quran.db "UPDATE goals SET start_date='2026-02-17', end_date='2026-03-18' WHERE year=2026;"
```

### Reset progress (⚠️ DANGER)

```bash
sqlite3 quran.db "DELETE FROM readings; UPDATE state SET value='1' WHERE key='current_page';"
```

## Troubleshooting

### Server won't start
```bash
# Check if port 8080 is in use
lsof -i :8080

# Kill existing process
kill $(lsof -t -i:8080)
```

### Notifications not working
- Install `termux-api` app from F-Droid
- Grant notification permission in Android settings

### Widget not showing
- Install `termux-widget` from F-Droid
- Create `~/.shortcuts/` folder first
- Run `termux-widget` once to initialize

## Files

```
~/quran-tracker/
├── server.js          # Main API server
├── database.js        # Database wrapper
├── package.json       # Node dependencies
├── init-db.sql        # Database schema
└── quran.db           # SQLite database (created after init)

~/.termux/boot/
└── start-quran-tracker.sh    # Auto-start script

~/.shortcuts/
├── quran-status.sh    # Widget: Show progress
└── quran-log.sh       # Widget: Quick log
```

## Reading Sources

Use these apps/sites for actual Quran reading:
- **Quran.com** (PWA) - Best overall, multiple reciters
- **Tarteel.ai** - AI-powered
- **Mushaf.io** - Clean interface

This tracker just handles progress/logging.
