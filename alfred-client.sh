#!/bin/bash
# Alfred Client Script for Quran Tracker
# Run this on your OpenClaw machine to access the phone's tracker

# Replace with your phone's Tailscale IP
PHONE_IP="${QURAN_TRACKER_IP:-100.x.x.x}"
PHONE_PORT="${QURAN_TRACKER_PORT:-8080}"
BASE_URL="http://${PHONE_IP}:${PHONE_PORT}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

function show_help() {
    echo "Alfred Quran Tracker Client"
    echo ""
    echo "Usage: $0 [command] [args]"
    echo ""
    echo "Commands:"
    echo "  status              Show current progress"
    echo "  today               Show today's reading"
    echo "  log [pages]         Log pages read"
    echo "  dashboard           Full dashboard"
    echo "  reminder            Send reminder if not read"
    echo "  notify [msg]        Send custom notification"
    echo ""
    echo "Environment:"
    echo "  Set QURAN_TRACKER_IP to your phone's Tailscale IP"
    echo ""
}

function check_connection() {
    if ! curl -s --connect-timeout 3 "${BASE_URL}/" > /dev/null 2>&1; then
        echo "❌ Cannot connect to ${BASE_URL}"
        echo "   Make sure:"
        echo "   1. Phone is on Tailscale"
        echo "   2. Quran Tracker server is running"
        echo "   3. QURAN_TRACKER_IP is set correctly"
        exit 1
    fi
}

case "$1" in
    status|progress)
        check_connection
        echo -e "${GREEN}📖 Quran Progress${NC}"
        echo "=================="
        curl -s "${BASE_URL}/api/progress" | python3 -m json.tool 2>/dev/null || curl -s "${BASE_URL}/api/progress"
        ;;
    
    today)
        check_connection
        echo -e "${GREEN}📅 Today's Reading${NC}"
        echo "==================="
        curl -s "${BASE_URL}/api/today" | python3 -m json.tool 2>/dev/null || curl -s "${BASE_URL}/api/today"
        ;;
    
    log)
        check_connection
        PAGES="${2:-5}"
        echo -e "${YELLOW}Logging ${PAGES} pages...${NC}"
        curl -s -X POST "${BASE_URL}/api/log" \
            -H "Content-Type: application/json" \
            -d "{\"pages\": ${PAGES}}" | python3 -m json.tool 2>/dev/null || curl -s -X POST "${BASE_URL}/api/log" \
            -H "Content-Type: application/json" \
            -d "{\"pages\": ${PAGES}}"
        ;;
    
    dashboard)
        check_connection
        echo -e "${GREEN}📊 Dashboard${NC}"
        echo "============"
        curl -s "${BASE_URL}/api/dashboard" | python3 -m json.tool 2>/dev/null || curl -s "${BASE_URL}/api/dashboard"
        ;;
    
    streak)
        check_connection
        curl -s "${BASE_URL}/api/streak" | python3 -m json.tool 2>/dev/null || curl -s "${BASE_URL}/api/streak"
        ;;
    
    remaining)
        check_connection
        echo -e "${GREEN}📈 Remaining Analysis${NC}"
        echo "======================"
        curl -s "${BASE_URL}/api/remaining" | python3 -m json.tool 2>/dev/null || curl -s "${BASE_URL}/api/remaining"
        ;;
    
    reminder)
        check_connection
        echo -e "${YELLOW}Checking reminder...${NC}"
        curl -s -X POST "${BASE_URL}/api/reminder" | python3 -m json.tool 2>/dev/null || curl -s -X POST "${BASE_URL}/api/reminder"
        ;;
    
    notify)
        check_connection
        TITLE="${2:-Quran Tracker}"
        CONTENT="${3:-Time to read!}"
        curl -s -X POST "${BASE_URL}/api/notify" \
            -H "Content-Type: application/json" \
            -d "{\"title\": \"${TITLE}\", \"content\": \"${CONTENT}\"}"
        echo "Notification sent"
        ;;
    
    export)
        check_connection
        curl -s "${BASE_URL}/api/export" > quran-backup-$(date +%Y%m%d).json
        echo "Backup saved to quran-backup-$(date +%Y%m%d).json"
        ;;
    
    ping)
        curl -s "${BASE_URL}/" | python3 -m json.tool 2>/dev/null || curl -s "${BASE_URL}/"
        ;;
    
    help|--help|-h)
        show_help
        ;;
    
    *)
        echo "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
