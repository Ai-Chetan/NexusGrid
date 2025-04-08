document.addEventListener('DOMContentLoaded', function () {
    initializeUserRoleVisibility();
    initializeDateFilterToggle();
    initializeSearch();
    initializeFilterControls();
    initializeStatusUpdate();
    initializeNewRequestSubmission();
    initializeTooltips();
    initializePagination();
});

// Role-based visibility
function initializeUserRoleVisibility() {
    const userRole = document.body.getAttribute("data-user-role")?.trim();

    if (userRole) {
        document.querySelectorAll("[data-role]").forEach(el => {
            el.style.display = (el.getAttribute("data-role") === userRole) ?
                (el.closest(".sidebar") ? "flex" : "block") : "none";
        });
    } else {
        console.warn("User role is missing!");
    }
}

// Show/hide custom date range
function initializeDateFilterToggle() {
    const timeFilter = document.getElementById('timeFilter');
    const customDateRange = document.querySelector('.custom-date-range');

    if (timeFilter && customDateRange) {
        timeFilter.addEventListener('change', function () {
            customDateRange.style.display = (this.value === 'custom') ? 'flex' : 'none';
        });
    }
}

// Search functionality
function initializeSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');

    if (searchInput && searchButton) {
        searchButton.addEventListener('click', performSearch);
        searchInput.addEventListener('keyup', function (event) {
            if (event.key === 'Enter') performSearch();
        });
    }
}

function performSearch() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const resourceCards = document.querySelectorAll('.resource-card');
    const noResultsMessage = document.getElementById('noResultsMessage');
    const resultsCount = document.getElementById('resultsCount');

    let visibleCount = 0;

    resourceCards.forEach(card => {
        // Search through all text content in the card
        const text = card.textContent.toLowerCase();
        const match = text.includes(searchTerm);
        card.style.display = match ? 'block' : 'none';
        if (match) visibleCount++;
    });

    if (noResultsMessage) {
        noResultsMessage.style.display = visibleCount === 0 ? 'block' : 'none';
    }
    
    if (resultsCount) {
        resultsCount.textContent = visibleCount === 0
            ? 'No resource requests found'
            : `Showing ${visibleCount} resource request${visibleCount !== 1 ? 's' : ''}`;
    }
}

// Filter and sort controls
function initializeFilterControls() {
    const applyButton = document.getElementById('applyFilters');
    const resetButton = document.getElementById('resetFilters');
    
    if (applyButton) {
        applyButton.addEventListener('click', applyFilters);
    }
    
    if (resetButton) {
        resetButton.addEventListener('click', resetFilters);
    }
}

function applyFilters() {
    const cards = Array.from(document.querySelectorAll('.resource-card'));
    const status = document.getElementById('statusFilter').value;
    const time = document.getElementById('timeFilter').value;
    const sortBy = document.getElementById('sortBy').value;

    let [start, end] = getDateRange(time);
    sortCards(cards, sortBy);

    let visibleCount = 0;
    cards.forEach(card => {
        const cardStatus = card.dataset.status;
        const cardDate = new Date(card.dataset.date);
        let show = true;

        if (status !== 'all' && cardStatus !== status.toLowerCase()) show = false;
        if (show && time !== 'all' && (start || end)) {
            if (start && cardDate < start) show = false;
            if (end && cardDate > end) show = false;
        }

        card.style.display = show ? 'block' : 'none';
        if (show) visibleCount++;
    });

    const resultsCount = document.getElementById('resultsCount');
    const noResultsMessage = document.getElementById('noResultsMessage');
    
    if (noResultsMessage) {
        noResultsMessage.style.display = visibleCount === 0 ? 'block' : 'none';
    }
    
    if (resultsCount) {
        resultsCount.textContent = visibleCount === 0
            ? 'No resource requests found'
            : `Showing ${visibleCount} resource request${visibleCount !== 1 ? 's' : ''}`;
    }
}

function resetFilters() {
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const timeFilter = document.getElementById('timeFilter');
    const sortBy = document.getElementById('sortBy');
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    const customDateRange = document.querySelector('.custom-date-range');
    
    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = 'all';
    if (timeFilter) timeFilter.value = 'all';
    if (sortBy) sortBy.value = 'newest';
    if (startDate) startDate.value = '';
    if (endDate) endDate.value = '';
    if (customDateRange) customDateRange.style.display = 'none';

    const cards = document.querySelectorAll('.resource-card');
    cards.forEach(card => card.style.display = 'block');

    const noResultsMessage = document.getElementById('noResultsMessage');
    const resultsCount = document.getElementById('resultsCount');
    
    if (noResultsMessage) {
        noResultsMessage.style.display = 'none';
    }
    
    if (resultsCount) {
        resultsCount.textContent = `Showing all resource requests (${cards.length})`;
    }
}

