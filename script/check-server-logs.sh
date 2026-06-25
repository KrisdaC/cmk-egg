#!/bin/bash
# Usage: ./script/check-server-logs.sh [user@host] [lines]
# Example: ./script/check-server-logs.sh root@165.22.48.49 100

HOST="${1:-root@165.22.48.49}"
LINES="${2:-100}"

echo "=== PM2 Status ==="
ssh "$HOST" "pm2 list"

echo ""
echo "=== Last $LINES lines of PM2 error log ==="
ssh "$HOST" "pm2 logs --lines $LINES --nostream 2>&1 | tail -$LINES"
