#!/bin/sh
# Install or remove the hourly fetch as a launchd agent for this user.
#   tasks/T13-ladder-monitor/job.sh install | uninstall | status
# launchd runs a missed interval once on wake, so a sleeping Mac leaves gaps.
set -eu
LABEL=local.tychebot.t13-ladder-monitor
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DATA="$HOME/.tychebot/t13-ladder-monitor"
TASK="$(cd "$(dirname "$0")" && pwd)"
UV="$(command -v uv)"

case "${1:-}" in
install)
  # The agent runs a copy, so no checkout has to stay and branch edits can't change it mid-run.
  mkdir -p "$DATA/bin"
  cp "$TASK/fetch.py" "$DATA/bin/fetch.py"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$UV</string><string>run</string><string>--no-project</string><string>$DATA/bin/fetch.py</string><string>$DATA</string></array>
  <key>StartInterval</key><integer>3600</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$DATA/job.log</string>
  <key>StandardErrorPath</key><string>$DATA/job.log</string>
</dict>
</plist>
EOF
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  echo "installed $PLIST, data in $DATA"
  ;;
uninstall)
  launchctl bootout "gui/$(id -u)/$LABEL" || true
  rm -f "$PLIST"
  echo "removed $PLIST; data left in $DATA"
  ;;
status)
  launchctl print "gui/$(id -u)/$LABEL" | grep -E "state|last exit|runs" || echo "not loaded"
  tail -3 "$DATA/runs.jsonl" 2>/dev/null || true
  ;;
*)
  echo "usage: $0 install | uninstall | status" >&2
  exit 2
  ;;
esac
