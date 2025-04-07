document.addEventListener("DOMContentLoaded", function () {
    initQRScanner();
    initDashboardCharts();
    initRoleBasedDashboard();
});

function initQRScanner() {
    let activeReader = null;
    let scannerStarted = false; // Flag to track if the scanner has been started

    function updateResult(message) {
        const resultElement = document.getElementById('result');
        if (resultElement) {
            resultElement.innerText = message;
            resultElement.classList.add('animate__animated', 'animate__fadeInUp', 'success-scan');
            setTimeout(() => {
                resultElement.classList.remove('success-scan');
            }, 1000);
        }
    }

    function startScanner(cameraId) {
        // Stop any existing scanner
        if (activeReader) {
            try {
                activeReader.stop();
            } catch (err) {
                console.log("No active scanner to stop");
            }
            activeReader = null;
            scannerStarted = false; // Reset the flag when stopping
        }

        // Clear the container
        const readerContainer = document.getElementById("reader");
        if (readerContainer) {
            readerContainer.innerHTML = "";
        }

        // Create a new scanner instance
        activeReader = new Html5Qrcode("reader");

        const config = {
            fps: 10,
            qrbox: 250,
            videoConstraints: {
                facingMode: "environment" // Use back camera
            }
        };

        activeReader.start(
            cameraId,
            config,
            (qrCodeMessage) => {
                updateResult(`Scanned: ${qrCodeMessage}`);
                // Optionally, stop the scanner after a successful scan
                // if (activeReader && scannerStarted) {
                //     activeReader.stop();
                //     activeReader = null;
                //     scannerStarted = false;
                // }
            },
            (errorMessage) => {
                console.warn("QR Scan error:", errorMessage);
            }
        ).catch(err => {
            console.error("Scanner start error:", err);
            updateResult("Error starting scanner: " + err.message);
        });
        scannerStarted = true; // Set the flag after successfully starting
    }

    // Get available cameras and use main one
    Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
            const backCamera = devices.find(device => device.label.toLowerCase().includes('back')) || devices[0];
            // Start the scanner only if it hasn't been started yet
            if (!scannerStarted) {
                startScanner(backCamera.id);
                updateResult(`Using: ${backCamera.label || "Default Camera"}`);
            }
        } else {
            console.error("No camera devices found.");
            updateResult("No cameras detected!");
        }
    }).catch(err => {
        console.error("Camera fetch error:", err);
        updateResult("Error accessing cameras: " + err.message);
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
