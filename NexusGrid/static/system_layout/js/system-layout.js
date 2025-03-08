const gridContainer = document.getElementById("gridContainer");
const addBlockButton = document.getElementById("addBlock");
const gridSize = 50;

function makeDraggable(block) {
    let offsetX = 0, offsetY = 0, startX = 0, startY = 0;

    block.addEventListener("mousedown", (e) => {
        if (e.target.classList.contains("remove-btn")) return;

        startX = e.clientX;
        startY = e.clientY;
        offsetX = block.offsetLeft;
        offsetY = block.offsetTop;

        document.addEventListener("mousemove", moveBlock);
        document.addEventListener("mouseup", stopMoving);
    });

    function moveBlock(e) {
        let x = offsetX + (e.clientX - startX);
        let y = offsetY + (e.clientY - startY);

        x = Math.round(x / gridSize) * gridSize;
        y = Math.round(y / gridSize) * gridSize;

        block.style.left = `${x}px`;
        block.style.top = `${y}px`;
    }

    function stopMoving(e) {
        document.removeEventListener("mousemove", moveBlock);
        document.removeEventListener("mouseup", stopMoving);

        fetch(`/update_block/${block.dataset.id}/?x=${block.style.left.replace("px", "")}&y=${block.style.top.replace("px", "")}`)
            .then(response => response.json());
    }
}

document.querySelectorAll(".block").forEach(makeDraggable);

addBlockButton.addEventListener("click", () => {
    fetch('/add_block/', { method: 'POST' })
        .then(response => response.json())
        .then(block => {
            const newBlock = document.createElement("div");
            newBlock.classList.add("block");
            newBlock.dataset.id = block.id;
            newBlock.style.left = "0px";
            newBlock.style.top = "0px";
            newBlock.innerHTML = `${block.id} <div class="remove-btn" onclick="removeBlock(${block.id})">×</div>`;

            gridContainer.appendChild(newBlock);
            makeDraggable(newBlock);const gridContainer = document.getElementById("gridContainer");
            const addBlockButton = document.getElementById("addBlock");
            const gridSize = 50;
            
            function makeDraggable(block) {
                let offsetX = 0, offsetY = 0, startX = 0, startY = 0;
            
                block.addEventListener("mousedown", (e) => {
                    if (e.target.classList.contains("remove-btn")) return;
            
                    startX = e.clientX;
                    startY = e.clientY;
                    offsetX = block.offsetLeft;
                    offsetY = block.offsetTop;
            
                    document.addEventListener("mousemove", moveBlock);
                    document.addEventListener("mouseup", stopMoving);
                });
            
                function moveBlock(e) {
                    let x = offsetX + (e.clientX - startX);
                    let y = offsetY + (e.clientY - startY);
            
                    x = Math.round(x / gridSize) * gridSize;
                    y = Math.round(y / gridSize) * gridSize;
            
                    block.style.left = `${x}px`;
                    block.style.top = `${y}px`;
                }
            
                function stopMoving() {
                    document.removeEventListener("mousemove", moveBlock);
                    document.removeEventListener("mouseup", stopMoving);
            
                    fetch(`/update_block/${block.dataset.id}/?x=${parseInt(block.style.left)}&y=${parseInt(block.style.top)}`)
                        .then(response => response.json())
                        .catch(error => console.error("Error updating block position:", error));
                }
            }
            
            document.querySelectorAll(".block").forEach(makeDraggable);
            
            // Event listener for adding blocks
            addBlockButton.addEventListener("click", () => {
                fetch('/add_block/', { method: 'POST' })
                    .then(response => response.json())
                    .then(block => {
                        const newBlock = document.createElement("div");
                        newBlock.classList.add("block");
                        newBlock.dataset.id = block.id;
                        newBlock.style.left = "0px";
                        newBlock.style.top = "0px";
                        newBlock.innerHTML = `${block.id} <div class="remove-btn" data-id="${block.id}">×</div>`;
            
                        gridContainer.appendChild(newBlock);
                        makeDraggable(newBlock);
                    })
                    .catch(error => console.error("Error adding block:", error));
            });
            
            // Event delegation for removing blocks
            gridContainer.addEventListener("click", (e) => {
                if (e.target.classList.contains("remove-btn")) {
                    let blockId = e.target.dataset.id;
                    fetch(`/remove_block/${blockId}/`, { method: 'POST' })
                        .then(() => {
                            document.querySelector(`.block[data-id='${blockId}']`).remove();
                        })
                        .catch(error => console.error("Error removing block:", error));
                }
            });
            
        });
});

function removeBlock(blockId) {
    fetch(`/remove_block/${blockId}/`, { method: 'POST' })
        .then(() => {
            document.querySelector(`.block[data-id='${blockId}']`).remove();
        });
}
