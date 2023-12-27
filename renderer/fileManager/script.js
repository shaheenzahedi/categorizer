const {ipcRenderer} = require('electron');
const Dialogs = require('dialogs')

let categoryContainer;
document.addEventListener('DOMContentLoaded', async (event) => {
    const dialogs = Dialogs()
    // Request the data from NeDB when the DOM is fully loaded
    let databaseSelected = await ipcRenderer.invoke('get-database-selected');
    while (!databaseSelected) {
        alert('Database is not selected please select the database...');
        databaseSelected = await ipcRenderer.invoke('select-database');
    }
    const initialCategories = await ipcRenderer.invoke('find-category-by-parent', null);
    categoryContainer = document.getElementById('category-container');
    if (initialCategories.length <= 0) {
        const noCategoryLabel = document.createElement('label');
        noCategoryLabel.textContent = 'There are no categories yet!';
        const noCategoryAddButton = document.createElement('button')
        noCategoryAddButton.textContent = 'Add first category';
        noCategoryAddButton.onclick = ev => {
            const dialogs = Dialogs()
            dialogs.prompt('Please enter a category:', ok => {
                addCategory(ok, null)
            })
        };

        categoryContainer.append(noCategoryLabel, noCategoryAddButton);
    } else {
        categoryContainer.innerHTML = '';
        const comboBoxes = await fillContainerViaParentId(null); // start with the top-level categories (parentId = null)
        categoryContainer.append(...comboBoxes); // Use the spread operator to append all combo boxes
    }

});

async function addCategory(name, parentId) {
    if (name) {
        await ipcRenderer.invoke('add-category', {name: name, parentId: parentId})
            .then(async value => {
                categoryContainer.innerHTML = '';
                const comboBoxes = await fillContainerViaParentId(parentId); // start with the top-level categories (parentId = null)
                categoryContainer.append(...comboBoxes); // Use the spread operator to append all combo boxes
            });
    }
}

async function fillContainerViaParentId(parentId) {
    if (parentId === '0') {
        return Array.empty();
    }
    let comboBoxes = []; // Initialize the array to collect combo boxes
    try {
        const categories = await ipcRenderer.invoke('find-category-by-parent', parentId);
        const comboBox = document.createElement('select');
        comboBox.className = 'category-combo'; // Assign a class for styling and identification
        comboBox.setAttribute('data-parent-id', parentId); // Store the parentId as a data attribute
        if (categories.length > 0) {
            const option = document.createElement('option');
            option.value = 0;
            option.textContent = 'Unselected';
            comboBox.appendChild(option); // Add the category as an option in the comboBox
        }
        for (const category of categories) {
            const option = document.createElement('option');
            option.value = category._id;
            option.textContent = category.name;
            comboBox.appendChild(option); // Add the category as an option in the comboBox
        }
        const addInThisClass = document.createElement('button');
        addInThisClass.textContent = 'Add in this class';
        addInThisClass.addEventListener('click', () => {
            const dialogs = Dialogs()
            dialogs.prompt('Please enter a category:', ok => {
                addCategory(ok, parentId);
            })
        });
        const addInSubClass = document.createElement('button');
        addInSubClass.textContent = 'Add in sub class';
        addInSubClass.addEventListener('click', () => {
            const comboBox = document.querySelector(`[data-parent-id='${parentId}']`);
            const selectedValue = comboBox.value; // The value of the selected <option>
            if (selectedValue === '0') return;
            const dialogs = Dialogs()
            dialogs.prompt('Please enter a category:', ok => {
                addCategory(ok, selectedValue);
            })
        });
        comboBox.addEventListener('change', async (event) => {
            let categoryId = event.target.value;
            const categories = await ipcRenderer.invoke('find-category-by-parent', categoryId);
            if (categories.length > 0) {
                categoryContainer.innerHTML = '';
                const comboBoxes = await fillContainerViaParentId(categoryId);
                categoryContainer.append(...comboBoxes); // Use the spread operator to append all combo boxes
            } else {
                categoryContainer.innerHTML = '';
                const comboBoxes = await fillContainerViaParentId(parentId);
                const selectElement = [...comboBoxes].reverse().find(element => element.tagName === 'SELECT');
                if (selectElement) {
                    const options = selectElement.options;
                    for (let option of options) {
                        if (option.value === categoryId) {
                            option.selected = true; // This will select the option by default
                            break; // Exit the loop as we have found and selected the option
                        }
                    }
                }
                categoryContainer.append(...comboBoxes); // Use the spread operator to append all combo boxes
            }
        });
        comboBoxes.push(document.createElement('br'));
        comboBoxes.push(comboBox);
        comboBoxes.push(addInThisClass);
        comboBoxes.push(addInSubClass);
        const parent = parentId === null ? null : await ipcRenderer.invoke('find-category-by-id', parentId);
        if (parent != null && parent.length > 0) {
            let items = await fillContainerViaParentId(parent[0].parentId);
            const selectElement = [...items].reverse().find(element => element.tagName === 'SELECT');
            if (selectElement) {
                const options = selectElement.options;
                for (let option of options) {
                    if (option.value === parentId) {
                        option.selected = true; // This will select the option by default
                        break; // Exit the loop as we have found and selected the option
                    }
                }
            }
            comboBoxes = [...items, ...comboBoxes];
            return comboBoxes;
        }

    } catch (error) {
        console.error('Error finding categories by parent:', error);
    }

    return comboBoxes; // Return the array of combo boxes
}