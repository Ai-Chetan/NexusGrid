document.addEventListener("DOMContentLoaded", function () {

    // Ensure Plotly is loaded
    if (typeof Plotly === "undefined") {
        console.error("Plotly.js is not loaded.");
        return;
    }

    // Performance Overview (Bar Chart)
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

    // Fault Trend Over Time (Line Chart)
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

    // Fault Distribution by Type (Pie Chart)
    Plotly.newPlot("faultDistributionChart", [{
        labels: ['Hardware', 'Software', 'Network', 'Other'],
        values: [30, 45, 15, 10],
        type: 'pie'
    }], {
        title: { text: 'Fault Distribution' },
        margin: { t: 50 }
    });

    // Resource Requests vs Time (Scatter Plot)
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

    /* Roles based Dashboard */
    var userRole = document.body.getAttribute("data-user-role")?.trim() || "";

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
});
