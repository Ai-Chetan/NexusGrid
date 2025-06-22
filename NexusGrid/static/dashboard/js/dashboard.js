/**
 * Simplified Dashboard JavaScript
 * Focuses on UI interactions and chart rendering with server-provided data
 */

document.addEventListener("DOMContentLoaded", function () {
    // Initialize dashboard components
    initDashboardUI();
    initRoleBasedVisibility();
    
    // Initialize QR scanner if on scanner page
    if (document.getElementById("qr-reader")) {
        initQRScanner();
    }
    
    // Initialize charts if data is available
    if (window.chartData) {
        initChartsFromServerData(window.chartData);
    }
    
    // Setup refresh handlers
    setupRefreshHandlers();
});

function initDashboardUI() {
    // Add smooth animations to cards
    const cards = document.querySelectorAll('.overview-card, .history-card, .workspace-card');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
        card.classList.add('fade-in-up');
    });
    
    // Setup interactive elements
    setupCardHovers();
    setupProgressBars();
}

function setupCardHovers() {
    const interactiveCards = document.querySelectorAll('.workspace-card, .history-card');
    
    interactiveCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '';
        });
    });
}

function setupProgressBars() {
    const progressBars = document.querySelectorAll('.progress-bar');
    
    progressBars.forEach(bar => {
        const percentage = bar.dataset.percentage || 0;
        
        // Animate progress bar width
        setTimeout(() => {
            bar.style.width = `${percentage}%`;
        }, 500);
    });
}

function initChartsFromServerData(chartData) {
    // Initialize charts with server-provided data
    const chartConfigs = [
        {
            elementId: "faultTrendChart",
            data: chartData.fault_trend,
            type: 'line'
        },
        {
            elementId: "faultDistributionChart", 
            data: chartData.fault_distribution,
            type: 'pie'
        },
        {
            elementId: "resourceRequestChart",
            data: chartData.resource_trend,
            type: 'bar'
        },
        {
            elementId: "systemStatusChart",
            data: chartData.system_status,
            type: 'doughnut'
        }
    ];
    
    // Render charts with staggered animation
    chartConfigs.forEach((config, index) => {
        setTimeout(() => {
            renderChart(config);
        }, index * 200);
    });
}

function renderChart(config) {
    const element = document.getElementById(config.elementId);
    if (!element || !config.data) return;
    
    // Remove loading state
    element.classList.remove('loading-skeleton', 'loading-graph');
    element.classList.add('chart-ready');
    
    // Check if data is empty
    if (!config.data.data || config.data.data.length === 0) {
        showEmptyChart(element, config.data.title);
        return;
    }
    
    // Prepare chart data based on type
    let chartData, layout;
    
    switch (config.type) {
        case 'line':
            chartData = [{
                x: config.data.labels,
                y: config.data.data,
                type: 'scatter',
                mode: 'lines+markers',
                marker: { color: '#dc3545', size: 6 },
                line: { color: '#dc3545', width: 3 }
            }];
            layout = {
                title: { text: `📈 ${config.data.title}`, font: { size: 18 } },
                margin: { t: 50, b: 40, l: 50, r: 20 },
                showlegend: false
            };
            break;
            
        case 'bar':
            chartData = [{
                x: config.data.labels,
                y: config.data.data,
                type: 'bar',
                marker: { color: '#28a745' }
            }];
            layout = {
                title: { text: `📦 ${config.data.title}`, font: { size: 18 } },
                margin: { t: 50, b: 40, l: 50, r: 20 },
                showlegend: false
            };
            break;
            
        case 'pie':
            chartData = [{
                labels: config.data.labels,
                values: config.data.data,
                type: 'pie',
                textinfo: 'label+percent',
                textposition: 'outside'
            }];
            layout = {
                title: { text: `📊 ${config.data.title}`, font: { size: 18 } },
                margin: { t: 50, b: 20, l: 20, r: 20 },
                showlegend: false
            };
            break;
            
        case 'doughnut':
            chartData = [{
                labels: config.data.labels,
                values: config.data.data,
                type: 'pie',
                hole: 0.4,
                textinfo: 'label+percent',
                textposition: 'outside'
            }];
            layout = {
                title: { text: `🖥️ ${config.data.title}`, font: { size: 18 } },
                margin: { t: 50, b: 20, l: 20, r: 20 },
                showlegend: false
            };
            break;
    }
    
    // Render chart
    Plotly.newPlot(config.elementId, chartData, layout, {
        responsive: true,
        displayModeBar: false,
        staticPlot: false
    });
    
    // Add resize handler
    window.addEventListener('resize', () => {
        Plotly.Plots.resize(config.elementId);
    });
}

function showEmptyChart(element, title) {
    element.innerHTML = `
        <div class="empty-chart d-flex align-items-center justify-content-center h-100">
            <div class="text-center text-muted">
                <i class="fas fa-chart-bar fa-2x mb-3"></i>
                <p class="mb-0">${title}</p>
                <small>No data available</small>
            </div>
        </div>
    `;
}

