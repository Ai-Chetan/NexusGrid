// Global variables for layout management
let items = [];
let nextItemId = 1;
let isEditMode = false;
let selectedItem = null;
let hasUnsavedChanges = false;
let pendingAction = null;
let layout; // Reference to the layout element
let currentHierarchyLevel = null;
let isDataLoading = false;

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

// Hierarchy validation - what can be placed in what
const validChildTypes = {
    'root': ['building'],
    'building': ['floor'],
    'floor': ['room'],
    'room': ['computer', 'server', 'network_switch', 'router', 'printer', 'ups', 'rack'],
    'computer': [],
    'server': [],
    'network_switch': [],
    'router': [],
    'printer': [],
    'ups': [],
    'rack': []
};

// Create and append a new item to the layout with improved error handling
function createItemElement(item) {
    if (!layout) {
        console.error("Layout element not initialized");
        return;
    }

    // Validate item data
    if (!item || !item.id || !item.item_type) {
        console.error("Invalid item data:", item);
        return;
    }

    const itemElement = document.createElement("div");
    itemElement.classList.add("layout-item");
    itemElement.dataset.id = item.id;
    itemElement.dataset.type = item.item_type;
    
    // Ensure position values are valid numbers
    const xPos = parseFloat(item.x_position) || 0;
    const yPos = parseFloat(item.y_position) || 0;
    
    itemElement.style.left = `${xPos}px`;
    itemElement.style.top = `${yPos}px`;
    
    // Create icon with fallback
    const iconElement = document.createElement("i");
    iconElement.classList.add("fas", itemTypeIcons[item.item_type] || "fa-question");
    iconElement.style.fontSize = "2rem";
    iconElement.style.color = itemTypeColors[item.item_type] || "#333";
    itemElement.appendChild(iconElement);
    
    // Create label with XSS protection
    const labelElement = document.createElement("div");
    labelElement.classList.add("item-label");
    labelElement.textContent = item.name || "Unnamed Item";
    itemElement.appendChild(labelElement);
    
    // Event handlers with improved behavior
    itemElement.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isEditMode) {
            selectItem(itemElement);
        } else if (["building", "floor", "room"].includes(item.item_type)) {
            if (hasUnsavedChanges) {
                confirmAction("You have unsaved changes", 
                              "Are you sure you want to navigate away without saving?", 
                              () => navigateToItem(item));
            } else {
                navigateToItem(item);
            }
        }
    });
    
    itemElement.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        if (isEditMode) openRenameModal(item);
    });
    
    layout.appendChild(itemElement);
    
    if (isEditMode) makeItemDraggable(itemElement);
}

// Navigate to an item's contents
function navigateToItem(item) {
    window.location.href = `/layout/${item.id}/`;
}

// Render items on the layout with loading indicator
function renderItems() {
    if (!layout) {
        console.error("Layout element not initialized");
        return;
    }
    
    // Show loading indicator
    const loadingIndicator = document.getElementById("loadingIndicator");
    if (loadingIndicator) loadingIndicator.style.display = "block";
    
    layout.innerHTML = "";
    
    // Delay slightly to allow UI to update with loading indicator
    setTimeout(() => {
        try {
            items.forEach(createItemElement);
        } catch (error) {
            console.error("Error rendering items:", error);
            alert("There was an error displaying the layout items.");
        } finally {
            // Hide loading indicator
            if (loadingIndicator) loadingIndicator.style.display = "none";
        }
    }, 100);
}

