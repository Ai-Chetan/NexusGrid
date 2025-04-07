document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const layoutGrid = document.getElementById('layout');
    const editLayoutButton = document.getElementById('editLayoutButton');
    const backButton = document.getElementById('backButton');
    const layoutControls = document.getElementById('layoutControls');
    const editControls = document.getElementById('editControls');
    const addBlockButton = document.getElementById('addBlockButton');
    const removeBlockButton = document.getElementById('removeBlockButton');
    const resetLayoutButton = document.getElementById('resetLayoutButton');
    const saveLayoutButton = document.getElementById('saveLayoutButton');
    const cancelEditButton = document.getElementById('cancelEditButton');
    
    // Bootstrap Modals
    const renameModal = new bootstrap.Modal(document.getElementById('renameModal'));
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmButton = document.getElementById('confirmButton');
    const saveNameButton = document.getElementById('saveNameButton');
    
    // State
    let layoutItems = [];
    let originalLayout = []; // Store original layout for reset functionality
    let selectedItem = null;
    let editMode = false;
    let hasChanges = false;
    let isDragging = false;
    let draggedItem = null;
    
    // Item type definitions with size and icon mappings
    const itemTypes = {
        'building': { icon: 'fa-building', sizeX: 3, sizeY: 3 },
        'floor': { icon: 'fa-layer-group', sizeX: 6, sizeY: 1 },
        'room': { icon: 'fa-door-open', sizeX: 1, sizeY: 2 },
        'computer': { icon: 'fa-desktop', sizeX: 1, sizeY: 1 },
        'server': { icon: 'fa-server', sizeX: 1, sizeY: 1 },
        'network_switch': { icon: 'fa-network-wired', sizeX: 1, sizeY: 1 },
        'router': { icon: 'fa-wifi', sizeX: 1, sizeY: 1 },
        'printer': { icon: 'fa-print', sizeX: 1, sizeY: 1 },
        'ups': { icon: 'fa-plug', sizeX: 1, sizeY: 1 },
        'rack': { icon: 'fa-hdd', sizeX: 1, sizeY: 1 }
    };

   // Get the user's role from the body attribute
    var userRole = document.body.getAttribute("data-user-role")?.trim();

    if (userRole) {
        document.querySelectorAll("[data-role]").forEach(el => {
            el.style.display = (el.getAttribute("data-role") === userRole) ? 
                (el.closest(".sidebar") ? "flex" : "block") : "none";
        });
    } else {
        console.warn("User role is missing!");
    }

    // Initialize
    init();
    
    // Main initialization function
    function init() {
        fetchLayoutItems();
        setupEventListeners();
        
        // Initial state
        removeBlockButton.disabled = true;
    }
     
    function getCSRFToken() {
        const csrfToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1];
        return csrfToken || '';
    }
    
    // Fetch layout items from server
    function fetchLayoutItems() {
        fetch(`/layout/get_layout_items/?parent_id=${PARENT_ID}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                layoutItems = data.items;
                // Store server state for reset functionality
                originalLayout = JSON.parse(JSON.stringify(layoutItems));
                renderLayout();
            })
            .catch(error => {
                console.error('Error fetching layout items:', error);
                showError('Failed to load layout items');
            });
    }
    
    // Render layout grid
    function renderLayout() {
        layoutGrid.innerHTML = '';
        
        layoutItems.forEach(item => {
            const itemElement = createItemElement(item);
            layoutGrid.appendChild(itemElement);
        });
    }
    
    // Create DOM element for a layout item
    function createItemElement(item) {
        const itemElement = document.createElement('div');
    
        // Default extra class is empty
        let extraClass = '';
    
        // If it's a computer and has a status, add status as a class
        if (item.item_type === 'computer' && item.status) {
            extraClass = ` ${item.status}`;  // e.g. ' active', ' non-functional'
        }
    
        // Set the class name with item type and optional status
        itemElement.className = `layout-item item-${item.item_type}${extraClass}`;
        itemElement.dataset.id = item.id;
        itemElement.dataset.type = item.item_type;
    
        // Grid positioning
        itemElement.style.gridColumn = `${item.position_x + 1} / span ${item.width}`;
        itemElement.style.gridRow = `${item.position_y + 1} / span ${item.height}`;
    
        // Get icon info
        const typeInfo = itemTypes[item.item_type] || { icon: 'fa-question' };
    
        // Set inner HTML
        itemElement.innerHTML = `
            <div class="item-icon"><i class="fas ${typeInfo.icon}"></i></div>
            <div class="item-name">${item.name}</div>
            <div class="item-type">${formatType(item.item_type)}</div>
        `;
    
        return itemElement;
    }
    
    // Format type string for display
    function formatType(type) {
        return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    // Set up all event listeners
    function setupEventListeners() {
        // Layout item click
        layoutGrid.addEventListener('click', function(e) {
            const itemElement = e.target.closest('.layout-item');
            if (!itemElement) return;
            
            const itemId = itemElement.dataset.id;
            const itemType = itemElement.dataset.type;
        
            if (editMode) {
                // In edit mode, select the item
                selectItem(itemElement);
                console.log('Item selected, remove button state:', removeBlockButton.disabled);
            } else {
                // In view mode, navigate to the appropriate page based on item type
                if (itemType === 'computer') {
                    // For computers, navigate to blank.html
                    window.location.href = `/layout/details/${itemId}/`;
                } else {
                    // For all other items, navigate to the layout page
                    window.location.href = `/layout/${itemId}/`;
                }
            }
        });
        
        // Double click to rename
        layoutGrid.addEventListener('dblclick', function(e) {
            if (!editMode) return;
            
            const itemElement = e.target.closest('.layout-item');
            if (!itemElement) return;
            
            const itemId = itemElement.dataset.id;
            const item = layoutItems.find(i => i.id == itemId);
            
            if (item) {
                document.getElementById('itemId').value = itemId;
                document.getElementById('itemName').value = item.name;
                renameModal.show();
            }
        });
        
        // Edit Layout Button
        editLayoutButton.addEventListener('click', enterEditMode);
        
        // Back Button
        backButton.addEventListener('click', navigateToParent);
        
        // Add Item Dropdown
        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                const itemType = this.dataset.type;
                addNewItem(itemType);
            });
        });
        
        // Remove Block Button
        removeBlockButton.addEventListener('click', function() {
            if (selectedItem) {
                showConfirmation(
                    'Confirm Deletion',
                    'Are you sure you want to remove this item? This action cannot be undone and will remove all child items as well.',
                    function() {
                        deleteItem(selectedItem.dataset.id);
                    }
                );
            }
        });
        
        // Reset Layout Button
        resetLayoutButton.addEventListener('click', function() {
            showConfirmation(
                'Reset Layout',
                'Are you sure you want to reset the layout? Your changes will be lost.',
                function() {
                    // Restore from original server layout
                    layoutItems = JSON.parse(JSON.stringify(originalLayout));
                    renderLayout();
                    hasChanges = false;
                }
            );
        });
        
        // Save Layout Button
        saveLayoutButton.addEventListener('click', saveLayout);
        
        // Cancel Edit Button
        cancelEditButton.addEventListener('click', function() {
            if (hasChanges) {
                showConfirmation(
                    'Discard Changes',
                    'You have unsaved changes. Are you sure you want to exit edit mode without saving?',
                    function() {
                        exitEditMode();
                    }
                );
            } else {
                exitEditMode();
            }
        });
        
        // Rename Modal Save Button
        saveNameButton.addEventListener('click', function() {
            const itemId = document.getElementById('itemId').value;
            const newName = document.getElementById('itemName').value;
            
            if (newName.trim()) {
                renameItem(itemId, newName);
                renameModal.hide();
            }
        });
        
        // Detect page unload with unsaved changes
        window.addEventListener('beforeunload', function(e) {
            if (editMode && hasChanges) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        });
        
        // Set up drag and drop functionality
        setupDragAndDrop();
    }
    
    // Navigate to parent layout
    function navigateToParent() {
        if (PARENT_ID && PARENT_ID !== 'null') {
            // Get parent of current parent
            fetch(`/layout/get_parent/?item_id=${PARENT_ID}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.parent_id) {
                        window.location.href = `/layout/${data.parent_id}/`;
                    } else {
                        window.location.href = '/layout/';
                    }
                })
                .catch(() => {
                    // Fallback to root
                    window.location.href = '/layout/';
                });
        }
    }
    
    // Set up drag and drop behavior
    function setupDragAndDrop() {
        let startX, startY;
        let startPosX, startPosY;
        
        // Calculate grid dimensions
        function getGridDimensions() {
            const gridRect = layoutGrid.getBoundingClientRect();
            const cellWidth = gridRect.width / 12; // 12 columns
            const cellHeight = gridRect.height / Math.max(10, getMaxGridHeight()); // Dynamic height based on content
            return { cellWidth, cellHeight, gridRect };
        }
        
        // Get maximum grid height used by items
        function getMaxGridHeight() {
            let maxY = 0;
            layoutItems.forEach(item => {
                const bottomY = item.position_y + item.height;
                if (bottomY > maxY) maxY = bottomY;
            });
            return Math.max(10, maxY); // Minimum 10 rows
        }
        
        // Mouse down event to start dragging
        layoutGrid.addEventListener('mousedown', function(e) {
            if (!editMode) return;
            
            const itemElement = e.target.closest('.layout-item');
            if (!itemElement) return;
            
            // Select the item first
            selectItem(itemElement);
            
            // Start dragging
            draggedItem = itemElement;
            isDragging = true;
            
            // Remember initial cursor position
            startX = e.clientX;
            startY = e.clientY;
            
            // Remember initial item position
            const item = layoutItems.find(i => i.id == draggedItem.dataset.id);
            startPosX = item.position_x;
            startPosY = item.position_y;
            
            // Add dragging class
            draggedItem.classList.add('dragging');
            
            // Prevent text selection during drag
            e.preventDefault();
        });
        
        // Mouse move event to handle dragging
        document.addEventListener('mousemove', function(e) {
            if (!isDragging || !draggedItem) return;
            
            // Get grid dimensions
            const { cellWidth, cellHeight } = getGridDimensions();
            
            // Calculate movement in cells
            const deltaX = Math.round((e.clientX - startX) / cellWidth);
            const deltaY = Math.round((e.clientY - startY) / cellHeight);
            
            // Get item from state
            const itemId = draggedItem.dataset.id;
            const itemIndex = layoutItems.findIndex(i => i.id == itemId);
            if (itemIndex === -1) return;
            
            // Calculate new position with bounds checking
            const newPosX = Math.max(0, Math.min(startPosX + deltaX, 12 - layoutItems[itemIndex].width));
            const newPosY = Math.max(0, startPosY + deltaY);
            
            // Update item position in state
            if (newPosX !== layoutItems[itemIndex].position_x || newPosY !== layoutItems[itemIndex].position_y) {
                layoutItems[itemIndex].position_x = newPosX;
                layoutItems[itemIndex].position_y = newPosY;
                
                // Update item position in DOM
                draggedItem.style.gridColumn = `${newPosX + 1} / span ${layoutItems[itemIndex].width}`;
                draggedItem.style.gridRow = `${newPosY + 1} / span ${layoutItems[itemIndex].height}`;
                
                hasChanges = true;
            }
        });
        
        // Mouse up event to end dragging
        document.addEventListener('mouseup', function() {
            if (isDragging && draggedItem) {
                draggedItem.classList.remove('dragging');
                draggedItem = null;
                isDragging = false;
            }
        });
    }
    
    function selectItem(itemElement) {
        console.log('Selecting item:', itemElement.dataset.id);
        
        // Deselect previous item
        if (selectedItem) {
            selectedItem.classList.remove('selected');
        }
        
        // Select new item
        itemElement.classList.add('selected');
        selectedItem = itemElement;
        
        // Enable remove button
        removeBlockButton.disabled = false;
    }
    
    // Enter edit mode
    function enterEditMode() {
        editMode = true;
        hasChanges = false;
        
        // Store the original layout
        originalLayout = JSON.parse(JSON.stringify(layoutItems));
        
        // Show edit controls
        layoutControls.style.display = 'none';
        editControls.style.display = 'flex';
        
        // Add edit mode class to grid
        layoutGrid.classList.add('edit-mode');
    }
    
    // Exit edit mode
    function exitEditMode() {
        editMode = false;
        
        // If we had changes but didn't save, revert to original layout
        if (hasChanges) {
            layoutItems = JSON.parse(JSON.stringify(originalLayout));
            renderLayout();
        }
        
        hasChanges = false;
        
        // Hide edit controls
        layoutControls.style.display = 'flex';
        editControls.style.display = 'none';
        
        // Remove edit mode class from grid
        layoutGrid.classList.remove('edit-mode');
        
        // Deselect item
        if (selectedItem) {
            selectedItem.classList.remove('selected');
            selectedItem = null;
            removeBlockButton.disabled = true;
        }
    }
    
    // Add a new item to the layout
    function addNewItem(itemType) {
        const typeInfo = itemTypes[itemType] || { icon: 'fa-question', sizeX: 1, sizeY: 1 };
        const defaultName = getDefaultName(itemType);
        
        // Find an empty spot in the grid
        const position = findEmptyPosition(typeInfo.sizeX, typeInfo.sizeY);
        
        // Create new item
        const newItem = {
            name: defaultName,
            item_type: itemType,
            position_x: position.x,
            position_y: position.y,
            width: typeInfo.sizeX,
            height: typeInfo.sizeY
        };
        
        // Add to layout
        createItemOnServer(newItem);
    }
    
    // Generate a default name for a new item
    function getDefaultName(itemType) {
        // Count existing items of this type
        const count = layoutItems.filter(item => item.item_type === itemType).length + 1;
        const typeName = formatType(itemType);
        return `${typeName} ${count}`;
    }
    
    // Find an empty position in the grid for a new item
    function findEmptyPosition(width, height) {
        // Create a grid representation
        const maxY = getGridMaxY() + height + 5; // Add some extra rows for new items
        const grid = Array(maxY).fill().map(() => Array(12).fill(false));
        
        // Mark occupied cells
        layoutItems.forEach(item => {
            for (let y = item.position_y; y < item.position_y + item.height; y++) {
                for (let x = item.position_x; x < item.position_x + item.width; x++) {
                    if (y < grid.length && x < grid[0].length) {
                        grid[y][x] = true;
                    }
                }
            }
        });
        
        // Find first empty position that can fit the new item
        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x <= grid[0].length - width; x++) {
                let canFit = true;
                
                // Check if all required cells are empty
                for (let dy = 0; dy < height && canFit; dy++) {
                    for (let dx = 0; dx < width && canFit; dx++) {
                        if (y + dy >= grid.length || x + dx >= grid[0].length || grid[y + dy][x + dx]) {
                            canFit = false;
                        }
                    }
                }
                
                if (canFit) {
                    return { x, y };
                }
            }
        }
        
        // Default to position 0,0 if no space found
        return { x: 0, y: 0 };
    }
    
    // Get the maximum Y coordinate used in the grid
    function getGridMaxY() {
        let maxY = 0;
        layoutItems.forEach(item => {
            const bottomY = item.position_y + item.height;
            if (bottomY > maxY) maxY = bottomY;
        });
        return maxY;
    }
    
    // Create a new item on the server
    function createItemOnServer(item) {
        const data = {
            name: item.name,
            item_type: item.item_type,
            parent_id: PARENT_ID,
            position_x: item.position_x,
            position_y: item.position_y,
            width: item.width,
            height: item.height
        };
        
        fetch('/layout/add_layout_item/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(data)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                // Add new item to local state
                layoutItems.push(data.item);
                // Update original layout to include the new item
                originalLayout = JSON.parse(JSON.stringify(layoutItems));
                renderLayout();
                hasChanges = false;
            } else {
                showError(data.message || 'Error adding item');
            }
        })
        .catch(error => {
            console.error('Error adding item:', error);
            showError('Failed to add item');
        });
    }
    
    // Rename an item
    function renameItem(itemId, newName) {
        const data = {
            name: newName
        };
        
        fetch(`/layout/update_layout_item/${itemId}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(data)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                // Update item in local state
                const itemIndex = layoutItems.findIndex(i => i.id == itemId);
                if (itemIndex !== -1) {
                    layoutItems[itemIndex].name = newName;
                    renderLayout();
                    hasChanges = true;
                }
            } else {
                showError(data.message || 'Error updating item');
            }
        })
        .catch(error => {
            console.error('Error updating item:', error);
            showError('Failed to update item');
        });
    }
    
    // Improve the removeBlockButton click handler
    removeBlockButton.addEventListener('click', function() {
        if (!selectedItem) {
            showError('No item selected for deletion');
            return;
        }
        
        showConfirmation(
            'Confirm Deletion',
            'Are you sure you want to remove this item? This action cannot be undone and will remove all child items as well.',
            function() {
                deleteItem(selectedItem.dataset.id);
            }
        );
    });

    function deleteItem(itemId) {
        console.log('Deleting item with ID:', itemId);
        console.log('CSRF Token:', getCSRFToken());
        
        fetch(`/layout/delete_layout_item/${itemId}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({}) // Send empty body to ensure proper request format
        })
        .then(response => {
            console.log('Delete response status:', response.status);
            return response.text().then(text => {
                try {
                    return JSON.parse(text);
                } catch (e) {
                    console.error('Error parsing JSON:', text);
                    throw new Error('Invalid JSON response');
                }
            });
        })
        .then(data => {
            console.log('Delete response data:', data);
            if (data.status === 'success') {
                // Remove item from local state
                layoutItems = layoutItems.filter(item => item.id != itemId);
                renderLayout();
                hasChanges = true;
                selectedItem = null;
                removeBlockButton.disabled = true;
            } else {
                showError(data.message || 'Error deleting item');
            }
        })
        .catch(error => {
            console.error('Error deleting item:', error);
            showError('Failed to delete item');
        });
    }
    
    // Save the layout
    function saveLayout() {
        const data = {
            items: layoutItems.map(item => ({
                id: item.id,
                position_x: item.position_x,
                position_y: item.position_y
            }))
        };

        fetch('/layout/save/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(data)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                // Update original layout to match current layout
                originalLayout = JSON.parse(JSON.stringify(layoutItems));
                hasChanges = false;
                exitEditMode();
            } else {
                showError(data.message || 'Error saving layout');
            }
        })
        .catch(error => {
            console.error('Error saving layout:', error);
            // Add this to see the actual response content
            fetch('/layout/save/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify(data)
            })
            .then(response => response.text())
            .then(text => {
                console.error('Server response:', text);
            });
            showError('Failed to save layout');
        });
    }
    
    // Show a confirmation dialog
    function showConfirmation(title, message, onConfirm) {
        confirmTitle.textContent = title;
        confirmMessage.textContent = message;
        
        confirmButton.onclick = function() {
            onConfirm();
            confirmModal.hide();
        };
        
        confirmModal.show();
    }
    
    // Show an error message
    function showError(message) {
        // This could be extended to show a toast or other UI notification
        console.error(message);
        alert(message);
    }

    // Fault Report 
    if (event.target && event.target.id === "submitFault") {
        document.getElementById("submitFault").addEventListener("click", function () {
            const faultTitle = document.getElementById("faultTitle").value;
            const faultDescription = document.getElementById("faultDescription").value;
            const USER_ID = "{{ user.id }}";
            const PARENT_ID = "{{ parent_id|default:'null' }}";
            if (faultTitle && faultDescription) {
                const data = {
                    title: faultTitle,
                    description: faultDescription,
                    system_name: PARENT_ID,
                    reported_by: USER_ID,
                    fault_type: "Hardware",
                    status: "Pending"
                };

                fetch('/report_fault/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === "success") {
                        alert("Fault report submitted successfully!");
                        $('#newFaultModal').modal('hide');
                    } else {
                        alert("Error: " + data.message);
                    }
                })
                .catch(error => {
                    console.error("Error:", error);
                    alert("Failed to submit fault report.");
                });
            } else {
                alert("Please fill out both the title and description.");
            }
        });
    }
});