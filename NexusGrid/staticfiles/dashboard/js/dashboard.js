document.addEventListener("DOMContentLoaded", function () {
    // Performance Overview (Bar Chart)
    Plotly.newPlot("performanceChart", [{
        x: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
        y: [10, 15, 7, 20, 13],
        type: 'bar',
        marker: { color: '#007bff' }
    }], { title: 'Monthly Performance', xaxis: { title: 'Month' }, yaxis: { title: 'Value' } });

    // Fault Trend Over Time (Line Chart)
    Plotly.newPlot("faultTrendChart", [{
        x: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
        y: [2, 5, 8, 3, 6],
        type: 'scatter',
        mode: 'lines+markers',
        marker: { color: 'red' }
    }], { title: 'Fault Reports Over Time', xaxis: { title: 'Month' }, yaxis: { title: 'Faults' } });

    // Fault Distribution by Type (Pie Chart)
    Plotly.newPlot("faultDistributionChart", [{
        labels: ['Hardware', 'Software', 'Network', 'Other'],
        values: [30, 45, 15, 10],
        type: 'pie'
    }], { title: 'Fault Distribution' });

    // Resource Requests vs Time (Scatter Plot)
    Plotly.newPlot("resourceRequestChart", [{
        x: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
        y: [5, 8, 12, 7, 10],
        mode: 'markers',
        marker: { color: 'green', size: 10 }
    }], { title: 'Resource Requests Trend', xaxis: { title: 'Month' }, yaxis: { title: 'Requests' } });
});

document.addEventListener("DOMContentLoaded", function () {
    function throttle(func, limit) {
        let lastFunc;
        let lastRan;
        return function () {
            const context = this, args = arguments;
            if (!lastRan) {
                func.apply(context, args);
                lastRan = Date.now();
            } else {
                clearTimeout(lastFunc);
                lastFunc = setTimeout(function () {
                    if ((Date.now() - lastRan) >= limit) {
                        func.apply(context, args);
                        lastRan = Date.now();
                    }
                }, limit - (Date.now() - lastRan));
            }
        };
    }

    const resizeGraphs = throttle(() => {
        requestAnimationFrame(() => {
            ['performanceChart', 'faultTrendChart', 'faultDistributionChart', 'resourceRequestChart'].forEach(id => {
                let chart = document.getElementById(id);
                if (chart) Plotly.Plots.resize(chart);
            });
        });
    }, 50);

    window.addEventListener('resize', resizeGraphs);

    let sidebar = document.querySelector('.sidebar');
    let content = document.querySelector('.content');

    if (sidebar && content) {
        const observer = new ResizeObserver(resizeGraphs);
        observer.observe(sidebar);
    }
});
