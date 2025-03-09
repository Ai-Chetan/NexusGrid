document.addEventListener("DOMContentLoaded", function() {
    // DOM Elements
    const layout = document.getElementById("layout");
    const backButton = document.getElementById("backButton");
    const editLayoutButton = document.getElementById("editLayoutButton");
    const layoutControls = document.getElementById("layoutControls");
    const editControls = document.getElementById("editControls");
    const addItemLinks = document.querySelectorAll(".dropdown-item");
    const removeBlockButton = document.getElementById("removeBlockButton");
    const resetLayoutButton = document.getElementById("resetLayoutButton");
    const saveLayoutButton = document.getElementById("saveLayoutButton");
    const cancelEditButton = document.getElementById("cancelEditButton");
    
    // Modal elements
    const renameModal = new bootstrap.Modal(document.getElementById("renameModal"));
    const confirmModal = new bootstrap.Modal(document.getElementById("confirmModal"));
    const confirmButton = document.getElementById("confirmButton");
    const saveNameButton = document.getElementById("saveNameButton");
    
    // Application state
    let selectedItem = null;
    let items = [];
    let isEditMode = false;
    let hasUnsavedChanges = false;
    let pendingAction = null;
    let nextItemId = 1;
    
    // Item type configurations
    const itemTypeIcons = {
        'building': 'fa-building', 'floor': 'fa-layer-group', 'room': 'fa-door-open',
        'computer': 'fa-desktop', 'server': 'fa-server', 'network_switch': 'fa-network-wired',
        'router': 'fa-wifi', 'printer': 'fa-print', 'ups': 'fa-battery-full', 'rack': 'fa-hdd'
    };
    
    const itemTypeColors = {
        'building': '#2c3e50', 'floor': '#3498db', 'room': '#e74c3c', 'computer': '#2ecc71',
        'server': '#9b59b6', 'network_switch': '#f39c12', 'router': '#1abc9c', 
        'printer': '#34495e', 'ups': '#27ae60', 'rack': '#8e44ad'
    };
    
    const itemTypeNames = {
        'building': 'Building', 'floor': 'Floor', 'room': 'Room', 'computer': 'Computer',
        'server': 'Server', 'network_switch': 'Network Switch', 'router': 'Router',
        'printer': 'Printer', 'ups': 'UPS', 'rack': 'Server Rack'
    };
    
    // Set up event listeners
    backButton.addEventListener("click", navigateBack);
    editLayoutButton.addEventListener("click", enterEditMode);
    cancelEditButton.addEventListener("click", exitEditMode);
    addItemLinks.forEach(link => link.addEventListener("click", () => addNewItem(link.dataset.type)));
    removeBlockButton.addEventListener("click", removeSelectedItem);
    resetLayoutButton.addEventListener("click", confirmReset);
    saveLayoutButton.addEventListener("click", saveLayout);
    saveNameButton.addEventListener("click", saveItemName);
    window.addEventListener("beforeunload", handlePageLeave);
    
    // Render items on the layout
    function renderItems() {
        layout.innerHTML = "";
        items.forEach(createItemElement);
    }
    
    // Create and append a new item to the layout
    function createItemElement(item) {
        const itemElement = document.createElement("div");
        itemElement.classList.add("layout-item");
        itemElement.dataset.id = item.id;
        itemElement.dataset.type = item.item_type;
        itemElement.style.left = `${item.x_position}px`;
        itemElement.style.top = `${item.y_position}px`;
        
        // Create icon
        const iconElement = document.createElement("i");
        iconElement.classList.add("fas", itemTypeIcons[item.item_type] || "fa-question");
        iconElement.style.fontSize = "2rem";
        iconElement.style.color = itemTypeColors[item.item_type] || "#333";
        itemElement.appendChild(iconElement);
        
        // Create label
        const labelElement = document.createElement("div");
        labelElement.classList.add("item-label");
        labelElement.textContent = item.name;
        itemElement.appendChild(labelElement);
        
        // Event handlers
        itemElement.addEventListener("click", (e) => {
            e.stopPropagation();
            if (isEditMode) {
                selectItem(itemElement);
            } else if (["building", "floor", "room"].includes(item.item_type)) {
                // Changed URL format from /{id}/ to /layout/{id}/
                window.location.href = `/layout/${item.id}/`;
            }
        });
        
        itemElement.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            if (isEditMode) openRenameModal(item);
        });
        
        layout.appendChild(itemElement);
        
        if (isEditMode) makeItemDraggable(itemElement);
    }
    
    // Make an item draggable
    function makeItemDraggable(element) {
        let startX, startY, origX, origY;
        
        element.addEventListener("mousedown", startDrag);
        element.addEventListener("touchstart", startDrag, { passive: false });
        
        function startDrag(e) {
            e.preventDefault();
            if (!isEditMode) return;
            
            selectItem(element);
            
            if (e.type === "touchstart") {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            } else {
                startX = e.clientX;
                startY = e.clientY;
            }
            
            origX = parseInt(element.style.left);
            origY = parseInt(element.style.top);
            element.classList.add("dragging");
            
            document.addEventListener("mousemove", dragMove);
            document.addEventListener("touchmove", dragMove, { passive: false });
            document.addEventListener("mouseup", dragEnd);
            document.addEventListener("touchend", dragEnd);
        }
        
        function dragMove(e) {
            e.preventDefault();
            
            const currX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
            const currY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;
            
            const offsetX = currX - startX;
            const offsetY = currY - startY;
            
            const maxX = layout.clientWidth - element.offsetWidth;
            const maxY = layout.clientHeight - element.offsetHeight;
            
            const newX = Math.max(0, Math.min(origX + offsetX, maxX));
            const newY = Math.max(0, Math.min(origY + offsetY, maxY));
            
            element.style.left = `${newX}px`;
            element.style.top = `${newY}px`;
            hasUnsavedChanges = true;
        }
        
        function dragEnd() {
            element.classList.remove("dragging");
            
            document.removeEventListener("mousemove", dragMove);
            document.removeEventListener("touchmove", dragMove);
            document.removeEventListener("mouseup", dragEnd);
            document.removeEventListener("touchend", dragEnd);
            
            // Update the item's position in our local items array
            updateItemPosition(element);
        }
    }
    
    // Update item position in the items array
    function updateItemPosition(element) {
        const id = parseInt(element.dataset.id);
        const x = parseInt(element.style.left);
        const y = parseInt(element.style.top);
        
        const item = items.find(item => item.id === id);
        if (item) {
            item.x_position = x;
            item.y_position = y;
        }
    }
    
    // Select an item on the layout
    function selectItem(element) {
        if (selectedItem) selectedItem.classList.remove("selected");
        element.classList.add("selected");
        selectedItem = element;
    }
    
    // Handle navigation
    function navigateBack() {
        if (hasUnsavedChanges) {
            confirmAction("You have unsaved changes", "Are you sure you want to leave without saving?", performNavigateBack);
        } else {
            performNavigateBack();
        }
    }
    
    function performNavigateBack() {
        const breadcrumb = document.querySelectorAll(".breadcrumb-container a");
        if (breadcrumb.length > 1) {
            window.location.href = breadcrumb[breadcrumb.length - 1].href;
        } else {
            window.location.href = "/";
        }
    }
    
    // Edit mode management
    function enterEditMode() {
        isEditMode = true;
        layoutControls.style.display = "none";
        editControls.style.display = "flex";
        
        document.querySelectorAll(".layout-item").forEach(makeItemDraggable);
        layout.addEventListener("click", deselectAllItems);
    }
    
    function exitEditMode() {
        if (hasUnsavedChanges) {
            confirmAction("You have unsaved changes", "Are you sure you want to exit without saving?", performExitEditMode);
        } else {
            performExitEditMode();
        }
    }
    
    function performExitEditMode() {
        isEditMode = false;
        layoutControls.style.display = "flex";
        editControls.style.display = "none";
        
        deselectAllItems();
        layout.removeEventListener("click", deselectAllItems);
        hasUnsavedChanges = false;
    }
    
    function deselectAllItems() {
        if (selectedItem) {
            selectedItem.classList.remove("selected");
            selectedItem = null;
        }
    }
    
    // Item CRUD operations
    function addNewItem(itemType) {
        const centerX = Math.round(layout.clientWidth / 2) - 45;
        const centerY = Math.round(layout.clientHeight / 2) - 50;
        
        const newItem = {
            id: nextItemId++,
            name: `New ${itemTypeNames[itemType]}`,
            item_type: itemType,
            x_position: centerX,
            y_position: centerY
        };
        
        items.push(newItem);
        createItemElement(newItem);
        hasUnsavedChanges = true;
    }
    
    function removeSelectedItem() {
        if (!selectedItem) {
            alert('Please select an item to remove');
            return;
        }
        
        const itemId = parseInt(selectedItem.dataset.id);
        
        selectedItem.remove();
        items = items.filter(item => item.id !== itemId);
        selectedItem = null;
        hasUnsavedChanges = true;
    }
    
    // Rename operations
    function openRenameModal(item) {
        document.getElementById('itemId').value = item.id;
        document.getElementById('itemName').value = item.name;
        renameModal.show();
    }
    
    function saveItemName() {
        const itemId = parseInt(document.getElementById('itemId').value);
        const newName = document.getElementById('itemName').value.trim();
        
        if (!newName) return;
        
        const item = items.find(item => item.id === itemId);
        if (item) item.name = newName;
        
        const element = document.querySelector(`.layout-item[data-id="${itemId}"]`);
        if (element) element.querySelector('.item-label').textContent = newName;
        
        renameModal.hide();
        hasUnsavedChanges = true;
    }
    
    // Layout operations
    function confirmReset() {
        confirmAction('Reset Layout', 'Are you sure you want to reset the layout? All items will be removed.', resetLayout);
    }
    
    function resetLayout() {
        items = [];
        layout.innerHTML = '';
        selectedItem = null;
        hasUnsavedChanges = false;
    }
    
    function saveLayout() {
        // In a real application, you'd save to the server here
        // Now we just mark changes as saved
        hasUnsavedChanges = false;
        performExitEditMode();
        alert('Layout saved successfully');
    }
    
    // Utility functions
    function confirmAction(title, message, action) {
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        pendingAction = action;
        confirmModal.show();
        
        confirmButton.onclick = function() {
            confirmModal.hide();
            if (pendingAction) {
                pendingAction();
                pendingAction = null;
            }
        };
    }
    
    function handlePageLeave(e) {
        if (hasUnsavedChanges) {
            const message = 'You have unsaved changes that will be lost if you leave.';
            e.returnValue = message;
            return message;
        }
    }
});

