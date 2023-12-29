const {ipcRenderer} = require('electron');

document.getElementById('your-button-id').addEventListener('click', () => {
    ipcRenderer.send('open-file-dialog-for-directory');
});

// Your existing 'duplicates-found' handler with slight modifications
ipcRenderer.on('duplicates-found', (event, obj) => {
    var duplicatesArray = obj.dups;
    const duplicatesList = document.getElementById('duplicates-list');
    duplicatesList.innerHTML = ''; // Clear existing duplicates
    if (duplicatesArray.length <= 0) {
        duplicatesList.textContent = 'No duplicates found.';
        return;
    }
    const pathSpan = document.createElement('span');
    pathSpan.textContent = "contents of {" + obj.dir + "}";
    pathSpan.classList.add('title-span');
    duplicatesList.appendChild(pathSpan);
    duplicatesArray.forEach((duplicateSet, index) => {


        // Create a container for the text and divider
        const breakLineContainer = document.createElement('div');
        breakLineContainer.classList.add('mdc-list-divider-container');

// Create the divider
        const breakLine = document.createElement('div');
        breakLine.classList.add('mdc-list-divider');
        breakLineContainer.appendChild(breakLine);

// Add text as a span element before the divider inside the container
        const textSpan = document.createElement('span');
        textSpan.textContent = '\t' + duplicateSet.length + ' duplicate found';
        breakLineContainer.insertBefore(textSpan, breakLine);

        // Append the container to the duplicatesList
        duplicatesList.appendChild(breakLineContainer);


        const block = document.createElement('div');
        block.classList.add(`duplicate-block-${index}`);

        // ...create a list, loop and call createListItem for each file...

        const fileList = document.createElement('ul');
        duplicateSet.forEach(filePath => {
            fileList.appendChild(createListItem(filePath, obj.dir, `duplicate-block-${index}`));
        });

        block.appendChild(fileList);
        duplicatesList.appendChild(block);
    });
});

// Function to create a delete button for each file
function createDeleteButton(filePath) {
    let deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.classList.add('delete-button');
    deleteButton.onclick = function () {
        ipcRenderer.send('delete-file', filePath);
    };
    return deleteButton;
}

// Listen for the 'file-deleted' reply from main process
ipcRenderer.on('file-deleted', (event, filePath, blockSelector) => {
    const listItem = document.querySelector(`li[data-filepath="${filePath}"]`);
    if (listItem) {
        listItem.className='deleted-list-item'
        let deleteButton = listItem.getElementById('delete-button');
        deleteButton.textContent = 'DELETED'
        deleteButton.disabled = true;
        listItem.remove();
    }

    // Call updateDuplicateBlock to check if the whole block should be removed
    updateDuplicateBlock(blockSelector);
});

// Listen for the 'file-deletion-error' to handle any potential error
ipcRenderer.on('file-deletion-error', (event, errorMessage, failedPath) => {
    console.error(`Error deleting file ${failedPath}: ${errorMessage}`);
    // Display the error message to the user
});

// This function is called after each file deletion to refresh the UI block if needed
function updateDuplicateBlock(blockSelector) {
    console.log("blockSelector:", blockSelector); // See what selector is received
    const block = document.querySelector(`.${blockSelector}`);
    console.log("block:", block); // Confirm the block is found

    if (block) {
        const items = block.querySelectorAll('li');
        console.log("items length:", items.length); // Confirm the items are found and the length is expected

        if (items.length <= 1) {
            block.remove();
            console.log(`Removed block with selector: .${blockSelector}`);
        }
    } else {
        console.error(`Block not found for selector .${blockSelector}`);
    }
}

// This function creates a list item to represent each file
function createListItem(filePath, dir, blockSelector) {
    const item = document.createElement('li');
    item.setAttribute('data-filepath', filePath);
    item.classList.add('card');
    const textSpan = document.createElement('span');
    textSpan.textContent = filePath.replace(dir, "");
    textSpan.classList.add('card-content');
    item.appendChild(textSpan);

    // Create and append the delete button
    const deleteBtn = createDeleteButton(filePath, blockSelector);
    item.appendChild(deleteBtn);

    return item;
}

// Function to create a delete button for each file
function createDeleteButton(filePath, blockSelector) {
    let deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.classList.add('delete-button');
    deleteButton.onclick = function () {
        ipcRenderer.send('delete-file', filePath, blockSelector);
    };
    return deleteButton;
}


ipcRenderer.on('setup-progress-bar', () => {
    const progressBar = document.getElementById('progress-bar');
    progressBar.value = 0; // Reset progress bar at start
    progressBar.style.visibility = 'visible';
});

ipcRenderer.on('update-progress-bar', (event, data) => {
    const progressBar = document.getElementById('progress-bar');
    progressBar.max = data.totalFiles; // Set the max value for the progress bar
    progressBar.value = data.processedFiles; // Update progress based on the number of files processed
});

ipcRenderer.on('hide-progress-bar', () => {
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.visibility = 'hidden'; // Hide the progress bar when done
});