// Make an item draggable with boundary checking
function makeItemDraggable(element) {
    if (!element) return;
    
    let startX, startY, origX, origY;
    let isDragging = false;
    
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
        
        origX = parseInt(element.style.left) || 0;
        origY = parseInt(element.style.top) || 0;
        element.classList.add("dragging");
        isDragging = true;
        
        document.addEventListener("mousemove", dragMove);
        document.addEventListener("touchmove", dragMove, { passive: false });
        document.addEventListener("mouseup", dragEnd);
        document.addEventListener("touchend", dragEnd);
    }
    
    function dragMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        
        const currX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
        const currY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;
        
        const offsetX = currX - startX;
        const offsetY = currY - startY;
        
        // Get layout boundaries with fallbacks
        const layoutWidth = layout ? layout.clientWidth : window.innerWidth;
        const layoutHeight = layout ? layout.clientHeight : window.innerHeight;
        
        const maxX = layoutWidth - element.offsetWidth;
        const maxY = layoutHeight - element.offsetHeight;
        
        const newX = Math.max(0, Math.min(origX + offsetX, maxX));
        const newY = Math.max(0, Math.min(origY + offsetY, maxY));
        
        element.style.left = `${newX}px`;
        element.style.top = `${newY}px`;
        hasUnsavedChanges = true;
    }
    
    function dragEnd() {
        if (!isDragging) return;
        
        element.classList.remove("dragging");
        isDragging = false;
        
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
    if (!element || !element.dataset || !element.dataset.id) {
        console.error("Invalid element for position update");
        return;
    }
    
    const id = parseInt(element.dataset.id);
    if (isNaN(id)) {
        console.error("Invalid ID for position update:", element.dataset.id);
        return;
    }
    
    const x = parseInt(element.style.left) || 0;
    const y = parseInt(element.style.top) || 0;
    
    const item = items.find(item => item.id === id);
    if (item) {
        item.x_position = x;
        item.y_position = y;
    } else {
        console.warn(`Item with ID ${id} not found in items array`);
    }
}

// Select an item on the layout
function selectItem(element) {
    if (!element) return;
    
    // Deselect previous
    if (selectedItem) selectedItem.classList.remove("selected");
    
    // Select new
    element.classList.add("selected");
    selectedItem = element;
    
    // Update UI controls based on selection
    updateSelectionControls();
}

// Update UI controls based on selection state
function updateSelectionControls() {
    const removeBtn = document.getElementById("removeBlockButton");
    if (removeBtn) {
        removeBtn.disabled = !selectedItem;
    }
    
    const propertiesBtn = document.getElementById("itemPropertiesButton");
    if (propertiesBtn) {
        propertiesBtn.disabled = !selectedItem;
    }
}

// Open rename modal with validation
function openRenameModal(item) {
    if (!item || !item.id) {
        console.error("Invalid item for rename");
        return;
    }
    
    const itemIdInput = document.getElementById('itemId');
    const itemNameInput = document.getElementById('itemName');
    
    if (itemIdInput && itemNameInput) {
        itemIdInput.value = item.id;
        itemNameInput.value = item.name || "";
        
        const renameModal = new bootstrap.Modal(document.getElementById("renameModal"));
        renameModal.show();
    } else {
        console.error("Rename modal inputs not found");
        alert("Could not open the rename dialog. The page may be missing elements.");
    }
}

// Deselect all items
function deselectAllItems() {
    if (selectedItem) {
        selectedItem.classList.remove("selected");
        selectedItem = null;
        updateSelectionControls();
    }
}

document.addEventListener("DOMContentLoaded", function() {
    // DOM Elements with error handling
    try {
        layout = document.getElementById("layout");
        if (!layout) throw new Error("Layout element not found");
        
        // Get parent ID from the page (global variable set in the template)
        currentHierarchyLevel = PARENT_ID === "null" || !PARENT_ID ? "root" : PARENT_ID;
        
        // Initialize UI elements
        initializeUIControls();
        
        // Initialize the layout
        initializeLayout();
    } catch (error) {
        console.error("Error during initialization:", error);
        alert("There was a problem loading the layout editor. Please refresh the page and try again.");
    }
});

