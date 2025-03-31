document.addEventListener('DOMContentLoaded', function() {
    // Show/hide custom date range based on time filter selection
    const timeFilter = document.getElementById('timeFilter');
    const customDateRange = document.querySelector('.custom-date-range');
    
    timeFilter.addEventListener('change', function() {
        if (this.value === 'custom') {
            customDateRange.style.display = 'flex';
        } else {
            customDateRange.style.display = 'none';
        }
    });
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const faultCards = document.querySelectorAll('.fault-card');
    const noResultsMessage = document.getElementById('noResultsMessage');
    const resultsCount = document.getElementById('resultsCount');
    
    // Search function
    function performSearch() {
        const searchTerm = searchInput.value.toLowerCase();
        let visibleCount = 0;
        
        faultCards.forEach(card => {
            const hostname = card.querySelector('.hostname').textContent.toLowerCase();
            const location = card.querySelector('.location').textContent.toLowerCase();
            const title = card.querySelector('.fault-title').textContent.toLowerCase();
            const description = card.querySelector('.fault-description').textContent.toLowerCase();
            
            if (hostname.includes(searchTerm) || 
                location.includes(searchTerm) || 
                title.includes(searchTerm) || 
                description.includes(searchTerm)) {
                card.style.display = 'block';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });
        
        // Update results count and show/hide no results message
        if (visibleCount === 0) {
            noResultsMessage.style.display = 'block';
            resultsCount.textContent = 'No fault reports found';
        } else {
            noResultsMessage.style.display = 'none';
            resultsCount.textContent = `Showing ${visibleCount} fault report${visibleCount !== 1 ? 's' : ''}`;
        }
    }
    
    // Event listeners for search
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            performSearch();
        }
    });
    
    // Filter functionality
    const statusFilter = document.getElementById('statusFilter');
    const applyFiltersButton = document.getElementById('applyFilters');
    const resetFiltersButton = document.getElementById('resetFilters');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const sortBySelect = document.getElementById('sortBy');
    
    // Apply filters function
    function applyFilters() {
        const statusValue = statusFilter.value;
        const timeValue = timeFilter.value;
        const sortValue = sortBySelect.value;
        
        let startDate = null;
        let endDate = null;
        
        // Set date range based on selected time filter
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (timeValue === 'custom') {
            startDate = startDateInput.value ? new Date(startDateInput.value) : null;
            endDate = endDateInput.value ? new Date(endDateInput.value) : null;
        } else if (timeValue === 'today') {
            startDate = today;
            endDate = new Date(today);
            endDate.setDate(endDate.getDate() + 1);
        } else if (timeValue === 'week') {
            startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 7);
            endDate = new Date(today);
            endDate.setDate(endDate.getDate() + 1);
        } else if (timeValue === 'month') {
            startDate = new Date(today);
            startDate.setMonth(startDate.getMonth() - 1);
            endDate = new Date(today);
            endDate.setDate(endDate.getDate() + 1);
        }
        
        // Filter cards
        let visibleCount = 0;
        let cardsArray = Array.from(faultCards);
        
        // Sort cards
        if (sortValue === 'newest') {
            cardsArray.sort((a, b) => {
                return new Date(b.dataset.date) - new Date(a.dataset.date);
            });
        } else if (sortValue === 'oldest') {
            cardsArray.sort((a, b) => {
                return new Date(a.dataset.date) - new Date(b.dataset.date);
            });
        } else if (sortValue === 'priority') {
            const priorityOrder = {
                'unaddressed': 0,
                'in-progress': 1,
                'scheduled': 2,
                'resolved': 3,
                'ignored': 4
            };
            
            cardsArray.sort((a, b) => {
                return priorityOrder[a.dataset.status] - priorityOrder[b.dataset.status];
            });
        }
        
        // Reorder DOM elements
        const container = document.getElementById('faultReportsContainer');
        cardsArray.forEach(card => container.appendChild(card));
        
        // Filter cards
        cardsArray.forEach(card => {
            const cardStatus = card.dataset.status;
            const cardDate = new Date(card.dataset.date);
            let showCard = true;
            
            // Filter by status
            if (statusValue !== 'all' && cardStatus !== statusValue) {
                showCard = false;
            }
            
            // Filter by date
            if (showCard && timeValue !== 'all' && (startDate || endDate)) {
                if (startDate && cardDate < startDate) {
                    showCard = false;
                }
                if (endDate && cardDate > endDate) {
                    showCard = false;
                }
            }
            
            // Apply visibility
            if (showCard) {
                card.style.display = 'block';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });
        
        // Update results count and show/hide no results message
        if (visibleCount === 0) {
            noResultsMessage.style.display = 'block';
            resultsCount.textContent = 'No fault reports found';
        } else {
            noResultsMessage.style.display = 'none';
            resultsCount.textContent = `Showing ${visibleCount} fault report${visibleCount !== 1 ? 's' : ''}`;
        }
    }
    
    // Reset filters function
    function resetFilters() {
        searchInput.value = '';
        statusFilter.value = 'all';
        timeFilter.value = 'all';
        sortBySelect.value = 'newest';
        startDateInput.value = '';
        endDateInput.value = '';
        customDateRange.style.display = 'none';
        
        // Show all cards
        faultCards.forEach(card => {
            card.style.display = 'block';
        });
        
        // Update results count
        noResultsMessage.style.display = 'none';
        resultsCount.textContent = `Showing all fault reports (${faultCards.length})`;
    }
    
    // Add event listeners for filter buttons
    applyFiltersButton.addEventListener('click', applyFilters);
    resetFiltersButton.addEventListener('click', resetFilters);
    
    // Status update functionality
    const updateStatusButtons = document.querySelectorAll('.update-status');
    
    updateStatusButtons.forEach(button => {
        button.addEventListener('click', function() {
            const card = this.closest('.fault-card');
            const statusSelect = card.querySelector('.status-selector');
            const statusBadge = card.querySelector('.status-badge');
            const selectedStatus = statusSelect.value;
            
            // Update card data attribute
            card.dataset.status = selectedStatus;
            
            // Update card class
            card.classList.remove('unaddressed', 'in-progress', 'scheduled', 'resolved', 'ignored');
            card.classList.add(selectedStatus);
            
            // Update status badge
            statusBadge.classList.remove('bg-danger', 'bg-warning', 'bg-info', 'bg-success', 'bg-secondary');
            statusBadge.textContent = statusSelect.options[statusSelect.selectedIndex].text;
            
            if (selectedStatus === 'unaddressed') {
                statusBadge.classList.add('bg-danger');
            } else if (selectedStatus === 'in-progress') {
                statusBadge.classList.add('bg-warning', 'text-dark');
            } else if (selectedStatus === 'scheduled') {
                statusBadge.classList.add('bg-info');
            } else if (selectedStatus === 'resolved') {
                statusBadge.classList.add('bg-success');
            } else if (selectedStatus === 'ignored') {
                statusBadge.classList.add('bg-secondary');
            }
            
            // Show success alert (temporary)
            const alertDiv = document.createElement('div');
            alertDiv.classList.add('alert', 'alert-success', 'alert-dismissible', 'fade', 'show', 'position-fixed', 'top-0', 'start-50', 'translate-middle-x', 'mt-3');
            alertDiv.setAttribute('role', 'alert');
            alertDiv.innerHTML = `
                <strong>Success!</strong> Status updated to ${statusSelect.options[statusSelect.selectedIndex].text}.
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            document.body.appendChild(alertDiv);
            
            // Remove alert after 3 seconds
            setTimeout(() => {
                alertDiv.classList.remove('show');
                setTimeout(() => alertDiv.remove(), 150);
            }, 3000);
        });
    });
    
    // New fault report submission
    const submitFaultButton = document.getElementById('submitFault');
    const newFaultForm = document.getElementById('newFaultForm');
    const newFaultModal = document.getElementById('newFaultModal');
    const modalInstance = bootstrap.Modal.getInstance(newFaultModal);
    
    submitFaultButton.addEventListener('click', function() {
        // Check form validity
        if (newFaultForm.checkValidity()) {
            // Get form values
            const hostname = document.getElementById('hostname').value;
            const location = document.getElementById('location').value;
            const faultTitle = document.getElementById('faultTitle').value;
            const faultDescription = document.getElementById('faultDescription').value;
            const reporterName = document.getElementById('reporterName').value;
            const priorityLevel = document.getElementById('priorityLevel').value;
            
            // Create new fault card
            const now = new Date();
            const formattedDate = now.toLocaleString('en-US', { 
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            
            const newCard = document.createElement('div');
            newCard.className = 'fault-card unaddressed';
            newCard.dataset.status = 'unaddressed';
            newCard.dataset.date = now.toISOString();
            
            newCard.innerHTML = `
                <div class="row g-0">
                    <div class="col-md-1 d-flex align-items-center justify-content-center">
                        <i class="fas fa-desktop computer-icon"></i>
                    </div>
                    <div class="col-md-11">
                        <div class="fault-details">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <div>
                                    <div class="hostname">${hostname}</div>
                                    <div class="location"><i class="fas fa-map-marker-alt me-1"></i>${location}</div>
                                </div>
                                <span class="badge bg-danger status-badge">Unaddressed</span>
                            </div>
                            <h5 class="fault-title">${faultTitle}</h5>
                            <p class="fault-description">${faultDescription}</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="timestamp"><i class="far fa-clock me-1"></i>Reported: ${formattedDate}</span>
                                <div class="d-flex">
                                    <select class="status-selector me-2">
                                        <option value="unaddressed" selected>Unaddressed</option>
                                        <option value="in-progress">In Progress</option>
                                        <option value="scheduled">Scheduled for Later</option>
                                        <option value="resolved">Resolved</option>
                                        <option value="ignored">Ignored - Not Actionable</option>
                                    </select>
                                    <button class="btn btn-sm btn-outline-primary update-status">Update</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Add new fault card to container
            const container = document.getElementById('faultReportsContainer');
            container.insertBefore(newCard, container.firstChild);
            
            // Update fault count
            resultsCount.textContent = `Showing all fault reports (${faultCards.length + 1})`;
            
            // Reset form
            newFaultForm.reset();
            
            // Close modal
            const bsModal = bootstrap.Modal.getInstance(newFaultModal);
            bsModal.hide();
            
            // Add event listener to new update status button
            const newUpdateButton = newCard.querySelector('.update-status');
            newUpdateButton.addEventListener('click', function() {
                const card = this.closest('.fault-card');
                const statusSelect = card.querySelector('.status-selector');
                const statusBadge = card.querySelector('.status-badge');
                const selectedStatus = statusSelect.value;
                
                // Update card data attribute
                card.dataset.status = selectedStatus;
                
                // Update card class
                card.classList.remove('unaddressed', 'in-progress', 'scheduled', 'resolved', 'ignored');
                card.classList.add(selectedStatus);
                
                // Update status badge
                statusBadge.classList.remove('bg-danger', 'bg-warning', 'bg-info', 'bg-success', 'bg-secondary');
                statusBadge.textContent = statusSelect.options[statusSelect.selectedIndex].text;
                
                if (selectedStatus === 'unaddressed') {
                    statusBadge.classList.add('bg-danger');
                } else if (selectedStatus === 'in-progress') {
                    statusBadge.classList.add('bg-warning', 'text-dark');
                } else if (selectedStatus === 'scheduled') {
                    statusBadge.classList.add('bg-info');
                } else if (selectedStatus === 'resolved') {
                    statusBadge.classList.add('bg-success');
                } else if (selectedStatus === 'ignored') {
                    statusBadge.classList.add('bg-secondary');
                }
                
                // Show success alert
                const alertDiv = document.createElement('div');
                alertDiv.classList.add('alert', 'alert-success', 'alert-dismissible', 'fade', 'show', 'position-fixed', 'top-0', 'start-50', 'translate-middle-x', 'mt-3');
                alertDiv.setAttribute('role', 'alert');
                alertDiv.innerHTML = `
                    <strong>Success!</strong> Status updated to ${statusSelect.options[statusSelect.selectedIndex].text}.
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                `;
                document.body.appendChild(alertDiv);
                
                // Remove alert after 3 seconds
                setTimeout(() => {
                    alertDiv.classList.remove('show');
                    setTimeout(() => alertDiv.remove(), 150);
                }, 3000);
            });
            
            // Show success message
            const alertDiv = document.createElement('div');
            alertDiv.classList.add('alert', 'alert-success', 'alert-dismissible', 'fade', 'show', 'position-fixed', 'top-0', 'start-50', 'translate-middle-x', 'mt-3');
            alertDiv.setAttribute('role', 'alert');
            alertDiv.innerHTML = `
                <strong>Success!</strong> New fault report created.
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            document.body.appendChild(alertDiv);
            
            // Remove alert after 3 seconds
            setTimeout(() => {
                alertDiv.classList.remove('show');
                setTimeout(() => alertDiv.remove(), 150);
            }, 3000);
        } else {
            // Trigger browser's form validation
            const firstInvalid = newFaultForm.querySelector(':invalid');
            if (firstInvalid) {
                firstInvalid.focus();
            }
        }
    });
    
    // Initialize tooltips and popovers if needed
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Initialize pagination
    const paginationLinks = document.querySelectorAll('.pagination .page-link');
    paginationLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            // Pagination logic would go here in a real application
            // For this demo, just highlight the clicked page
            document.querySelector('.page-item.active').classList.remove('active');
            this.closest('.page-item').classList.add('active');
        });
    });
});