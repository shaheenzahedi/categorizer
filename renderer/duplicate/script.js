const {ipcRenderer, shell} = require('electron');
const path = require('path');

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
    const deleteAllButton = document.createElement('button');
    deleteAllButton.classList.add('delete-selected');
    deleteAllButton.textContent = 'Delete Selected';
// Create an array to store the checked items with block number
    const checkedItems = [];

// Create an array to store the unchecked items with block number
    const uncheckedItems = [];

// Event listener for the "deleteAll" button
    deleteAllButton.addEventListener('click', () => {
        // Loop through all the checkboxes in the duplicate blocks
        duplicatesArray.forEach((duplicateSet, index) => {
            const checkboxes = document.querySelectorAll(`.duplicate-block-${index} input[type="checkbox"]`);
            checkboxes.forEach((checkbox) => {
                const filePath = checkbox.parentNode.getAttribute('data-filepath');
                const isChecked = checkbox.checked;

                // Add the file path and block number to the appropriate array based on the checkbox state
                if (isChecked) {
                    checkedItems.push({ path:filePath, blockNumber: index });
                } else {
                    uncheckedItems.push({ path: filePath, blockNumber: index });
                }
            });
        });
        checkedItems.length = 0;
        uncheckedItems.length = 0;
    });

    duplicatesList.appendChild(deleteAllButton);
// Create a button for selecting all checkboxes
    const selectAllButton = document.createElement('button');
    selectAllButton.classList.add('select-all');
    selectAllButton.textContent = 'Select All';

// Create a button for deselecting all checkboxes
    const deselectAllButton = document.createElement('button');
    deselectAllButton.classList.add('deselect-all');
    deselectAllButton.textContent = 'Deselect All';

// Event listener for the "select all" button
    selectAllButton.addEventListener('click', () => {
        const duplicateBlocks = document.querySelectorAll('[class^="duplicate-block-"]'); // Selects all elements whose class attribute value begins with "duplicate-block-"
        duplicateBlocks.forEach((block) => {
            const checkboxes = block.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach((checkbox) => {
                checkbox.checked = true;
            });
        });
    });

// Event listener for the "deselect all" button
    deselectAllButton.addEventListener('click', () => {
        const duplicateBlocks = document.querySelectorAll('[class^="duplicate-block-"]'); // Selects all elements whose class attribute value begins with "duplicate-block-"
        duplicateBlocks.forEach((block) => {
            const checkboxes = block.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach((checkbox) => {
                checkbox.checked = false;
            });
        });
    });

    duplicatesList.appendChild(selectAllButton);
    duplicatesList.appendChild(deselectAllButton);

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
        textSpan.textContent = '\t block number:\t'+ (index+1);
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

// Listen for the 'file-deleted' reply from main process
ipcRenderer.on('file-deleted', (event, filePath, blockSelector) => {
	const listItem = document.querySelector(`li[data-filepath="${CSS.escape(filePath)}"]`);
    if (listItem) {
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

function createListItem(filePath, dir, blockSelector) {
    const item = document.createElement('li');
    item.setAttribute('data-filepath', filePath);
    item.classList.add('card');

    // Create the label

    // Create the checkbox
    const checkbox = document.createElement('input');
    checkbox.setAttribute('id', 'checkbox-' + filePath); // Set a unique id for each checkbox
    checkbox.type = 'checkbox';
    checkbox.checked=true;
    checkbox.addEventListener('change', (event) => {
        const checkboxId = event.target.getAttribute('id');
        const isChecked = event.target.checked;
        console.log('the id and isChecked', checkboxId, isChecked);
    });
    item.appendChild(checkbox);

    const textLink = document.createElement('a');
    textLink.textContent = filePath.replace(dir, "");
    textLink.href = '#';  // Set a placeholder href value or replace it with a meaningful value
    textLink.addEventListener('click', (event) => {
        event.preventDefault(); // Prevent the default link behavior
        openExplorer(filePath);
    });
    textLink.classList.add('card-content');
    const label = document.createElement('label');
    label.setAttribute('for', 'checkbox-' + filePath);

    label.appendChild(textLink);

    item.appendChild(label);

    // Create and append the delete button with an icon
    let deleteButton = document.createElement('button');
    deleteButton.classList.add('delete-button');
    deleteButton.onclick = function () {
        ipcRenderer.send('delete-file', filePath);
    };

    const deleteIconElement = document.createElement('i');
    deleteIconElement.classList.add('fas', 'fa-trash'); // Adjust the class for the specific delete icon
    deleteButton.appendChild(deleteIconElement);
    item.appendChild(deleteButton);
    return item;
}
function openExplorer(directory) {
    // Use Electron's shell module to open the directory in the system's file explorer
    shell.showItemInFolder(directory);
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