// Initialize UI controls with error handling
function initializeUIControls() {
    try {
        // Primary controls
        const backButton = document.getElementById("backButton");
        const editLayoutButton = document.getElementById("editLayoutButton");
        const layoutControls = document.getElementById("layoutControls");
        const editControls = document.getElementById("editControls");
        
        // Editing controls
        const addItemLinks = document.querySelectorAll(".dropdown-item[data-type]");
        const removeBlockButton = document.getElementById("removeBlockButton");
        const resetLayoutButton = document.getElementById("resetLayoutButton");
        const saveLayoutButton = document.getElementById("saveLayoutButton");
        const cancelEditButton = document.getElementById("cancelEditButton");
        
        // Modal elements
        const confirmModal = document.getElementById("confirmModal");
        let confirmModalInstance = null;
        
        if (confirmModal) {
            confirmModalInstance = new bootstrap.Modal(confirmModal);
        }
        
        const confirmButton = document.getElementById("confirmButton");
        const saveNameButton = document.getElementById("saveNameButton");
        
        // Set up event listeners with error handling
        if (backButton) backButton.addEventListener("click", navigateBack);
        if (editLayoutButton) editLayoutButton.addEventListener("click", enterEditMode);
        if (cancelEditButton) cancelEditButton.addEventListener("click", exitEditMode);
        
        if (addItemLinks) {
            addItemLinks.forEach(link => {
                if (link && link.dataset && link.dataset.type) {
                    link.addEventListener("click", () => addNewItem(link.dataset.type));
                }
            });
        }
        
        if (removeBlockButton) removeBlockButton.addEventListener("click", removeSelectedItem);
        if (resetLayoutButton) resetLayoutButton.addEventListener("click", confirmReset);
        if (saveLayoutButton) saveLayoutButton.addEventListener("click", saveLayout);
        if (saveNameButton) saveNameButton.addEventListener("click", saveItemName);
        
        // Handle unsaved changes
        window.addEventListener("beforeunload", handlePageLeave);
        
        // Handle layout clicks for deselection
        if (layout) layout.addEventListener("click", function(e) {
            if (e.target === layout && isEditMode) {
                deselectAllItems();
            }
        });
    } catch (error) {
        console.error("Error initializing UI controls:", error);
        alert("There was a problem setting up the layout editor controls.");
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
        if (breadcrumb && breadcrumb.length > 1) {
            window.location.href = breadcrumb[breadcrumb.length - 2].href;
        } else {
            window.location.href = "/layout/";
        }
    }
    
    // Edit mode management
    function enterEditMode() {
        isEditMode = true;
        
        if (layoutControls) layoutControls.style.display = "none";
        if (editControls) editControls.style.display = "flex";
        
        document.querySelectorAll(".layout-item").forEach(makeItemDraggable);
        
        // Update UI to reflect edit mode
        document.body.classList.add("edit-mode");
        updateDropdownOptions();
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
        
        if (layoutControls) layoutControls.style.display = "flex";
        if (editControls) editControls.style.display = "none";
        
        deselectAllItems();
        document.body.classList.remove("edit-mode");
        hasUnsavedChanges = false;
    }
}

// Update dropdown options based on current hierarchy level
function updateDropdownOptions() {
    const addItemDropdown = document.getElementById("addItemDropdown");
    if (!addItemDropdown) return;
    
    // Determine parent type to know what children are valid
    const parentType = currentHierarchyLevel === "root" ? "root" : 
                       (items.find(item => item.id == currentHierarchyLevel)?.item_type || "root");
    
    // Get valid child types for this parent
    const allowedTypes = validChildTypes[parentType] || [];
    
    // Update dropdown items
    const dropdownItems = addItemDropdown.querySelectorAll(".dropdown-item[data-type]");
    dropdownItems.forEach(item => {
        const itemType = item.dataset.type;
        if (allowedTypes.includes(itemType)) {
            item.style.display = "block";
        } else {
            item.style.display = "none";
        }
    });
}

