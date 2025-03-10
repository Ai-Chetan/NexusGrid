// Global variables for layout management
let items = [];
let nextItemId = 1;
let isEditMode = false;
let selectedItem = null;
let hasUnsavedChanges = false;
let pendingAction = null;
let layoutData = { layout_id: "root", items: [] }; // Ensure it's initialized globally

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
    
    // Initialize the layout
    initializeLayout();
    
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
            window.location.href = "/layout/";
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
        layoutData.items = items; // Ensure layoutData is updated
    
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
    
    // Save the layout
    function saveLayout() {
        console.log("Save button clicked!");
    
        const layoutData = {
            layout_id: currentLayoutId,  // Ensure this is correctly set
            items: layoutItems.map(item => {
                return item.id ? item : { ...item, id: undefined }; // Remove ID for new items
            })
        };    
        if (!layoutData || !layoutData.items || layoutData.items.length === 0) {
            console.error("Error: layoutData is empty or not initialized.");
            alert("No items to save! Please add some items first.");
            return;
        }
    
        console.log("Saving layout with data:", layoutData);
    
        fetch('/layout/save/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify(layoutData),
            credentials: 'same-origin'
        })
        .then(response => response.json())
        .then(data => {
            console.log("Save successful:", data);
            hasUnsavedChanges = false;
            performExitEditMode();
            alert('Layout saved successfully');
        })
        .catch(error => {
            console.error("Error saving layout:", error);
            alert(`Failed to save layout: ${error.message}`);
        });
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
    getLayoutItems()
        .then(data => {
            if (data && data.length > 0) {
                items = data;
                layoutData.items = items; // Ensure layoutData is updated

                const maxId = Math.max(...items.map(item => item.id), 0);
                nextItemId = maxId + 1;

                renderItems();
            } else {
                items = [];
                layoutData.items = items; // Ensure layoutData is still updated
                nextItemId = 1;
            }
        })
        .catch(error => {
            console.error("Error loading layout:", error);
            items = [];
            layoutData.items = items;
            nextItemId = 1;
        });
}

// Function to get layout items from the database
function getLayoutItems() {
    const parentId = PARENT_ID === "null" ? "root" : PARENT_ID || "root";
    
    return fetch(`/layout/get_layout_items/?parent_id=${parentId}`, {
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

// Enhanced helper function to get CSRF token from various sources
function getCsrfToken() {
    // 1. Try to get from cookie (most common source)
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
    
    if (cookieValue) return cookieValue;
    
    // 2. Try to get from the input field that Django typically includes
    const csrfInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (csrfInput) return csrfInput.value;
    
    // 3. Try to get from meta tag
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    if (metaTag) return metaTag.getAttribute('content');
    
    // 4. Check if we have a global CSRF_TOKEN variable defined
    if (typeof CSRF_TOKEN !== 'undefined' && CSRF_TOKEN) return CSRF_TOKEN;
    
    console.error("CSRF token not found");
    return null;
}

// Render items on the layout
function renderItems() {
    if (!layout) return;
    
    layout.innerHTML = "";
    items.forEach(createItemElement);
}