document.addEventListener('DOMContentLoaded', function() {
    // Update modals with lab ID when opening
    document.querySelectorAll('[data-bs-target="#addInchargeModal"]').forEach(button => {
        button.addEventListener('click', function() {
            document.getElementById('inchargeLabId').value = this.getAttribute('data-lab-id');
        });
    });

    document.querySelectorAll('[data-bs-target="#addAssistantModal"]').forEach(button => {
        button.addEventListener('click', function() {
            document.getElementById('assistantLabId').value = this.getAttribute('data-lab-id');
        });
    });

    document.querySelectorAll('[data-bs-target="#deleteLabModal"]').forEach(button => {
        button.addEventListener('click', function() {
            document.getElementById('deleteLabId').value = this.getAttribute('data-lab-id');
        });
    });

    // Settings form handling
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const maxLabs = document.getElementById('maxLabsPerAssistant').value;
            // Update the display in the assistant modal
            document.getElementById('maxLabsDisplay').textContent = maxLabs;
            
            // Send settings to server (AJAX call would go here)
            fetch('{% url "update_settings" %}', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': '{{ csrf_token }}'
                },
                body: JSON.stringify({
                    max_labs_per_assistant: maxLabs
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Settings updated successfully!');
                } else {
                    alert('Failed to update settings.');
                }
            });
        });
    }

    // Search functionality
    const searchInput = document.getElementById('searchLabs');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            document.querySelectorAll('.lab-card').forEach(card => {
                const labName = card.querySelector('.card-header h5').textContent.toLowerCase();
                const isVisible = labName.includes(searchTerm);
                card.closest('.col-md-6').style.display = isVisible ? '' : 'none';
            });
        });
    }

    // Remove member buttons
    document.querySelectorAll('.remove-member').forEach(button => {
        button.addEventListener('click', function() {
            const labId = this.getAttribute('data-lab-id');
            const userId = this.getAttribute('data-user-id');
            const role = this.getAttribute('data-role');
            
            if (confirm('Are you sure you want to remove this member?')) {
                // AJAX call to remove member
                fetch('{% url "remove_lab_member" %}', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': '{{ csrf_token }}'
                    },
                    body: JSON.stringify({
                        lab_name: labId,
                        user_id: userId,
                        role: role
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Remove the list item from DOM
                        this.closest('li').remove();
                    } else {
                        alert('Failed to remove member.');
                    }
                });
            }
        });
    });

    // Check lab assistant count when selecting in dropdown
    const assistantSelect = document.getElementById('selectAssistant');
    if (assistantSelect) {
        assistantSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const warning = document.getElementById('labAssistantWarning');
            const maxLabs = parseInt(document.getElementById('maxLabsPerAssistant').value);
            
            // Check if this contains info about current assignments
            if (selectedOption.textContent.includes('Currently assigned to')) {
                const matches = selectedOption.textContent.match(/Currently assigned to (\d+) lab/);
                if (matches && matches[1]) {
                    const currentLabCount = parseInt(matches[1]);
                    if (currentLabCount >= maxLabs) {
                        warning.classList.remove('d-none');
                    } else {
                        warning.classList.add('d-none');
                    }
                }
            } else {
                warning.classList.add('d-none');
            }
        });
    }

    // Add member form
    const addMemberForm = document.getElementById('addMemberForm');
    if (addMemberForm) {
        addMemberForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('memberEmail').value;
            const name = document.getElementById('memberName').value;
            const role = document.getElementById('memberRole').value;
            
            // Send data to server
            fetch('{% url "add_member" %}', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': '{{ csrf_token }}'
                },
                body: JSON.stringify({
                    email: email,
                    name: name,
                    role: role
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Member added successfully!');
                    addMemberForm.reset();
                    // Reload page to see changes
                    location.reload();
                } else {
                    alert('Failed to add member: ' + data.error);
                }
            });
        });
    }
});