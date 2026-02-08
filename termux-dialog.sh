#!/data/data/com.termux/files/usr/bin/bash
# Quran Tracker - Dialog Input Version

# Show counter dialog for pages
result=$(termux-dialog counter -t "Quran Reading" -i "How many pages did you read?" 2>/dev/null)

# Parse JSON result
pages=$(echo "$result" | grep -o '"text":"[0-9]*"' | cut -d'"' -f4)
code=$(echo "$result" | grep -o '"code":-?[0-9]*' | cut -d: -f2)

if [ "$code" = "-1" ] || [ -z "$pages" ]; then
    termux-toast "Cancelled" 2>/dev/null || echo "Cancelled"
    exit 0
fi

# Validate pages is a number
if ! echo "$pages" | grep -q '^[0-9]+$'; then
    termux-toast "Invalid number" 2>/dev/null || echo "Invalid number"
    exit 1
fi

# Log to API
response=$(curl -s -X POST http://localhost:8080/api/log \
    -H "Content-Type: application/json" \
    -d "{\"pages\": $pages}" 2>/dev/null)

# Check success
if echo "$response" | grep -q '"success":true'; then
    current=$(echo "$response" | grep -o '"current_page":[0-9]*' | cut -d: -f2)
    percent=$(echo "$response" | grep -o '"percent":"[0-9.]*"' | cut -d'"' -f4)
    
    msg="✅ Logged $pages pages! Now at page $current ($percent%)"
    termux-toast "$msg" 2>/dev/null || echo "$msg"
    
    # Optional: Show notification
    termux-notification --title "📖 Quran Tracker" --content "$msg" --priority low 2>/dev/null
else
    termux-toast "❌ Failed to log" 2>/dev/null || echo "Failed to log"
fi
