#!/usr/bin/env zsh
# Runs a command under the shared timing lock (AGENTS.md, Conventions: Timed runs), printing the load
# averages before and after. Usage: ./timed.sh <command...>
L="$(git rev-parse --path-format=absolute --git-common-dir)/timing.lock"; until mkdir "$L" 2>/dev/null; do sleep 30; done; echo "T02 $(date +%FT%T)" > "$L/owner"; trap 'rm -f "$L/owner"; rmdir "$L" 2>/dev/null' EXIT; trap 'exit 143' INT TERM HUP
echo "lock taken $(date +%FT%T), load $(sysctl -n vm.loadavg)"
"$@"
rc=$?
echo "done $(date +%FT%T), load $(sysctl -n vm.loadavg)"
exit $rc