function getDateRange(filter) {
    const today = new Date();
    const startDateInput = document.getElementById('startDate')?.value;
    const endDateInput = document.getElementById('endDate')?.value;

    switch (filter) {
        case 'today':
            return [new Date(today.setHours(0,0,0,0)), new Date(today.setHours(23,59,59,999))];
        case 'week':
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - 7);
            weekStart.setHours(0,0,0,0);
            return [weekStart, new Date()];
        case 'month':
            const monthStart = new Date(today);
            monthStart.setMonth(today.getMonth() - 1);
            monthStart.setHours(0,0,0,0);
            return [monthStart, new Date()];
        case 'custom':
            return [startDateInput ? new Date(startDateInput) : null, endDateInput ? new Date(endDateInput) : null];
        default:
            return [null, null];
    }
}

function sortCards(cards, method) {
    const container = document.getElementById('requestsContainer');
    
    if (!container) return;

    if (method === 'priority') {
        const order = { 'pending': 0, 'in progress': 1, 'approved': 2, 'fulfilled': 3, 'denied': 4 };
        cards.sort((a, b) => order[a.dataset.status] - order[b.dataset.status]);
    } else {
        const compare = (a, b) => new Date(a.dataset.date) - new Date(b.dataset.date);
        cards.sort(method === 'oldest' ? compare : (a, b) => compare(b, a));
    }

    cards.forEach(card => container.appendChild(card));
}

// Status update logic
function initializeStatusUpdate() {
    // Watch for any form submissions for status updates
    document.addEventListener('submit', function(e) {
        const form = e.target;
        if (form.action && form.action.includes('update_resource_status')) {
            e.preventDefault();
            const resourceCard = form.closest('.resource-card');
            const statusSelect = form.querySelector('select[name="status"]');
            
            if (resourceCard && statusSelect) {
                updateCardStatus(resourceCard, statusSelect.value);
                
                // If you want to also submit the form via AJAX, you can add that code here
                showAlert(`Status updated to ${statusSelect.value}.`);
            }
        }
    });
}

function updateCardStatus(card, newStatus) {
    if (!card) return;
    
    const statusBadge = card.querySelector('.status-badge');
    if (!statusBadge) return;

    const statusLower = newStatus.toLowerCase();
    const statusClass = statusLower.replace(/\s+/g, '-'); // e.g., "in-progress"

    console.log("Updating status to:", newStatus);
    console.log("Normalized class name:", statusClass);

    // Update card dataset
    card.dataset.status = statusLower;

    // Remove all status-related styling classes
    const statusClasses = ['pending', 'in-progress', 'approved', 'fulfilled', 'denied'];
    card.classList.remove(...statusClasses);

    // Add the new class
    card.classList.add(statusClass);

    console.log("Updated card classes:", card.className);

    // Update the badge text
    statusBadge.textContent = newStatus;

    // Apply appropriate badge class
    const badgeClasses = {
        'Pending': 'bg-warning',
        'In Progress': 'bg-info',
        'Approved': 'bg-success',
        'Fulfilled': 'bg-success',
        'Denied': 'bg-secondary'
    };

    statusBadge.className = `badge status-badge ${badgeClasses[newStatus] || ''}`;
}

// New request submission
function initializeNewRequestSubmission() {
    const submitButton = document.getElementById('submitRequest');
    
    if (submitButton) {
        submitButton.addEventListener('click', function() {
            const form = document.getElementById('newRequestForm');
            
            if (form && form.checkValidity()) {
                // Here you would normally submit the form data via AJAX
                // For now, we'll just show a success message
                
                // Reset form and close modal
                form.reset();
                const modal = document.getElementById('newRequestModal');
                if (modal && typeof bootstrap !== 'undefined') {
                    const modalInstance = bootstrap.Modal.getInstance(modal);
                    if (modalInstance) modalInstance.hide();
                }
                
                showAlert("New resource request submitted.");
            } else if (form) {
                // Trigger validation UI
                form.reportValidity();
            }
        });
    }
}

// Helper: alert display
function showAlert(message) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-success alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
    alert.style.zIndex = '9999';
    alert.setAttribute('role', 'alert');
    alert.innerHTML = `
        <strong>Success!</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    document.body.appendChild(alert);
    
    // Auto dismiss after 3 seconds
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => alert.remove(), 150);
    }, 3000);
    
    // Also allow manual dismissal
    alert.querySelector('.btn-close').addEventListener('click', function() {
        alert.classList.remove('show');
        setTimeout(() => alert.remove(), 150);
    });
}

// Tooltips
function initializeTooltips() {
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
        const tooltips = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltips.map(el => new bootstrap.Tooltip(el));
    }
}

// Pagination simulation
function initializePagination() {
    document.querySelectorAll('.pagination .page-link').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const active = document.querySelector('.page-item.active');
            if (active) active.classList.remove('active');
            this.closest('.page-item').classList.add('active');
        });
    });
}

// Helper: update count
function updateResultsCount() {
    const cards = document.querySelectorAll('.resource-card');
    const visibleCards = Array.from(cards).filter(card => card.style.display !== 'none');
    const resultsCount = document.getElementById('resultsCount');
    
    if (resultsCount) {
        resultsCount.textContent = `Showing all resource requests (${visibleCards.length})`;
    }
}