#!/usr/bin/env bash
# =======================================================
#   NexusGrid Monitoring Script Installer (Linux)
# =======================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "======================================================="
echo "  NexusGrid Monitoring Script Installer (Linux)"
echo "======================================================="
echo ""

# =======================================================
# SERVER URL CONFIGURATION
# To switch to hosted Render backend, set NEXUSGRID_BASE_URL:
# NEXUSGRID_BASE_URL="https://nexusgrid.onrender.com"
# =======================================================
NEXUSGRID_BASE_URL="${NEXUSGRID_BASE_URL:-http://127.0.0.1:8000}"
NEXUSGRID_BASE_URL="${NEXUSGRID_BASE_URL%/}"
UPDATE_URL="${NEXUSGRID_BASE_URL}/api/agent/script.py?format=raw"
export NEXUSGRID_INGEST_URL="${NEXUSGRID_BASE_URL}/api/ingest/"

echo "[SERVER] Target Backend: ${NEXUSGRID_BASE_URL}"
echo ""

# Step 1: Detect Python 3
echo "[1/5] Checking Python 3 environment..."
if command -v python3 &>/dev/null; then
    PY_CMD="python3"
elif command -v python &>/dev/null; then
    PY_CMD="python"
else
    echo "[ERROR] Python 3 was not found. Please install python3 and pip."
    exit 1
fi

echo "[OK] Using Python command: $($PY_CMD --version)"
echo ""

# Step 2: Fetch latest script.py from backend server
echo "[2/5] Fetching latest monitoring script from server..."
if command -v curl &>/dev/null; then
    curl -s -f "$UPDATE_URL" -o "$SCRIPT_DIR/script.py.tmp" && mv "$SCRIPT_DIR/script.py.tmp" "$SCRIPT_DIR/script.py" && echo "[OK] Successfully downloaded latest script.py" || echo "[NOTE] Server offline or fetch failed. Using local script.py."
elif command -v wget &>/dev/null; then
    wget -q "$UPDATE_URL" -O "$SCRIPT_DIR/script.py.tmp" && mv "$SCRIPT_DIR/script.py.tmp" "$SCRIPT_DIR/script.py" && echo "[OK] Successfully downloaded latest script.py" || echo "[NOTE] Server offline or fetch failed. Using local script.py."
fi
echo ""

# Step 3: Install required Python dependencies
echo "[3/5] Installing / verifying required dependencies..."
$PY_CMD -m pip install --upgrade requests psutil GPUtil &>/dev/null || {
    echo "[NOTE] Installing without upgrade flag..."
    $PY_CMD -m pip install requests psutil GPUtil
}
echo "[OK] Dependencies verified (requests, psutil, GPUtil)."
echo ""

# Step 4: Run monitoring script immediately after installation
echo "[4/5] Running monitoring script immediately..."
if $PY_CMD "$SCRIPT_DIR/script.py"; then
    echo "[OK] Initial monitoring payload sent successfully."
else
    echo "[WARNING] Monitoring script executed with non-zero status."
fi
echo ""

# Step 5: Configure persistence for system restart
echo "[5/5] Setting up automatic run on system restart / boot..."

SERVICE_NAME="nexusgrid-monitoring"
SYSTEMD_SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

if [ "$EUID" -eq 0 ] && command -v systemctl &>/dev/null; then
    echo "[OK] Root permissions detected. Configuring systemd service & timer..."
    
    cat <<EOF > "$SYSTEMD_SERVICE_FILE"
[Unit]
Description=NexusGrid System Monitoring Service
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$SCRIPT_DIR
ExecStartPre=-/bin/bash -c "curl -s -f '$UPDATE_URL' -o '$SCRIPT_DIR/script.py.tmp' && mv '$SCRIPT_DIR/script.py.tmp' '$SCRIPT_DIR/script.py'"
ExecStart=$(command -v $PY_CMD) $SCRIPT_DIR/script.py
Environment=NEXUSGRID_BASE_URL=${NEXUSGRID_BASE_URL}
Environment=NEXUSGRID_INGEST_URL=${NEXUSGRID_INGEST_URL}
EOF

    SYSTEMD_TIMER_FILE="/etc/systemd/system/${SERVICE_NAME}.timer"
    cat <<EOF > "$SYSTEMD_TIMER_FILE"
[Unit]
Description=Run NexusGrid Monitoring Service every 30 seconds

[Timer]
OnBootSec=1min
OnUnitActiveSec=30s

[Install]
WantedBy=timers.target
EOF

    systemctl daemon-reload
    systemctl enable --now "${SERVICE_NAME}.timer"
    echo "[OK] Systemd timer enabled (Runs every 30 seconds): ${SYSTEMD_TIMER_FILE}"
else
    echo "[NOTE] Non-root user or systemd not active. Setting up user Crontab..."
    
    CRON_CMD="@reboot export NEXUSGRID_BASE_URL=${NEXUSGRID_BASE_URL}; while true; do curl -s -f '${UPDATE_URL}' -o '${SCRIPT_DIR}/script.py.tmp' && mv '${SCRIPT_DIR}/script.py.tmp' '${SCRIPT_DIR}/script.py'; \$(command -v \$PY_CMD) \$SCRIPT_DIR/script.py; sleep 30; done"
    
    (crontab -l 2>/dev/null | grep -v "$SCRIPT_DIR/script.py"; echo "$CRON_CMD") | crontab -
    echo "[OK] Added @reboot loop (Runs every 30 seconds) to user crontab."
fi

echo ""
echo "======================================================="
echo "  Installation Completed Successfully!"
echo "  - Backend Server: ${NEXUSGRID_BASE_URL}"
echo "  - Script ran immediately: YES"
echo "  - Auto-updates on startup: YES"
echo "  - Runs on system restart: YES"
echo "  - Execution Frequency: EVERY 30 SECONDS"
echo "======================================================="

