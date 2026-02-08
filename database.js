const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'quran.db');

class Database {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH);
    }

    // Get current state
    getState(key) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT value FROM state WHERE key = ?',
                [key],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.value : null);
                }
            );
        });
    }

    // Update state
    setState(key, value) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO state (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
                [key, value],
                function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                }
            );
        });
    }

    // Get current Ramadan goal
    async getCurrentGoal() {
        const year = await this.getState('ramadan_year') || new Date().getFullYear();
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM goals WHERE year = ?',
                [year],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    // Log reading for today
    async logReading(pages, notes = '') {
        const today = new Date().toISOString().split('T')[0];
        const currentPage = parseInt(await this.getState('current_page') || '1');
        const startPage = currentPage;
        const endPage = currentPage + pages - 1;
        
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO readings 
                (date, start_page, end_page, pages_read, completed, notes, updated_at)
                VALUES (?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)`,
                [today, startPage, endPage, pages],
                async function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    // Update current page
                    await this.setState('current_page', endPage.toString());
                    await this.setState('last_read_date', today);
                    
                    resolve({
                        id: this.lastID,
                        start_page: startPage,
                        end_page: endPage,
                        pages_read: pages
                    });
                }.bind(this)
            );
        }.bind(this));
    }

    // Get today's reading
    getTodayReading() {
        const today = new Date().toISOString().split('T')[0];
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM readings WHERE date = ?',
                [today],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    // Get reading by date
    getReadingByDate(date) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM readings WHERE date = ?',
                [date],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    // Get all readings for current Ramadan
    async getRamadanReadings() {
        const goal = await this.getCurrentGoal();
        if (!goal) return [];
        
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM readings 
                WHERE date BETWEEN ? AND ? 
                ORDER BY date DESC`,
                [goal.start_date, goal.end_date],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    // Get total pages read
    async getTotalPagesRead() {
        const goal = await this.getCurrentGoal();
        if (!goal) return 0;
        
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT COALESCE(SUM(pages_read), 0) as total 
                FROM readings 
                WHERE date BETWEEN ? AND ?`,
                [goal.start_date, goal.end_date],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row.total);
                }
            );
        });
    }

    // Get streak (consecutive days with readings)
    async getStreak() {
        const goal = await this.getCurrentGoal();
        if (!goal) return 0;
        
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT date FROM readings 
                WHERE date BETWEEN ? AND ? AND completed = 1
                ORDER BY date DESC`,
                [goal.start_date, goal.end_date],
                (err, rows) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    if (rows.length === 0) {
                        resolve(0);
                        return;
                    }
                    
                    // Calculate streak
                    let streak = 0;
                    let checkDate = new Date();
                    checkDate.setHours(0, 0, 0, 0);
                    
                    // If no reading today, start from yesterday
                    const today = new Date().toISOString().split('T')[0];
                    if (rows[0].date !== today) {
                        checkDate.setDate(checkDate.getDate() - 1);
                    }
                    
                    for (const row of rows) {
                        const rowDate = new Date(row.date);
                        rowDate.setHours(0, 0, 0, 0);
                        
                        if (rowDate.getTime() === checkDate.getTime()) {
                            streak++;
                            checkDate.setDate(checkDate.getDate() - 1);
                        } else {
                            break;
                        }
                    }
                    
                    resolve(streak);
                }
            );
        });
    }

    // Calculate needed pages per day to finish
    async getNeededPerDay() {
        const goal = await this.getCurrentGoal();
        if (!goal) return null;
        
        const totalRead = await this.getTotalPagesRead();
        const remaining = goal.target_pages - totalRead;
        
        // Calculate days left in Ramadan
        const today = new Date();
        const endDate = new Date(goal.end_date);
        const diffTime = endDate - today;
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (daysLeft <= 0) {
            return { remaining, days_left: 0, needed_per_day: remaining };
        }
        
        const neededPerDay = Math.ceil(remaining / daysLeft);
        
        return {
            remaining,
            days_left: daysLeft,
            needed_per_day: neededPerDay
        };
    }

    // Get full progress summary
    async getProgress() {
        const goal = await this.getCurrentGoal();
        const currentPage = parseInt(await this.getState('current_page') || '1');
        const totalRead = await this.getTotalPagesRead();
        const streak = await this.getStreak();
        const todayReading = await this.getTodayReading();
        const needed = await this.getNeededPerDay();
        
        return {
            current_page: currentPage,
            total_pages: goal ? goal.target_pages : 604,
            completed: totalRead,
            remaining: goal ? goal.target_pages - totalRead : 604 - totalRead,
            percent: goal ? ((totalRead / goal.target_pages) * 100).toFixed(1) : 0,
            streak_days: streak,
            daily_goal: goal ? goal.daily_goal : 5,
            today_done: todayReading ? todayReading.pages_read : 0,
            today_goal_remaining: goal ? goal.daily_goal - (todayReading ? todayReading.pages_read : 0) : 5,
            needed_per_day: needed ? needed.needed_per_day : 0,
            days_left: needed ? needed.days_left : 0,
            ramadan_start: goal ? goal.start_date : null,
            ramadan_end: goal ? goal.end_date : null
        };
    }

    // Get all readings (for export)
    getAllReadings() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM readings ORDER BY date DESC',
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    // Close database connection
    close() {
        this.db.close();
    }
}

module.exports = Database;
