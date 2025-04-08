document.addEventListener("DOMContentLoaded", function () {
    initQRScanner();
    initDashboardCharts();
    initRoleBasedDashboard();
});

function initQRScanner() {
    const readerElement = document.getElementById("reader");
    if (!readerElement) {
        console.log("QR scanner not initialized: #reader element not found on this page.");
        return;
    }

    const html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: 250 };

    html5QrCode.start(
        { facingMode: "environment" },
        config,
        (qrCodeMessage) => {
            sendScanResultToServer(qrCodeMessage); // Send QR data to the server
            html5QrCode.stop().then(() => {
                console.log("Scanner stopped after successful scan.");
            }).catch(err => {
                console.error("Error stopping scanner: ", err);
            });
        },
        (errorMessage) => {
            // optional: console.warn(`QR Scan error: ${errorMessage}`);
        }
    ).catch(err => {
        console.error("Failed to start scanner: ", err);
    });
}

// Send scanned QR data to Django backend
function sendScanResultToServer(qrData) {
    fetch('/dashboard/scan-result/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ qr_data: qrData })
    })
    .then(response => response.json())
    .then(data => {
        if (data.redirect_url) {
            window.location.href = data.redirect_url; // Redirect user
        } else if (data.error) {
            console.error('Server error:', data.error);
        }
    })
    .catch(error => {
        console.error('Error sending scan result:', error);
    });
}

function initDashboardCharts() {
    if (typeof Plotly === "undefined") {
        console.log("Plotly.js not loaded on this page");
        return;
    }

    const performanceChart = document.getElementById('performanceChart');
    const faultTrendChart = document.getElementById('faultTrendChart');
    const faultDistributionChart = document.getElementById('faultDistributionChart');
    const resourceRequestChart = document.getElementById('resourceRequestChart');

    if (performanceChart && faultTrendChart && faultDistributionChart && resourceRequestChart) {
        Plotly.newPlot("performanceChart", [{
            x: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
            y: [10, 15, 7, 20, 13],
            type: 'bar',
            marker: { color: '#007bff' }
        }], {
            title: { text: 'Monthly Requests' },
            xaxis: { title: { text: 'Month' } },
            yaxis: { title: { text: 'Value' } },
            margin: { t: 50 }
        });

        Plotly.newPlot("faultTrendChart", [{
            x: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
            y: [2, 5, 8, 3, 6],
            type: 'scatter',
            mode: 'lines+markers',
            marker: { color: 'red' }
        }], {
            title: { text: 'Fault Reports Over Time' },
            xaxis: { title: { text: 'Month' } },
            yaxis: { title: { text: 'Faults' } },
            margin: { t: 50 }
        });

        Plotly.newPlot("faultDistributionChart", [{
            labels: ['Hardware', 'Software', 'Network', 'Other'],
            values: [30, 45, 15, 10],
            type: 'pie'
        }], {
            title: { text: 'Fault Distribution' },
            margin: { t: 50 }
        });

        Plotly.newPlot("resourceRequestChart", [{
            x: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
            y: [5, 8, 12, 7, 10],
            mode: 'markers',
            marker: { color: 'green', size: 10 }
        }], {
            title: { text: 'Resource Requests Trend' },
            xaxis: { title: { text: 'Month' } },
            yaxis: { title: { text: 'Requests' } },
            margin: { t: 50 }
        });
    }
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