// Item CRUD operations
function addNewItem(itemType) {
    // Check if this type is valid for the current hierarchy level
    const parentType = currentHierarchyLevel === "root" ? "root" : 
                      (items.find(item => item.id == currentHierarchyLevel)?.item_type || "root");
    
    const allowedTypes = validChildTypes[parentType] || [];
    
    if (!allowedTypes.includes(itemType)) {
        alert(`Cannot add ${itemTypeNames[itemType]} to this level. Valid types are: ${allowedTypes.map(t => itemTypeNames[t]).join(', ')}`);
        return;
    }
    
    // Calculate a reasonable position - center with slight offset if multiple items
    const offset = items.length * 10;
    const centerX = Math.round((layout.clientWidth / 2) - 45) + offset;
    const centerY = Math.round((layout.clientHeight / 2) - 50) + offset;
    
    const newItem = {
        id: nextItemId++,
        name: `New ${itemTypeNames[itemType]}`,
        item_type: itemType,
        x_position: centerX,
        y_position: centerY,
        parent_id: currentHierarchyLevel === "root" ? null : currentHierarchyLevel
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
    const itemType = selectedItem.dataset.type;
    
    // Check if this item has children before removal
    if (["building", "floor", "room"].includes(itemType)) {
        confirmAction(
            "Remove Item", 
            "This may have child items. Are you sure you want to remove it and all its contents?", 
            performRemoveItem
        );
    } else {
        performRemoveItem();
    }
    
    function performRemoveItem() {
        selectedItem.remove();
        items = items.filter(item => item.id !== itemId);
        selectedItem = null;
        updateSelectionControls();
        hasUnsavedChanges = true;
    }
}

// Save item name with validation
function saveItemName() {
    const itemIdInput = document.getElementById('itemId');
    const itemNameInput = document.getElementById('itemName');
    
    if (!itemIdInput || !itemNameInput) {
        console.error("Rename inputs not found");
        return;
    }
    
    const itemId = parseInt(itemIdInput.value);
    const newName = itemNameInput.value.trim();
    
    if (!newName) {
        alert("Item name cannot be empty");
        return;
    }
    
    const item = items.find(item => item.id === itemId);
    if (item) item.name = newName;
    
    const element = document.querySelector(`.layout-item[data-id="${itemId}"]`);
    if (element) {
        const labelElement = element.querySelector('.item-label');
        if (labelElement) labelElement.textContent = newName;
    }
    
    const renameModal = bootstrap.Modal.getInstance(document.getElementById("renameModal"));
    if (renameModal) renameModal.hide();
    
    hasUnsavedChanges = true;
}

// Layout operations
function confirmReset() {
    confirmAction('Reset Layout', 'Are you sure you want to reset the layout? All items will be removed.', resetLayout);
}

function confirmAction(title, message, action) {
    const confirmModal = document.getElementById("confirmModal");
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmButton = document.getElementById("confirmButton");
    
    if (!confirmModal || !confirmTitle || !confirmMessage || !confirmButton) {
        console.error("Confirm modal elements not found");
        if (confirm(message)) {
            action();
        }
        return;
    }
    
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    pendingAction = action;
    
    const modalInstance = bootstrap.Modal.getOrCreateInstance(confirmModal);
    modalInstance.show();
    
    confirmButton.onclick = function() {
        modalInstance.hide();
        if (pendingAction) {
            pendingAction();
            pendingAction = null;
        }
    };
}

function resetLayout() {
    items = [];
    layout.innerHTML = '';
    selectedItem = null;
    hasUnsavedChanges = false;
}

// Save the layout with robust error handling and progress indication
function saveLayout() {
    const saveButton = document.getElementById("saveLayoutButton");
    const saveSpinner = document.getElementById("saveSpinner");
    
    if (saveButton) saveButton.disabled = true;
    if (saveSpinner) saveSpinner.style.display = "inline-block";
    
    const layoutData = {
        layout_id: currentHierarchyLevel,
        items: items.map(item => ({
            id: item.id,
            name: item.name,
            item_type: item.item_type,
            x_position: item.x_position,
            y_position: item.y_position,
            parent_id: currentHierarchyLevel === "root" ? null : currentHierarchyLevel
        }))
    };

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
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || `Server error: ${response.status}`);
            });
        }
        return response.json();
    })
    .then(data => {
        console.log("Save successful:", data);
        hasUnsavedChanges = false;
        
        // Handle any new IDs for newly created items
        if (data.new_ids && Array.isArray(data.new_ids)) {
            updateItemIds(data.new_ids);
        }
        
        performExitEditMode();
        showSuccessToast('Layout saved successfully');
    })
    .catch(error => {
        console.error("Error saving layout:", error);
        showErrorToast(`Failed to save layout: ${error.message}`);
    })
    .finally(() => {
        if (saveButton) saveButton.disabled = false;
        if (saveSpinner) saveSpinner.style.display = "none";
    });
}