function initQRScanner() {
    const readerElement = document.getElementById("qr-reader");
    if (!readerElement) return;
    
    // Get scanner config from server
    const config = window.scannerConfig || { fps: 10, qrbox: 250 };
    
    const html5QrCode = new Html5Qrcode("qr-reader");
    
    // Start scanner
    html5QrCode.start(
        { facingMode: "environment" },
        config,
        qrCodeMessage => {
            // Process scan result
            processScanResult(qrCodeMessage);
            
            // Stop scanner
            html5QrCode.stop().then(() => {
                showScanSuccess("QR Code scanned successfully!");
            });
        },
        errorMessage => {
            // Silent error handling for scanning attempts
            console.debug(`QR scan attempt: ${errorMessage}`);
        }
    ).catch(err => {
        console.error("Failed to start QR scanner:", err);
        showScanError("Unable to start camera. Please check permissions.");
    });
}

function processScanResult(qrData) {
    // Show loading state
    showScanLoading("Processing QR code...");
    
    // Send to server for processing
    fetch('/dashboard/process-qr/', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify({ qr_data: qrData })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.redirect_url) {
            showScanSuccess(data.message || "Redirecting...");
            setTimeout(() => {
                window.location.href = data.redirect_url;
            }, 1000);
        } else {
            showScanError(data.error || "Invalid QR code");
        }
    })
    .catch(err => {
        console.error('QR processing error:', err);
        showScanError("Unable to process QR code. Please try again.");
    });
}

function showScanLoading(message) {
    const scanStatus = document.getElementById('scan-status');
    if (scanStatus) {
        scanStatus.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-spinner fa-spin me-2"></i>${message}
            </div>
        `;
    }
}

function showScanSuccess(message) {
    const scanStatus = document.getElementById('scan-status');
    if (scanStatus) {
        scanStatus.innerHTML = `
            <div class="alert alert-success">
                <i class="fas fa-check-circle me-2"></i>${message}
            </div>
        `;
    }
}

function showScanError(message) {
    const scanStatus = document.getElementById('scan-status');
    if (scanStatus) {
        scanStatus.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>${message}
            </div>
        `;
    }
}

function initRoleBasedVisibility() {
    const userRole = document.body.getAttribute("data-user-role")?.trim();
    if (!userRole) return;
    
    // Show/hide role-specific elements
    document.querySelectorAll("[data-role]").forEach(element => {
        const elementRole = element.getAttribute("data-role");
        
        if (elementRole === userRole) {
            element.style.display = element.classList.contains("sidebar-item") ? "flex" : "block";
            element.classList.add('role-visible');
        } else {
            element.style.display = "none";
            element.classList.add('role-hidden');
        }
    });
}

function setupRefreshHandlers() {
    // Setup automatic refresh for dashboard data
    const refreshInterval = 5 * 60 * 1000; // 5 minutes
    
    setInterval(() => {
        refreshDashboardData();
    }, refreshInterval);
    
    // Manual refresh button
    const refreshBtn = document.getElementById('refresh-dashboard');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshDashboardData);
    }
}

function refreshDashboardData() {
    const refreshBtn = document.getElementById('refresh-dashboard');
    if (refreshBtn) {
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        refreshBtn.disabled = true;
    }
    
    fetch('/dashboard/api/?action=metrics')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateDashboardMetrics(data.data);
                showRefreshSuccess();
            } else {
                showRefreshError(data.error);
            }
        })
        .catch(error => {
            console.error('Refresh error:', error);
            showRefreshError('Unable to refresh data');
        })
        .finally(() => {
            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
                refreshBtn.disabled = false;
            }
        });
}

function updateDashboardMetrics(data) {
    // Update metric values with animation
    const updates = [
        { id: 'functional-count', value: data.functional_count },
        { id: 'critical-count', value: data.critical_count },
        { id: 'active-count', value: data.active_count },
        { id: 'total-systems', value: data.total_systems },
        { id: 'system-utilization', value: data.system_utilization }
    ];
    
    updates.forEach(update => {
        const element = document.getElementById(update.id);
        if (element) {
            animateNumber(element, parseInt(element.textContent) || 0, update.value);
        }
    });
}

function animateNumber(element, from, to) {
    const duration = 1000;
    const steps = 20;
    const stepValue = (to - from) / steps;
    const stepDuration = duration / steps;
    
    let current = from;
    let step = 0;
    
    const timer = setInterval(() => {
        step++;
        current += stepValue;
        
        if (step >= steps) {
            element.textContent = to;
            clearInterval(timer);
        } else {
            element.textContent = Math.round(current);
        }
    }, stepDuration);
}

function showRefreshSuccess() {
    showToast('Dashboard updated successfully', 'success');
}

function showRefreshError(message) {
    showToast(message, 'error');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');

    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    document.getElementById('toast-container').appendChild(toast);

    const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
    bsToast.show();

    // Optional: remove from DOM after hidden
    toast.addEventListener('hidden.bs.toast', () => toast.remove());
}

function getCsrfToken() {
    return document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export functions for external use
window.dashboardUtils = {
    refreshDashboardData,
    showToast,
    animateNumber
};