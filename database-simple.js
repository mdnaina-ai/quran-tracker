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
                actions: [], // Individual action history for step-by-step undo
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
        // Ensure actions array exists for existing databases
        if (!this.data.actions) {
            this.data.actions = [];
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
        const startPage = parseInt(this.data.current_page || 1);
        const endPage = startPage + pages; // Next page to read after this batch

        // Create action record for undo
        const action = {
            id: Date.now(),
            type: 'add',
            date: today,
            pages: pages,
            from_page: startPage,
            to_page: endPage,
            timestamp: new Date().toISOString()
        };
        this.data.actions.push(action);

        // Check if already logged today
        const existingIndex = this.data.readings.findIndex(r => r.date === today);
        
        const reading = {
            date: today,
            start_page: this.data.readings[existingIndex]?.start_page || startPage,
            end_page: endPage - 1, // Last page actually read
            pages_read: (this.data.readings[existingIndex]?.pages_read || 0) + pages,
            completed: true,
            notes: notes,
            updated_at: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            this.data.readings[existingIndex] = reading;
        } else {
            this.data.readings.push(reading);
        }

        this.data.current_page = endPage;
        this.data.last_read_date = today;
        this.save();

        return { ...reading, action_id: action.id };
    }

    // Undo the last action only (step by step)
    undoLastAction() {
        if (this.data.actions.length === 0) {
            return { success: false, error: 'No actions to undo' };
        }

        // Get last action
        const lastActionIndex = this.data.actions.length - 1;
        const lastAction = this.data.actions[lastActionIndex];

        if (lastAction.type === 'add') {
            // Reverse an add action - restore to the page before this action
            const today = lastAction.date;
            const todayIndex = this.data.readings.findIndex(r => r.date === today);
            
            if (todayIndex >= 0) {
                const reading = this.data.readings[todayIndex];
                
                // Decrease the reading by the action's page count
                reading.pages_read -= lastAction.pages;
                reading.end_page = lastAction.from_page - 1; // Go back to before this action
                reading.updated_at = new Date().toISOString();
                
                // If no pages left, remove the reading entry
                if (reading.pages_read <= 0) {
                    this.data.readings.splice(todayIndex, 1);
                    this.data.last_read_date = null;
                }
                
                // Restore current page to where it was before this action
                this.data.current_page = lastAction.from_page;
            }
        } else if (lastAction.type === 'decrease') {
            // Reverse a decrease action (add the pages back)
            const today = lastAction.date;
            const todayIndex = this.data.readings.findIndex(r => r.date === today);
            
            if (todayIndex >= 0) {
                const reading = this.data.readings[todayIndex];
                reading.pages_read += lastAction.pages;
                reading.end_page += lastAction.pages;
                reading.updated_at = new Date().toISOString();
                this.data.current_page += lastAction.pages;
            }
        }

        // Remove the action from history
        this.data.actions.splice(lastActionIndex, 1);
        this.save();

        return { 
            success: true, 
            undone: lastAction,
            pages_removed: lastAction.type === 'add' ? lastAction.pages : 0,
            pages_restored: lastAction.type === 'decrease' ? lastAction.pages : 0,
            current_page: this.data.current_page
        };
    }

    // Get last few actions for display
    getRecentActions(limit = 5) {
        return this.data.actions.slice(-limit).reverse();
    }

    // Decrease pages for today (manual adjustment)
    decreasePages(pages) {
        const today = new Date().toISOString().split('T')[0];
        const todayIndex = this.data.readings.findIndex(r => r.date === today);
        
        if (todayIndex < 0) {
            return { success: false, error: 'No reading today' };
        }

        const reading = this.data.readings[todayIndex];
        
        if (reading.pages_read <= pages) {
            // Remove entire entry if decreasing by all or more
            const removed = reading.pages_read;
            this.data.readings.splice(todayIndex, 1);
            this.data.current_page = reading.start_page; // Go back to start
            this.data.last_read_date = null;
            
            // Add decrease action
            this.data.actions.push({
                id: Date.now(),
                type: 'decrease',
                date: today,
                pages: removed,
                timestamp: new Date().toISOString()
            });
            
            this.save();
            return { 
                success: true, 
                pages_removed: removed,
                current_page: this.data.current_page
            };
        }

        // Decrease pages
        reading.pages_read -= pages;
        reading.end_page -= pages;
        reading.updated_at = new Date().toISOString();
        
        // Update current page
        this.data.current_page -= pages;
        
        // Also add a negative action for tracking
        this.data.actions.push({
            id: Date.now(),
            type: 'decrease',
            date: today,
            pages: pages,
            timestamp: new Date().toISOString()
        });
        
        this.save();
        
        return { 
            success: true, 
            pages_decreased: pages,
            remaining_today: reading.pages_read,
            current_page: this.data.current_page
        };
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
        const recentActions = this.getRecentActions(3);
        
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
            ramadan_end: goal.end_date,
            recent_actions: recentActions
        };
    }

    getAllReadings() {
        return this.data.readings.sort((a, b) => b.date.localeCompare(a.date));
    }
}

module.exports = SimpleDatabase;