// Update local item IDs after server save (for newly created items)
function updateItemIds(newIds) {
    if (!newIds || !Array.isArray(newIds)) return;
    
    newIds.forEach(mapping => {
        const tempId = mapping.temp_id;
        const newId = mapping.new_id;
        
        // Update in items array
        const item = items.find(item => item.id === tempId);
        if (item) item.id = newId;
        
        // Update in DOM
        const element = document.querySelector(`.layout-item[data-id="${tempId}"]`);
        if (element) element.dataset.id = newId;
    });
}

// Show toast messages for user feedback
function showSuccessToast(message) {
    showToast(message, 'success');
}

function showErrorToast(message) {
    showToast(message, 'danger');
}

function showToast(message, type = 'info') {
    // Check if toast container exists, create if not
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.style.position = 'fixed';
        toastContainer.style.top = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '1050';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast bg-${type} text-white`;
    toast.role = 'alert';
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="toast-header bg-${type} text-white">
            <strong class="mr-auto">Layout Editor</strong>
            <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Initialize and show using Bootstrap
    const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 5000
    });
    
    bsToast.show();
    
    // Remove toast from DOM after it's hidden
    toast.addEventListener('hidden.bs.toast', function() {
        toast.remove();
    });
}

// Handle page navigation
function handlePageLeave(e) {
    if (hasUnsavedChanges) {
        const message = 'You have unsaved changes that will be lost if you leave.';
        e.returnValue = message;
        return message;
    }
}

// Initialize layout by loading data from database with lazy loading
function initializeLayout() {
    layout = document.getElementById("layout");
    if (!layout) {
        console.error("Layout element not found");
        return;
    }
    
    // Show loading state
    isDataLoading = true;
    const loadingIndicator = document.getElementById("loadingIndicator");
    if (loadingIndicator) loadingIndicator.style.display = "block";
    
    getLayoutItems()
        .then(data => {
            isDataLoading = false;
            if (loadingIndicator) loadingIndicator.style.display = "none";
            
            if (data && Array.isArray(data)) {
                items = data;
                
                // Find the highest ID to ensure new items get unique IDs
                const maxId = Math.max(...items.map(item => parseInt(item.id) || 0), 0);
                nextItemId = maxId + 1;
                
                console.log(`Loaded ${items.length} items, next ID: ${nextItemId}`);
                renderItems();
            } else {
                console.log("No items found or invalid data format, starting with empty layout");
                items = [];
                nextItemId = 1;
            }
        })
        .catch(error => {
            isDataLoading = false;
            if (loadingIndicator) loadingIndicator.style.display = "none";
            
            console.error("Error loading layout:", error);
            items = [];
            nextItemId = 1;
            
            showErrorToast(`Failed to load layout: ${error.message}`);
        });
}

// Function to get layout items from the database with caching
let cachedItemsForParent = {};

function getLayoutItems() {
    const parentId = currentHierarchyLevel === "root" ? "root" : currentHierarchyLevel;
    
    // Check cache first
    if (cachedItemsForParent[parentId]) {
        console.log(`Using cached items for parent ${parentId}`);
        return Promise.resolve(cachedItemsForParent[parentId]);
    }
    
    return fetch(`/layout/get_layout_items/?parent_id=${parentId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        cache: 'no-cache' // Ensure we get fresh data
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Failed to load layout data: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        // Store in cache
        cachedItemsForParent[parentId] = data;
        return data;
    });
}

// Clear cache for a specific parent when we make changes
function clearCache(parentId) {
    if (parentId) {
        delete cachedItemsForParent[parentId];
    } else {
        cachedItemsForParent = {}; // Clear all cache
    }
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

// Function to navigate within the hierarchy
function performExitEditMode() {
    isEditMode = false;
    
    const layoutControls = document.getElementById("layoutControls");
    const editControls = document.getElementById("editControls");
    
    if (layoutControls) layoutControls.style.display = "flex";
    if (editControls) editControls.style.display = "none";
    
    deselectAllItems();
    document.body.classList.remove("edit-mode");
    hasUnsavedChanges = false;
}