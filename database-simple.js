// Simple JSON-based database for Termux (no native modules needed)
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'quran-data.json');

class SimpleDatabase {
    constructor() {
        this.data = this.load();
        this.init();
    }

    load() {
        try {
            if (fs.existsSync(DB_FILE)) {
                return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            }
        } catch (e) {
            console.error('Failed to load DB:', e.message);
        }
        return null;
    }

    init() {
        if (!this.data) {
            this.data = {
                current_page: 1,
                ramadan_year: 2026,
                last_read_date: null,
                readings: [],
                goal: {
                    year: 2026,
                    start_date: '2026-02-17',
                    end_date: '2026-03-18',
                    daily_goal: 5,
                    target_pages: 604
                }
            };
            this.save();
        }
    }

    save() {
        fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2));
    }

    getState(key) {
        return this.data[key];
    }

    setState(key, value) {
        this.data[key] = value;
        this.save();
    }

    getCurrentGoal() {
        return this.data.goal;
    }

    async logReading(pages, notes = '') {
        const today = new Date().toISOString().split('T')[0];
        const currentPage = parseInt(this.data.current_page || 1);
        const startPage = currentPage;
        const endPage = currentPage + pages - 1;

        // Check if already logged today
        const existingIndex = this.data.readings.findIndex(r => r.date === today);
        
        const reading = {
            date: today,
            start_page: startPage,
            end_page: endPage,
            pages_read: pages,
            completed: true,
            notes: notes,
            updated_at: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            // Update existing
            const existing = this.data.readings[existingIndex];
            reading.pages_read += existing.pages_read;
            reading.start_page = existing.start_page;
            reading.end_page = existing.end_page + pages;
            this.data.readings[existingIndex] = reading;
        } else {
            this.data.readings.push(reading);
        }

        this.data.current_page = reading.end_page;
        this.data.last_read_date = today;
        this.save();

        return reading;
    }

    getTodayReading() {
        const today = new Date().toISOString().split('T')[0];
        return this.data.readings.find(r => r.date === today);
    }

    getReadingByDate(date) {
        return this.data.readings.find(r => r.date === date);
    }

    getRamadanReadings() {
        const goal = this.data.goal;
        return this.data.readings.filter(r => 
            r.date >= goal.start_date && r.date <= goal.end_date
        ).sort((a, b) => b.date.localeCompare(a.date));
    }

    getTotalPagesRead() {
        return this.data.readings.reduce((sum, r) => sum + r.pages_read, 0);
    }

    getStreak() {
        if (this.data.readings.length === 0) return 0;
        
        const sorted = [...this.data.readings].sort((a, b) => b.date.localeCompare(a.date));
        let streak = 0;
        let checkDate = new Date();
        checkDate.setHours(0, 0, 0, 0);
        
        const today = new Date().toISOString().split('T')[0];
        if (sorted[0].date !== today) {
            checkDate.setDate(checkDate.getDate() - 1);
        }
        
        for (const reading of sorted) {
            const rowDate = new Date(reading.date);
            rowDate.setHours(0, 0, 0, 0);
            
            if (rowDate.getTime() === checkDate.getTime()) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
        
        return streak;
    }

    getNeededPerDay() {
        const goal = this.data.goal;
        const totalRead = this.getTotalPagesRead();
        const remaining = goal.target_pages - totalRead;
        
        const today = new Date();
        const endDate = new Date(goal.end_date);
        const diffTime = endDate - today;
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (daysLeft <= 0) {
            return { remaining, days_left: 0, needed_per_day: remaining };
        }
        
        return {
            remaining,
            days_left: daysLeft,
            needed_per_day: Math.ceil(remaining / daysLeft)
        };
    }

    async getProgress() {
        const goal = this.data.goal;
        const currentPage = parseInt(this.data.current_page || 1);
        const totalRead = this.getTotalPagesRead();
        const streak = this.getStreak();
        const todayReading = this.getTodayReading();
        const needed = this.getNeededPerDay();
        
        return {
            current_page: currentPage,
            total_pages: goal.target_pages,
            completed: totalRead,
            remaining: goal.target_pages - totalRead,
            percent: ((totalRead / goal.target_pages) * 100).toFixed(1),
            streak_days: streak,
            daily_goal: goal.daily_goal,
            today_done: todayReading ? todayReading.pages_read : 0,
            today_goal_remaining: goal.daily_goal - (todayReading ? todayReading.pages_read : 0),
            needed_per_day: needed.needed_per_day,
            days_left: needed.days_left,
            ramadan_start: goal.start_date,
            ramadan_end: goal.end_date
        };
    }

    getAllReadings() {
        return this.data.readings.sort((a, b) => b.date.localeCompare(a.date));
    }
}

module.exports = SimpleDatabase;
