function initDashboardCharts(faultTrendData, faultDistributionData, resourceTrendData, systemStatusData) {
    // Fault Trend Chart
    if (Array.isArray(faultTrendData) && faultTrendData.length > 0) {
        const faultMonths = faultTrendData.map(item =>
            new Date(item.month).toLocaleString('default', { month: 'short', year: 'numeric' })
        );
        const faultCounts = faultTrendData.map(item => item.count);

        Plotly.newPlot("faultTrendChart", [{
            x: faultMonths,
            y: faultCounts,
            type: 'scatter',
            mode: 'lines+markers',
            marker: { color: 'red' }
        }], {
            title: { text: '📈 Fault Reports Over Time', font: { size: 22 } },
            xaxis: { title: { text: 'Month' } },
            yaxis: { title: { text: 'Number of Faults' } },
            margin: { t: 60 }
        });
    } else {
        document.getElementById("faultTrendChart").innerText = "No fault trend data available.";
    }

    // Fault Distribution Pie Chart
    if (Array.isArray(faultDistributionData) && faultDistributionData.length > 0) {
        const faultTypes = faultDistributionData.map(item => item.fault_type);
        const faultCounts = faultDistributionData.map(item => item.count);

        Plotly.newPlot("faultDistributionChart", [{
            labels: faultTypes,
            values: faultCounts,
            type: 'pie'
        }], {
            title: { text: '📊 Fault Type Distribution', font: { size: 22 } },
            margin: { t: 60 }
        });
    } else {
        document.getElementById("faultDistributionChart").innerText = "No fault distribution data available.";
    }

    // Resource Request Trend
    if (Array.isArray(resourceTrendData) && resourceTrendData.length > 0) {
        const resourceMonths = resourceTrendData.map(item =>
            new Date(item.month).toLocaleString('default', { month: 'short', year: 'numeric' })
        );
        const resourceCounts = resourceTrendData.map(item => item.count);

        Plotly.newPlot("resourceRequestChart", [{
            x: resourceMonths,
            y: resourceCounts,
            type: 'bar',
            marker: { color: 'green' }
        }], {
            title: { text: '📦 Resource Requests Trend', font: { size: 22 } },
            xaxis: { title: { text: 'Month' } },
            yaxis: { title: { text: 'Number of Requests' } },
            margin: { t: 60 }
        });
    } else {
        document.getElementById("resourceRequestChart").innerText = "No resource request data available.";
    }

    // System Status Distribution Chart
    if (Array.isArray(systemStatusData) && systemStatusData.length > 0) {
        const statuses = systemStatusData.map(item => item.status);
        const counts = systemStatusData.map(item => item.count);

        Plotly.newPlot("systemStatusChart", [{
            labels: statuses,
            values: counts,
            type: 'pie',
            hole: 0.4  // Optional for donut style
        }], {
            title: { text: '🖥️ System Status Distribution', font: { size: 22 } },
            margin: { t: 60 }
        });
    } else {
        document.getElementById("systemStatusChart").innerText = "No system status data available.";
    }

}

function initQRScanner() {
    const readerElement = document.getElementById("reader");
    if (!readerElement) return;

    const html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: 250 };

    html5QrCode.start(
        { facingMode: "environment" },
        config,
        qrCodeMessage => {
            sendScanResultToServer(qrCodeMessage);
            html5QrCode.stop().then(() => {
                console.log("Scanner stopped.");
            });
        },
        errorMessage => {
            // console.warn(`QR error: ${errorMessage}`);
        }
    ).catch(err => {
        console.error("Failed to start QR scanner:", err);
    });
}

function sendScanResultToServer(qrData) {
    fetch('/dashboard/scan-result/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_data: qrData })
    })
    .then(res => res.json())
    .then(data => {
        if (data.redirect_url) {
            window.location.href = data.redirect_url;
        } else if (data.error) {
            console.error('Server error:', data.error);
        }
    })
    .catch(err => {
        console.error('Fetch error:', err);
    });
}

function initRoleBasedDashboard() {
    const userRole = document.body.getAttribute("data-user-role")?.trim() || "";
    if (!userRole) {
        console.warn("User role is missing!");
        return;
    }

    document.querySelectorAll("[data-role]").forEach(el => {
        if (el.getAttribute("data-role") === userRole) {
            el.style.display = el.closest(".sidebar") ? "flex" : "block";
        } else {
            el.style.display = "none";
        }
    });
}
