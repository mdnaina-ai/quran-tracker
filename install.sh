#!/data/data/com.termux/files/usr/bin/bash
# Quran Tracker Installation Script for Termux

set -e

echo "╔═══════════════════════════════════════════════════╗"
echo "║     Quran Tracker - Termux Installer              ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if in Termux
if [ -z "$TERMUX_VERSION" ] && [ ! -d "/data/data/com.termux" ]; then
    echo -e "${RED}Error: This script must run in Termux${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1/5: Updating packages...${NC}"
pkg update -y

echo -e "${YELLOW}Step 2/5: Installing dependencies...${NC}"
pkg install -y nodejs sqlite termux-api

# Install termux-widget if available
echo -e "${YELLOW}Step 3/5: Checking termux-widget...${NC}"
if [ ! -d "/data/data/com.termux.widget" ]; then
    echo -e "${YELLOW}⚠️  termux-widget not installed${NC}"
    echo "Install from F-Droid for home screen widgets"
fi

echo -e "${YELLOW}Step 4/5: Setting up Quran Tracker...${NC}"

# Create directory
mkdir -p ~/quran-tracker
cd ~/quran-tracker

# Copy files (assumes they're in the same directory as this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cp "$SCRIPT_DIR/package.json" .
cp "$SCRIPT_DIR/server.js" .
cp "$SCRIPT_DIR/database.js" .
cp "$SCRIPT_DIR/init-db.sql" .

# Install Node dependencies
echo "Installing Node.js packages..."
npm install

# Initialize database
echo "Creating database..."
sqlite3 quran.db < init-db.sql

echo -e "${YELLOW}Step 5/5: Setting up auto-start...${NC}"

# Create boot script
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/start-quran-tracker.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
# Auto-start Quran Tracker on boot

# Keep termux awake
termux-wake-lock

# Start the server
cd ~/quran-tracker
node server.js &
echo "Quran Tracker started on port 8080"
EOF

chmod +x ~/.termux/boot/start-quran-tracker.sh

# Create shortcut for widget
mkdir -p ~/.shortcuts
cat > ~/.shortcuts/quran-status.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
# Widget display script

cd ~/quran-tracker

# Get current progress using curl
curl -s http://localhost:8080/api/progress | node -e "
const data = '';
process.stdin.on('data', c => data.push(c));
process.stdin.on('end', () => {
    try {
        const p = JSON.parse(data.join(''));
        console.log(\`📖 \${p.current_page}/\${p.total_pages} (\${p.percent}%)\`);
        console.log(\`🔥 \${p.streak_days} day streak\`);
        console.log(\`📅 \${p.today_done}/\${p.daily_goal} today\`);
    } catch(e) {
        console.log('Server not running');
    }
});
" 2>/dev/null || echo "📖 Quran Tracker offline"
EOF

chmod +x ~/.shortcuts/quran-status.sh

# Create quick log script
cat > ~/.shortcuts/quran-log.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
# Quick log script

echo "How many pages did you read?"
read pages

curl -s -X POST http://localhost:8080/api/log \
    -H "Content-Type: application/json" \
    -d "{\"pages\": \$pages}" | node -e "
const data = '';
process.stdin.on('data', c => data.push(c));
process.stdin.on('end', () => {
    try {
        const r = JSON.parse(data.join(''));
        if (r.success) {
            console.log(\`✅ Logged \${pages} pages!\`);
            console.log(\`📖 Now at page \${r.progress.current_page}\`);
        } else {
            console.log('Failed to log');
        }
    } catch(e) {
        console.log('Error: Server may not be running');
    }
});
"
EOF

chmod +x ~/.shortcuts/quran-log.sh

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        Installation Complete!                     ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Start the server:"
echo "   cd ~/quran-tracker && node server.js"
echo ""
echo "2. Add widget to home screen:"
echo "   - Long press home screen"
echo "   - Select 'Widgets'"
echo "   - Find 'Termux:Widget'"
echo "   - Select 'quran-status.sh' or 'quran-log.sh'"
echo ""
echo "3. Enable auto-start on boot:"
echo "   (Already configured in ~/.termux/boot/)"
echo ""
echo "4. Test the API:"
echo "   curl http://localhost:8080/api/progress"
echo ""
echo "5. Alfred (me) can now access via Tailscale:"
echo "   http://<your-phone-tailscale-ip>:8080"
echo ""
echo "API Endpoints:"
echo "  GET  /api/progress   - Full progress"
echo "  GET  /api/today      - Today's reading"
echo "  POST /api/log        - Log pages {pages: 5}"
echo "  GET  /api/dashboard  - Dashboard data"
echo ""