// Initialize layout by loading data from database
function initializeLayout() {
    // First try to load layout data from the database
    getLayoutItems()
        .then(layoutData => {
            if (layoutData && layoutData.length > 0) {
                // If we have data, use it
                items = layoutData;
                
                // Find highest ID to set nextItemId correctly
                const maxId = Math.max(...items.map(item => item.id));
                nextItemId = maxId + 1;
                
                renderItems();
            } else {
                // If no data, initialize with empty layout
                items = [];
                nextItemId = 1;
            }
        })
        .catch(error => {
            console.error("Error loading layout:", error);
            // If loading fails, initialize with empty layout
            items = [];
            nextItemId = 1;
        });
}

// Function to get layout items from the database
function getLayoutItems() {
    // Get the current path to determine which layout to load
    const pathParts = window.location.pathname.split('/');
    const layoutId = pathParts.includes('layout') ? pathParts[pathParts.indexOf('layout') + 1] : null;
    
    return fetch(`/api/layout/${layoutId || 'root'}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Failed to load layout data: ${response.statusText}`);
        }
        return response.json();
    });
}

// Function to save layout to the database
function saveLayout() {
    // Get CSRF token from cookie or meta tag
    const csrfToken = getCsrfToken();
    
    // Get the current path to determine which layout to save
    const pathParts = window.location.pathname.split('/');
    const layoutId = pathParts.includes('layout') ? pathParts[pathParts.indexOf('layout') + 1] : null;
    
    // Prepare data for saving
    const layoutData = {
        layout_id: layoutId || 'root',
        items: items
    };
    
    fetch('/api/layout/save', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify(layoutData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Failed to save layout: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        hasUnsavedChanges = false;
        performExitEditMode();
        alert('Layout saved successfully');
    })
    .catch(error => {
        console.error("Error saving layout:", error);
        alert(`Failed to save layout: ${error.message}`);
    });
}

// Helper function to get CSRF token from cookie or meta tag
function getCsrfToken() {
    // First try to get from cookie
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
    
    if (cookieValue) return cookieValue;
    
    // If not in cookie, try to get from meta tag
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
}

// Call the initialization function when the page loads
initializeLayout();