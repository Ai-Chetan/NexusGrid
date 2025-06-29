document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements - Cached for performance
    const elements = {
        layoutGrid: document.getElementById('layout'),
        editLayoutButton: document.getElementById('editLayoutButton'),
        backButton: document.getElementById('backButton'),
        layoutControls: document.getElementById('layoutControls'),
        editControls: document.getElementById('editControls'),
        addBlockButton: document.getElementById('addBlockButton'),
        removeBlockButton: document.getElementById('removeBlockButton'),
        resetLayoutButton: document.getElementById('resetLayoutButton'),
        saveLayoutButton: document.getElementById('saveLayoutButton'),
        cancelEditButton: document.getElementById('cancelEditButton'),
        confirmTitle: document.getElementById('confirmTitle'),
        confirmMessage: document.getElementById('confirmMessage'),
        confirmButton: document.getElementById('confirmButton'),
        saveNameButton: document.getElementById('saveNameButton'),
        submitFaultButton: document.getElementById('submitFault')
    };
    
    // Bootstrap Modals
    const modals = {
        rename: new bootstrap.Modal(document.getElementById('renameModal')),
        confirm: new bootstrap.Modal(document.getElementById('confirmModal'))
    };
    
    // State Management
    const state = {
        layoutItems: [],
        originalLayout: [],
        selectedItem: null,
        editMode: false,
        hasChanges: false,
        isDragging: false,
        draggedItem: null,
        dragState: { startX: 0, startY: 0, startPosX: 0, startPosY: 0 }
    };
    
    // Item type definitions
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

    // Utility Functions
    const utils = {
        getCSRFToken() {
            const csrfToken = document.cookie
                .split('; ')
                .find(row => row.startsWith('csrftoken='))
                ?.split('=')[1];
            return csrfToken || '';
        },

        formatType(type) {
            return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        },

        showError(message) {
            console.error(message);
            alert(message);
        },

        showConfirmation(title, message, onConfirm) {
            elements.confirmTitle.textContent = title;
            elements.confirmMessage.textContent = message;
            elements.confirmButton.onclick = function() {
                onConfirm();
                modals.confirm.hide();
            };
            modals.confirm.show();
        },

        generateTempId() {
            return 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
    };

    // Grid Utilities
    const gridUtils = {
        getDimensions() {
            const gridRect = elements.layoutGrid.getBoundingClientRect();
            const cellWidth = gridRect.width / 12;
            const cellHeight = gridRect.height / Math.max(10, this.getMaxHeight());
            return { cellWidth, cellHeight, gridRect };
        },

        getMaxHeight() {
            let maxY = 0;
            state.layoutItems.forEach(item => {
                const bottomY = item.position_y + item.height;
                if (bottomY > maxY) maxY = bottomY;
            });
            return Math.max(10, maxY);
        },

        findEmptyPosition(width, height) {
            const maxY = this.getMaxHeight() + height + 5;
            const grid = Array(maxY).fill().map(() => Array(12).fill(false));
            
            // Mark occupied cells
            state.layoutItems.forEach(item => {
                for (let y = item.position_y; y < item.position_y + item.height; y++) {
                    for (let x = item.position_x; x < item.position_x + item.width; x++) {
                        if (y < grid.length && x < grid[0].length) {
                            grid[y][x] = true;
                        }
                    }
                }
            });
            
            // Find first empty position
            for (let y = 0; y < grid.length; y++) {
                for (let x = 0; x <= grid[0].length - width; x++) {
                    let canFit = true;
                    
                    for (let dy = 0; dy < height && canFit; dy++) {
                        for (let dx = 0; dx < width && canFit; dx++) {
                            if (y + dy >= grid.length || x + dx >= grid[0].length || grid[y + dy][x + dx]) {
                                canFit = false;
                            }
                        }
                    }
                    
                    if (canFit) return { x, y };
                }
            }
            
            return { x: 0, y: 0 };
        }
    };

    // API Functions
    const api = {
        async fetchLayoutItems() {
            try {
                const response = await fetch(`/layout/get_layout_items/?parent_id=${PARENT_ID}`);
                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();
                
                state.layoutItems = data.items;
                state.originalLayout = JSON.parse(JSON.stringify(data.items));
                renderer.renderLayout();
            } catch (error) {
                utils.showError('Failed to load layout items');
            }
        },

        async getParent() {
            try {
                const response = await fetch(`/layout/get_parent/?item_id=${PARENT_ID}`);
                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();
                
                if (data.parent_id) {
                    window.location.href = `/layout/${data.parent_id}/`;
                } else {
                    window.location.href = '/layout/';
                }
            } catch {
                window.location.href = '/layout/';
            }
        },

        async saveLayout() {
            const itemsToSave = [];
            const itemsToCreate = [];
            const itemsToUpdate = [];
            const itemsToDelete = [];

            // Separate items by operation needed
            state.layoutItems.forEach(item => {
                if (item.id && item.id.toString().startsWith('temp_')) {
                    // New item to create
                    itemsToCreate.push(item);
                } else if (item.id) {
                    // Existing item to update position
                    const original = state.originalLayout.find(orig => orig.id === item.id);
                    if (!original || original.position_x !== item.position_x || 
                        original.position_y !== item.position_y || original.name !== item.name) {
                        itemsToUpdate.push(item);
                    }
                }
            });

            // Check for deleted items
            state.originalLayout.forEach(original => {
                if (!state.layoutItems.find(item => item.id === original.id)) {
                    itemsToDelete.push(original);
                }
            });

            try {
                // Process all operations
                await Promise.all([
                    ...itemsToCreate.map(item => this.createItem(item)),
                    ...itemsToUpdate.map(item => this.updateItem(item)),
                    ...itemsToDelete.map(item => this.deleteItem(item.id, false))
                ]);

                // Refresh from server to get real IDs
                await this.fetchLayoutItems();
                state.hasChanges = false;
                editMode.exit();
            } catch (error) {
                utils.showError('Failed to save layout');
            }
        },

        async createItem(item) {
            const data = {
                name: item.name,
                item_type: item.item_type,
                parent_id: PARENT_ID,
                position_x: item.position_x,
                position_y: item.position_y,
                width: item.width,
                height: item.height
            };

            const response = await fetch('/layout/add_layout_item/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': utils.getCSRFToken()
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('Failed to create item');
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message || 'Error creating item');
            return result;
        },

        async updateItem(item) {
            const updateData = {
                name: item.name,
                position_x: item.position_x,
                position_y: item.position_y
            };

            const response = await fetch(`/layout/update_layout_item/${item.id}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': utils.getCSRFToken()
                },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) throw new Error('Failed to update item');
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message || 'Error updating item');
            return result;
        },

        async deleteItem(itemId, removeFromState = true) {
            const response = await fetch(`/layout/delete_layout_item/${itemId}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': utils.getCSRFToken()
                },
                body: JSON.stringify({})
            });

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error('Invalid JSON response');
            }

            if (data.status !== 'success') {
                throw new Error(data.message || 'Error deleting item');
            }

            if (removeFromState) {
                state.layoutItems = state.layoutItems.filter(item => item.id != itemId);
                renderer.renderLayout();
                state.hasChanges = true;
                itemSelection.deselect();
            }

            return data;
        },

        async submitFaultReport(data) {
            const response = await fetch('/report_fault/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': utils.getCSRFToken()
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('Network response was not ok');
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message || 'Error submitting fault report');
            return result;
        }
    };

    // Renderer
    const renderer = {
        renderLayout() {
            elements.layoutGrid.innerHTML = '';
            state.layoutItems.forEach(item => {
                const itemElement = this.createItemElement(item);
                elements.layoutGrid.appendChild(itemElement);
            });
        },

        createItemElement(item) {
            const itemElement = document.createElement('div');
            
            let extraClass = '';
            if (['computer', 'server', 'network_switch', 'router', 'printer', 'ups', 'rack'].includes(item.item_type) && item.status) {
                extraClass = ` ${item.status}`;
            }
            
            itemElement.className = `layout-item item-${item.item_type}${extraClass}`;
            itemElement.dataset.id = item.id;
            itemElement.dataset.type = item.item_type;
            
            itemElement.style.gridColumn = `${item.position_x + 1} / span ${item.width}`;
            itemElement.style.gridRow = `${item.position_y + 1} / span ${item.height}`;
            
            const typeInfo = itemTypes[item.item_type] || { icon: 'fa-question' };
            
            itemElement.innerHTML = `
                <div class="item-icon"><i class="fas ${typeInfo.icon}"></i></div>
                <div class="item-name">${item.name}</div>
                <div class="item-type">${utils.formatType(item.item_type)}</div>
            `;
            
            return itemElement;
        }
    };

    // Item Selection
    const itemSelection = {
        select(itemElement) {
            if (state.selectedItem) {
                state.selectedItem.classList.remove('selected');
            }
            
            itemElement.classList.add('selected');
            state.selectedItem = itemElement;
            elements.removeBlockButton.disabled = false;
        },

        deselect() {
            if (state.selectedItem) {
                state.selectedItem.classList.remove('selected');
                state.selectedItem = null;
            }
            elements.removeBlockButton.disabled = true;
        }
    };

    // Edit Mode Management
    const editMode = {
        enter() {
            state.editMode = true;
            state.hasChanges = false;
            state.originalLayout = JSON.parse(JSON.stringify(state.layoutItems));
            
            elements.layoutControls.style.display = 'none';
            elements.editControls.style.display = 'flex';
            elements.layoutGrid.classList.add('edit-mode');
        },

        exit() {
            state.editMode = false;
            
            if (state.hasChanges) {
                state.layoutItems = JSON.parse(JSON.stringify(state.originalLayout));
                renderer.renderLayout();
            }
            
            state.hasChanges = false;
            elements.layoutControls.style.display = 'flex';
            elements.editControls.style.display = 'none';
            elements.layoutGrid.classList.remove('edit-mode');
            itemSelection.deselect();
        },

        reset() {
            state.layoutItems = JSON.parse(JSON.stringify(state.originalLayout));
            renderer.renderLayout();
            state.hasChanges = false;
        }
    };

    // Item Management
    const itemManager = {
        add(itemType) {
            const typeInfo = itemTypes[itemType] || { icon: 'fa-question', sizeX: 1, sizeY: 1 };
            const count = state.layoutItems.filter(item => item.item_type === itemType).length + 1;
            const defaultName = `${utils.formatType(itemType)} ${count}`;
            const position = gridUtils.findEmptyPosition(typeInfo.sizeX, typeInfo.sizeY);
            
            const newItem = {
                id: utils.generateTempId(), // Temporary ID
                name: defaultName,
                item_type: itemType,
                position_x: position.x,
                position_y: position.y,
                width: typeInfo.sizeX,
                height: typeInfo.sizeY
            };
            
            state.layoutItems.push(newItem);
            renderer.renderLayout();
            state.hasChanges = true;
        },

        rename(itemId, newName) {
            const itemIndex = state.layoutItems.findIndex(i => i.id == itemId);
            if (itemIndex !== -1) {
                state.layoutItems[itemIndex].name = newName;
                renderer.renderLayout();
                state.hasChanges = true;
            }
        },

        delete(itemId) {
            // Only delete from server if it's not a temporary item
            state.layoutItems = state.layoutItems.filter(item => item.id != itemId);
            renderer.renderLayout();
            state.hasChanges = true;
            itemSelection.deselect();
        }
    };

    // Drag and Drop
    const dragDrop = {
        setup() {
            elements.layoutGrid.addEventListener('mousedown', this.handleMouseDown.bind(this));
            document.addEventListener('mousemove', this.handleMouseMove.bind(this));
            document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        },

        handleMouseDown(e) {
            if (!state.editMode) return;
            
            const itemElement = e.target.closest('.layout-item');
            if (!itemElement) return;
            
            itemSelection.select(itemElement);
            
            state.draggedItem = itemElement;
            state.isDragging = true;
            
            state.dragState.startX = e.clientX;
            state.dragState.startY = e.clientY;
            
            const item = state.layoutItems.find(i => i.id == state.draggedItem.dataset.id);
            state.dragState.startPosX = item.position_x;
            state.dragState.startPosY = item.position_y;
            
            state.draggedItem.classList.add('dragging');
            e.preventDefault();
        },

        handleMouseMove(e) {
            if (!state.isDragging || !state.draggedItem) return;
            
            const { cellWidth, cellHeight } = gridUtils.getDimensions();
            const deltaX = Math.round((e.clientX - state.dragState.startX) / cellWidth);
            const deltaY = Math.round((e.clientY - state.dragState.startY) / cellHeight);
            
            const itemId = state.draggedItem.dataset.id;
            const itemIndex = state.layoutItems.findIndex(i => i.id == itemId);
            if (itemIndex === -1) return;
            
            const newPosX = Math.max(0, Math.min(state.dragState.startPosX + deltaX, 12 - state.layoutItems[itemIndex].width));
            const newPosY = Math.max(0, state.dragState.startPosY + deltaY);
            
            if (newPosX !== state.layoutItems[itemIndex].position_x || newPosY !== state.layoutItems[itemIndex].position_y) {
                state.layoutItems[itemIndex].position_x = newPosX;
                state.layoutItems[itemIndex].position_y = newPosY;
                
                state.draggedItem.style.gridColumn = `${newPosX + 1} / span ${state.layoutItems[itemIndex].width}`;
                state.draggedItem.style.gridRow = `${newPosY + 1} / span ${state.layoutItems[itemIndex].height}`;
                
                state.hasChanges = true;
            }
        },

        handleMouseUp() {
            if (state.isDragging && state.draggedItem) {
                state.draggedItem.classList.remove('dragging');
                state.draggedItem = null;
                state.isDragging = false;
            }
        }
    };

    // Event Handlers
    const eventHandlers = {
        setupAll() {
            // Layout item click
            elements.layoutGrid.addEventListener('click', (e) => {
                const itemElement = e.target.closest('.layout-item');
                if (!itemElement) return;
                
                const itemId = itemElement.dataset.id;
                const itemType = itemElement.dataset.type;
                
                if (state.editMode) {
                    itemSelection.select(itemElement);
                } else {
                    if (itemType === 'computer') {
                        window.location.href = `/layout/details/${itemId}/`;
                    } else {
                        window.location.href = `/layout/${itemId}/`;
                    }
                }
            });

            // Double click to rename
            elements.layoutGrid.addEventListener('dblclick', (e) => {
                if (!state.editMode) return;
                
                const itemElement = e.target.closest('.layout-item');
                if (!itemElement) return;
                
                const itemId = itemElement.dataset.id;
                const item = state.layoutItems.find(i => i.id == itemId);
                
                if (item) {
                    document.getElementById('itemId').value = itemId;
                    document.getElementById('itemName').value = item.name;
                    modals.rename.show();
                }
            });

            // Control buttons
            elements.editLayoutButton.addEventListener('click', () => editMode.enter());
            elements.backButton.addEventListener('click', () => api.getParent());
            
            // Add item dropdown
            document.querySelectorAll('.dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const itemType = e.target.dataset.type;
                    itemManager.add(itemType);
                });
            });

            // Edit controls
            elements.removeBlockButton.addEventListener('click', () => {
                if (!state.selectedItem) {
                    utils.showError('No item selected for deletion');
                    return;
                }
                
                utils.showConfirmation(
                    'Confirm Deletion',
                    'Are you sure you want to remove this item? This action cannot be undone and will remove all child items as well.',
                    () => itemManager.delete(state.selectedItem.dataset.id)
                );
            });

            elements.resetLayoutButton.addEventListener('click', () => {
                utils.showConfirmation(
                    'Reset Layout',
                    'Are you sure you want to reset the layout? Your changes will be lost.',
                    () => editMode.reset()
                );
            });

            elements.saveLayoutButton.addEventListener('click', () => api.saveLayout());

            elements.cancelEditButton.addEventListener('click', () => {
                if (state.hasChanges) {
                    utils.showConfirmation(
                        'Discard Changes',
                        'You have unsaved changes. Are you sure you want to exit edit mode without saving?',
                        () => editMode.exit()
                    );
                } else {
                    editMode.exit();
                }
            });

            // Modal save
            elements.saveNameButton.addEventListener('click', () => {
                const itemId = document.getElementById('itemId').value;
                const newName = document.getElementById('itemName').value;
                
                if (newName.trim()) {
                    itemManager.rename(itemId, newName);
                    modals.rename.hide();
                }
            });

            // Fault report
            if (elements.submitFaultButton) {
                elements.submitFaultButton.addEventListener('click', this.handleFaultSubmission);
            }

            // Prevent page unload with unsaved changes
            window.addEventListener('beforeunload', (e) => {
                if (state.editMode && state.hasChanges) {
                    e.preventDefault();
                    e.returnValue = '';
                }
            });
        },

        async handleFaultSubmission() {
            const faultTitle = document.getElementById("faultTitle").value;
            const faultDescription = document.getElementById("faultDescription").value;
            
            const USER_ID = window.USER_ID || null;
            const SYSTEM_NAME = PARENT_ID || null;
            
            if (!faultTitle || !faultDescription) {
                alert("Please fill out both the title and description.");
                return;
            }
            
            if (!USER_ID) {
                alert("User not authenticated.");
                return;
            }

            const data = {
                title: faultTitle,
                description: faultDescription,
                system_name: SYSTEM_NAME,
                reported_by: USER_ID,
                fault_type: "Hardware",
                status: "Pending"
            };

            try {
                await api.submitFaultReport(data);
                alert("Fault report submitted successfully!");
                
                document.getElementById("faultTitle").value = '';
                document.getElementById("faultDescription").value = '';
                
                const modal = bootstrap.Modal.getInstance(document.getElementById('newFaultModal'));
                if (modal) modal.hide();
            } catch (error) {
                utils.showError("Failed to submit fault report.");
            }
        }
    };

    // Initialize Application
    function init() {
        api.fetchLayoutItems();
        eventHandlers.setupAll();
        dragDrop.setup();
        elements.removeBlockButton.disabled = true;
    }

    // Start the application
    init();
});