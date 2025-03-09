document.addEventListener("DOMContentLoaded", function () {
    let newX = 0, newY = 0, startX = 0, startY = 0;
    let selectedBlock = null; // Track selected block

    const layout = document.getElementById("layout");
    const addBlockBtn = document.getElementById("addBlock");
    const removeBlockBtn = document.getElementById("removeBlock");
    const saveBtn = document.getElementById("saveBlocks");
    const resetBtn = document.getElementById("resetBlocks");

    function createCard(x = 50, y = 50, id = null, imgSrc = IMAGE_SRC) {
        const card = document.createElement("img");
        card.classList.add("card");
        card.src = imgSrc; 
        card.style.top = `${y}px`;
        card.style.left = `${x}px`;
        card.style.width = "50px";
        card.style.height = "50px";
        card.style.objectFit = "cover";
        card.setAttribute("draggable", false);
        if (id) card.setAttribute("data-id", id);
        layout.appendChild(card);
        makeDraggable(card);
    
        card.addEventListener("click", function (event) {
            event.stopPropagation();
            if (selectedBlock) selectedBlock.classList.remove("selected");
            if (selectedBlock !== card) {
                selectedBlock = card;
                card.classList.add("selected");
            } else {
                selectedBlock = null;
            }
        });
    }

    function makeDraggable(card) {
        card.addEventListener("mousedown", function (e) {
            startX = e.clientX;
            startY = e.clientY;

            function mouseMove(e) {
                newX = startX - e.clientX;
                newY = startY - e.clientY;
                startX = e.clientX;
                startY = e.clientY;

                let newTop = card.offsetTop - newY;
                let newLeft = card.offsetLeft - newX;

                let maxLeft = layout.offsetWidth - card.offsetWidth;
                let maxTop = layout.offsetHeight - card.offsetHeight;

                card.style.top = `${Math.max(0, Math.min(newTop, maxTop))}px`;
                card.style.left = `${Math.max(0, Math.min(newLeft, maxLeft))}px`;
            }

            function mouseUp() {
                document.removeEventListener("mousemove", mouseMove);
                document.removeEventListener("mouseup", mouseUp);
            }

            document.addEventListener("mousemove", mouseMove);
            document.addEventListener("mouseup", mouseUp);
        });
    }

    addBlockBtn.addEventListener("click", function () {
        createCard();
    });

    removeBlockBtn.addEventListener("click", function () {
        const selectedBlocks = document.querySelectorAll(".card.selected");
        selectedBlocks.forEach(card => removeBlock(card));
    });

    removeBlockBtn.addEventListener("click", function () {
        const selectedBlocks = document.querySelectorAll(".card.selected");
        
        if (selectedBlocks.length === 0) {
            console.warn("No block selected for removal.");
            return;
        }
    
        selectedBlocks.forEach(card => {
            const blockId = card.getAttribute("data-id");
    
            if (blockId) {
                fetch(`/remove_block/${blockId}/`, {
                    method: "DELETE",
                    headers: { "X-CSRFToken": getCSRFToken() }
                })
                .then(response => {
                    if (!response.ok) throw new Error("Failed to delete block from server");
                    return response.json();
                })
                .then(() => {
                    card.remove();
                })
                .catch(error => console.error("Error removing block:", error));
            } else {
                card.remove(); // Remove block from UI if it has no ID
            }
        });
    
        selectedBlock = null; // Reset selection after removal
    });
    

    saveBtn.addEventListener("click", function () {
        const blocks = document.querySelectorAll(".card");
        let data = [];
    
        blocks.forEach(block => {
            data.push({
                id: block.getAttribute("data-id") || null,
                x: block.offsetLeft,
                y: block.offsetTop
            });
        });
    
        fetch("/layout/save_blocks/", {  // Use correct URL
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRFToken": getCSRFToken() },
            body: JSON.stringify({ blocks: data })
        })
        .then(response => response.json())
        .then(data => console.log("Saved:", data))
        .catch(error => console.error("Error saving blocks:", error));
    });
    

    resetBtn.addEventListener("click", function () {
        fetch("/layout/save_blocks/", {  // Use correct URL
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRFToken": getCSRFToken() },
            body: JSON.stringify({ blocks: [] }) // Clear all blocks
        }).then(() => location.reload())
        .catch(error => console.error("Error resetting blocks:", error));
    });
    

    function loadBlocks() {
        fetch("/layout/get_blocks/") // Use correct URL
            .then(response => response.json())
            .then(data => {
                data.blocks.forEach(block => createCard(block.x, block.y, block.id));
            })
            .catch(error => console.error("Error fetching blocks:", error));
    }

    function getCSRFToken() {
        let csrf = document.cookie.split('; ').find(row => row.startsWith('csrftoken='));
        return csrf ? csrf.split('=')[1] : "";
    }

    loadBlocks();
});
