#!/data/data/com.termux/files/usr/bin/bash
# Setup daily reminder notifications

echo "Setting up daily Quran reading reminders..."

# Create reminder script
cat > ~/.shortcuts/quran-reminder.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
# Check if read today, send reminder if not

curl -s -X POST http://localhost:8080/api/reminder
EOF

chmod +x ~/.shortcuts/quran-reminder.sh

# Using termux-job-scheduler for daily reminders
echo ""
echo "To set up automatic daily reminders at 8 PM:"
echo ""
echo "Run this command:"
echo "  termux-job-scheduler --period-ms 86400000 --script ~/.shortcuts/quran-reminder.sh"
echo ""
echo "Or use Tasker for exact time scheduling."
echo ""
echo "Manual reminder:"
echo "  bash ~/.shortcuts/quran-reminder.sh"
