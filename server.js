const express = require('express');
const bodyParser = require('body-parser');
const Database = require('./database');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const db = new Database();
const PORT = process.env.PORT || 8080;

app.use(bodyParser.json());

// CORS - allow all since it's local/Tailscale only
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// ======== API ENDPOINTS ========

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'quran-tracker',
        version: '1.0.0'
    });
});

// Get full progress
app.get('/api/progress', async (req, res) => {
    try {
        const progress = await db.getProgress();
        res.json(progress);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get today's reading status
app.get('/api/today', async (req, res) => {
    try {
        const today = await db.getTodayReading();
        const goal = await db.getCurrentGoal();
        res.json({
            read: !!today,
            pages_read: today ? today.pages_read : 0,
            daily_goal: goal ? goal.daily_goal : 5,
            remaining: goal ? goal.daily_goal - (today ? today.pages_read : 0) : 5,
            date: new Date().toISOString().split('T')[0]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Log pages read
app.post('/api/log', async (req, res) => {
    try {
        const { pages, notes } = req.body;
        
        if (!pages || pages < 1) {
            return res.status(400).json({ error: 'Pages must be >= 1' });
        }
        
        const result = await db.logReading(parseInt(pages), notes || '');
        const progress = await db.getProgress();
        
        // Send notification if completed daily goal
        const goal = await db.getCurrentGoal();
        if (progress.today_done >= goal.daily_goal) {
            sendNotification(
                '🎉 Daily Goal Reached!',
                `You've read ${progress.today_done} pages today. Great job!`
            );
        }
        
        res.json({
            success: true,
            logged: result,
            progress: progress
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get streak info
app.get('/api/streak', async (req, res) => {
    try {
        const streak = await db.getStreak();
        res.json({ streak_days: streak });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get remaining calculation
app.get('/api/remaining', async (req, res) => {
    try {
        const needed = await db.getNeededPerDay();
        const progress = await db.getProgress();
        res.json({
            ...needed,
            current_page: progress.current_page,
            total_pages: progress.total_pages
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all readings for Ramadan
app.get('/api/readings', async (req, res) => {
    try {
        const readings = await db.getRamadanReadings();
        res.json(readings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get reading for specific date
app.get('/api/reading/:date', async (req, res) => {
    try {
        const reading = await db.getReadingByDate(req.params.date);
        if (!reading) {
            return res.status(404).json({ error: 'No reading found for this date' });
        }
        res.json(reading);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get dashboard summary
app.get('/api/dashboard', async (req, res) => {
    try {
        const progress = await db.getProgress();
        const readings = await db.getRamadanReadings();
        
        // Calculate last 7 days
        const last7Days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const reading = readings.find(r => r.date === dateStr);
            last7Days.push({
                date: dateStr,
                pages: reading ? reading.pages_read : 0,
                completed: reading ? reading.completed : false
            });
        }
        
        res.json({
            progress,
            recent_readings: last7Days,
            total_entries: readings.length
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update current page directly
app.post('/api/set-page', async (req, res) => {
    try {
        const { page } = req.body;
        if (!page || page < 1 || page > 604) {
            return res.status(400).json({ error: 'Page must be between 1 and 604' });
        }
        
        await db.setState('current_page', page.toString());
        const progress = await db.getProgress();
        
        res.json({
            success: true,
            current_page: page,
            progress
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export all data
app.get('/api/export', async (req, res) => {
    try {
        const readings = await db.getAllReadings();
        const progress = await db.getProgress();
        
        res.json({
            exported_at: new Date().toISOString(),
            progress,
            readings
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Send test notification
app.post('/api/notify', (req, res) => {
    const { title, content } = req.body;
    sendNotification(title || 'Quran Tracker', content || 'Test notification');
    res.json({ sent: true });
});

// Trigger daily reminder (check if not read today)
app.post('/api/reminder', async (req, res) => {
    try {
        const today = await db.getTodayReading();
        if (!today) {
            const goal = await db.getCurrentGoal();
            sendNotification(
                '📖 Quran Reading Reminder',
                `You haven't read today! ${goal.daily_goal} pages remaining.`
            );
            res.json({ reminder_sent: true, reason: 'no_reading_today' });
        } else {
            res.json({ reminder_sent: false, reason: 'already_read' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======== HELPERS ========

function sendNotification(title, content) {
    // Try to send Android notification via termux-api
    const cmd = `termux-notification --title "${title}" --content "${content}" --priority high`;
    exec(cmd, (err) => {
        if (err) {
            console.log('Notification failed (termux-api not available):', err.message);
        } else {
            console.log('Notification sent:', title);
        }
    });
}

// ======== START SERVER ========

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║           Quran Tracker Server                    ║
║                                                   ║
║   Port: ${PORT}                                    ║
║   URL:  http://0.0.0.0:${PORT}/api/progress        ║
║                                                   ║
║   Endpoints:                                      ║
║   - GET  /api/progress   (full status)            ║
║   - GET  /api/today      (today's reading)        ║
║   - POST /api/log        (log pages)              ║
║   - GET  /api/dashboard  (dashboard data)         ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    db.close();
    process.exit(0);
});
