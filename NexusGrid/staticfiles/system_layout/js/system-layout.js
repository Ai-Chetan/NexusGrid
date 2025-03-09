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
    
    // Initialize the layout
    loadLayoutItems();
    
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
    
    // Load layout items from the server
    function loadLayoutItems() {
        fetch(`/layout/get_layout_items/`)
            .then(response => response.json())
            .then(data => {
                items = data.items;
                renderItems();
            })
            .catch(error => console.error("Error loading layout items:", error));
    }
    
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
                window.location.href = `/${item.id}/`;
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
            
            updateItemPosition(element);
        }
    }
    
    // Update item position in the database
    function updateItemPosition(element) {
        const id = parseInt(element.dataset.id);
        const x = parseInt(element.style.left);
        const y = parseInt(element.style.top);
        
        const item = items.find(item => item.id === id);
        if (item) {
            item.x_position = x;
            item.y_position = y;
            
            fetch(`/layout/update_layout_item/${id}/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": CSRF_TOKEN
                },
                body: JSON.stringify({ x_position: x, y_position: y })
            }).catch(error => console.error("Error updating position:", error));
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
            confirmAction("You have unsaved changes", "Are you sure you want to exit without saving?", () => {
                performExitEditMode();
                loadLayoutItems();
            });
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
        
        fetch('/layout/add_layout_item/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': CSRF_TOKEN
            },
            body: JSON.stringify({
                name: `New ${itemTypeNames[itemType]}`,
                item_type: itemType,
                x_position: centerX,
                y_position: centerY,
                parent_id: PARENT_ID
            })
        })/*
        .then(response => response.json())
        .then(data => {
            items.push(data);
            createItemElement(data);
            hasUnsavedChanges = true;
        })
        .catch(error => console.error('Error adding item:', error));*/
    }
    
    function removeSelectedItem() {
        if (!selectedItem) {
            alert('Please select an item to remove');
            return;
        }
        
        const itemId = parseInt(selectedItem.dataset.id);
        
        fetch(`/layout/delete_layout_item/${itemId}/`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': CSRF_TOKEN }
        })
        .then(response => response.json())
        .then(() => {
            selectedItem.remove();
            items = items.filter(item => item.id !== itemId);
            selectedItem = null;
            hasUnsavedChanges = true;
        })
        .catch(error => console.error('Error removing item:', error));
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
        
        fetch(`/layout/update_layout_item/${itemId}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': CSRF_TOKEN
            },
            body: JSON.stringify({ name: newName })
        })
        .then(response => response.json())
        .then(() => {
            const item = items.find(item => item.id === itemId);
            if (item) item.name = newName;
            
            const element = document.querySelector(`.layout-item[data-id="${itemId}"]`);
            if (element) element.querySelector('.item-label').textContent = newName;
            
            renameModal.hide();
            hasUnsavedChanges = true;
        })
        .catch(error => console.error('Error updating name:', error));
    }
    
    // Layout operations
    function confirmReset() {
        confirmAction('Reset Layout', 'Are you sure you want to reset the layout? All items will be removed.', resetLayout);
    }
    
    function resetLayout() {
        fetch('/layout/save_layout/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': CSRF_TOKEN
            },
            body: JSON.stringify({
                reset: true,
                parent_id: PARENT_ID,
                items: []
            })
        })
        .then(response => response.json())
        .then(() => {
            items = [];
            layout.innerHTML = '';
            selectedItem = null;
            hasUnsavedChanges = false;
        })
        .catch(error => console.error('Error resetting layout:', error));
    }
    
    function saveLayout() {
        const updatedItems = Array.from(document.querySelectorAll('.layout-item')).map(element => ({
            id: parseInt(element.dataset.id),
            x_position: parseInt(element.style.left),
            y_position: parseInt(element.style.top)
        }));
        
        fetch('/layout/save_layout/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': CSRF_TOKEN
            },
            body: JSON.stringify({
                parent_id: PARENT_ID,
                items: updatedItems
            })
        })
        .then(response => response.json())
        .then(() => {
            hasUnsavedChanges = false;
            performExitEditMode();
            alert('Layout saved successfully');
        })
        .catch(error => console.error('Error saving layout:', error));
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