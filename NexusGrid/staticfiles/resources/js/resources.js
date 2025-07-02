document.addEventListener('DOMContentLoaded', function () {
    // Elements
    const timeFilter = document.getElementById('timeFilter');
    const customDateRange = document.querySelector('.custom-date-range');
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const statusFilter = document.getElementById('statusFilter');
    const sortBy = document.getElementById('sortBy');
    const applyFilters = document.getElementById('applyFilters');
    const resetFilters = document.getElementById('resetFilters');
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    const requestsContainer = document.getElementById('requestsContainer');
    const noResultsMessage = document.getElementById('noResultsMessage');
    const resultsCount = document.getElementById('resultsCount');

    // Show/hide custom date range
    if (timeFilter && customDateRange) {
        timeFilter.addEventListener('change', function () {
            customDateRange.style.display = this.value === 'custom' ? 'flex' : 'none';
        });
    }

    // Search
    if (searchButton && searchInput) {
        searchButton.addEventListener('click', performSearch);
        searchInput.addEventListener('keyup', function (event) {
            if (event.key === 'Enter') performSearch();
        });
    }

    function performSearch() {
        applyFiltersFunc();
    }

    // Filter controls
    if (applyFilters) applyFilters.addEventListener('click', applyFiltersFunc);
    if (resetFilters) resetFilters.addEventListener('click', resetFiltersFunc);

    function applyFiltersFunc() {
        const cards = Array.from(document.querySelectorAll('.resource-card'));
        const statusVal = statusFilter.value;
        const timeVal = timeFilter.value;
        const sortVal = sortBy.value;
        const searchVal = searchInput.value.trim().toLowerCase();

        let [start, end] = getDateRange(timeVal);

        // Sort
        sortCards(cards, sortVal);

        let visibleCount = 0;
        cards.forEach(card => {
            let show = true;
            // Status
            if (statusVal !== 'all' && card.dataset.status !== statusVal.toLowerCase()) show = false;
            // Date
            if (show && start && end) {
                const date = new Date(card.dataset.date);
                if (date < start || date > end) show = false;
            }
            // Search
            if (show && searchVal) {
                const text = card.innerText.toLowerCase();
                if (!text.includes(searchVal)) show = false;
            }
            card.style.display = show ? 'block' : 'none';
            if (show) visibleCount++;
        });

        if (noResultsMessage) noResultsMessage.style.display = visibleCount === 0 ? 'block' : 'none';
        if (resultsCount) resultsCount.textContent = visibleCount === 0
            ? "No resource requests found"
            : `Showing ${visibleCount} resource request${visibleCount > 1 ? 's' : ''}`;
    }

    function resetFiltersFunc() {
        if (searchInput) searchInput.value = '';
        if (statusFilter) statusFilter.value = 'all';
        if (timeFilter) timeFilter.value = 'all';
        if (sortBy) sortBy.value = 'newest';
        if (startDate) startDate.value = '';
        if (endDate) endDate.value = '';
        if (customDateRange) customDateRange.style.display = 'none';

        const cards = document.querySelectorAll('.resource-card');
        cards.forEach(card => card.style.display = 'block');
        if (noResultsMessage) noResultsMessage.style.display = 'none';
        if (resultsCount) resultsCount.textContent = `Showing ${cards.length} resource request${cards.length > 1 ? 's' : ''}`;
    }

    function getDateRange(filter) {
        const today = new Date();
        let start = null, end = null;
        if (filter === 'today') {
            start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        } else if (filter === 'week') {
            const day = today.getDay();
            start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - day);
            end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (6 - day) + 1);
        } else if (filter === 'month') {
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        } else if (filter === 'custom' && startDate && endDate) {
            start = startDate.value ? new Date(startDate.value) : null;
            end = endDate.value ? new Date(endDate.value) : null;
            if (end) end.setDate(end.getDate() + 1); // include end date
        }
        return [start, end];
    }

    function sortCards(cards, method) {
        if (!requestsContainer) return;
        if (method === 'priority') {
            // Example: Pending > In Progress > Approved > Fulfilled > Denied
            const order = ['pending', 'in-progress', 'approved', 'fulfilled', 'denied'];
            cards.sort((a, b) => order.indexOf(a.dataset.status) - order.indexOf(b.dataset.status));
        } else if (method === 'oldest') {
            cards.sort((a, b) => new Date(a.dataset.date) - new Date(b.dataset.date));
        } else {
            cards.sort((a, b) => new Date(b.dataset.date) - new Date(a.dataset.date));
        }
        cards.forEach(card => requestsContainer.appendChild(card));
    }

    // Modal submission (AJAX example, adapt as needed)
    const submitRequestBtn = document.getElementById('submitRequest');
    if (submitRequestBtn) {
        submitRequestBtn.addEventListener('click', function () {
            const systemName = document.getElementById('systemName').value.trim();
            const resourceType = document.getElementById('resourceType').value;
            const description = document.getElementById('requestDescription').value.trim();
            if (!systemName || !resourceType || !description) {
                alert('Please fill all required fields.');
                return;
            }
            // Submit via AJAX
            fetch('/resources/create/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken'),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({system_name: systemName, resource_type: resourceType, description: description})
            }).then(res => res.json()).then(data => {
                if (data.success) location.reload();
                else alert(data.message || 'Failed to submit request.');
            });
        });
    }

    // Helper to get CSRF token
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
});