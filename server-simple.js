const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const Database = require('./database-simple');
const { exec } = require('child_process');

const app = express();
const db = new Database();
const PORT = process.env.PORT || 8080;

app.use(bodyParser.json());

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Serve static files from public directory
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
    app.use('/ui', express.static(publicDir));
}

// Root redirect to UI
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.json({
            status: 'ok',
            service: 'quran-tracker',
            version: '1.0.0',
            mode: 'json-db',
            ui: '/ui'
        });
    }
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
        const today = db.getTodayReading();
        const goal = db.getCurrentGoal();
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
        const goal = db.getCurrentGoal();
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
        const streak = db.getStreak();
        res.json({ streak_days: streak });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get remaining calculation
app.get('/api/remaining', async (req, res) => {
    try {
        const needed = db.getNeededPerDay();
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
        const readings = db.getRamadanReadings();
        res.json(readings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get reading for specific date
app.get('/api/reading/:date', async (req, res) => {
    try {
        const reading = db.getReadingByDate(req.params.date);
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
        const readings = db.getRamadanReadings();
        
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
        
        db.setState('current_page', page);
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
        const readings = db.getAllReadings();
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

// Trigger daily reminder
app.post('/api/reminder', async (req, res) => {
    try {
        const today = db.getTodayReading();
        if (!today) {
            const goal = db.getCurrentGoal();
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

// Undo last reading (today's entry)
app.post('/api/undo', async (req, res) => {
    try {
        const result = db.undoLastReading();
        
        if (result.success) {
            const progress = await db.getProgress();
            res.json({
                success: true,
                message: `Undid ${result.pages_removed} pages`,
                current_page: result.current_page,
                progress
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Decrease pages for today
app.post('/api/decrease', async (req, res) => {
    try {
        const { pages } = req.body;
        
        if (!pages || pages < 1) {
            return res.status(400).json({ error: 'Pages must be >= 1' });
        }
        
        const result = db.decreasePages(parseInt(pages));
        
        if (result.success) {
            const progress = await db.getProgress();
            res.json({
                success: true,
                message: `Decreased by ${result.pages_decreased || result.pages_removed} pages`,
                current_page: result.current_page,
                remaining_today: result.remaining_today,
                progress
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper: Send notification
function sendNotification(title, content) {
    const cmd = `termux-notification --title "${title}" --content "${content}" --priority high`;
    exec(cmd, (err) => {
        if (err) {
            console.log('Notification failed:', err.message);
        } else {
            console.log('Notification sent:', title);
        }
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║           Quran Tracker Server                    ║
║                                                   ║
║   Port: ${PORT}                                    ║
║   URL:  http://0.0.0.0:${PORT}/api/progress        ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
    `);
});

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    process.exit(0);
});
