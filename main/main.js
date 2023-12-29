const {app, BrowserWindow, ipcMain, dialog} = require('electron');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const crypto = require('crypto');
const {promisify} = require('util');
const NeDB = require("nedb");
const readDir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlinkAsync = promisify(fs.unlink);

let win;
let db = null;

function createWindow() {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    win.loadFile('renderer/index.html');
}
ipcMain.on('open-file-dialog', (event) => {
    dialog.showOpenDialog({
        properties: ['openFile']
    }).then(result => {
        if (!result.canceled) {
            event.sender.send('selected-file', result.filePaths);
        }
    }).catch(err => {
        console.log(err);
    });
});
app.whenReady().then(createWindow);

ipcMain.on('open-file-dialog-for-directory', async (event) => {
    const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory']
    });
    if (result.canceled === false) {
        const directoryPath = result.filePaths[0];
        const win = BrowserWindow.fromWebContents(event.sender);
        await scanDirectory(directoryPath, win);
    }
});
ipcMain.on('delete-file', async (event, filePath, blockSelector) => {

    try {
        // Perform the file deletion asynchronously
        await unlinkAsync(filePath);

        // No error, so file deletion was successful.
        // Notify the renderer process of the success and include the blockSelector.
        event.reply('file-deleted', filePath, blockSelector);
    } catch (error) {

        // Log the error in the console of the Main process.
        console.error(`Failed to delete ${filePath}: ${error}`);

        // Notify the renderer process of the error and include the blockSelector.
        event.reply('file-deletion-error', error.message, filePath, blockSelector);
    }
});

async function scanDirectory(directoryPath, win) {
    let filesChecksumMap = {}; // Maps checksums to file paths
    let duplicates = []; // Holds arrays of duplicates
    let totalFiles = 0; // Total number of files to track progress
    let processedFiles = 0; // Number of files processed to update progress

    // Function to count all files before starting the processing
    async function countFiles(directory) {
        const items = await fsPromises.readdir(directory);
        for (const item of items) {
            const itemPath = path.join(directory, item);
            const itemStats = await fsPromises.stat(itemPath);
            if (itemStats.isDirectory()) {
                await countFiles(itemPath);
            } else {
                totalFiles++;
            }
        }
    }

    // Tell renderer to set up the progress bar and start counting files
    win.webContents.send('setup-progress-bar');
    await countFiles(directoryPath);

    async function processDirectory(directory) {
        const items = await fsPromises.readdir(directory);
        for (const item of items) {
            const itemPath = path.join(directory, item);
            const itemStats = await fsPromises.stat(itemPath);
            if (itemStats.isDirectory()) {
                await processDirectory(itemPath);
            } else {
                const checksum = await generateChecksum(itemPath);
                if (filesChecksumMap[checksum]) {
                    if (filesChecksumMap[checksum].length === 1) {
                        duplicates.push(filesChecksumMap[checksum]);
                    }
                    filesChecksumMap[checksum].push(itemPath);
                } else {
                    filesChecksumMap[checksum] = [itemPath];
                }
                processedFiles++;
                win.webContents.send('update-progress-bar', {processedFiles, totalFiles});
            }
        }
    }

    await processDirectory(directoryPath);

    win.webContents.send('hide-progress-bar');

    const duplicatesToSend = duplicates.filter(group => group.length > 1);
    win.webContents.send('duplicates-found', {dups: duplicatesToSend, dir: directoryPath});
}

async function generateChecksum(filePath) {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    return new Promise((resolve, reject) => {
        stream.on('error', reject);
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

ipcMain.handle('select-database', async (event) => {
    const {filePaths} = await dialog.showOpenDialog({name: 'Please select a database', properties: ['openFile']});
    let dbPath = filePaths[0];
    if (!dbPath) return false;
    db = new NeDB({filename: dbPath, autoload: true});
    return true;
});

ipcMain.handle('save-database', async (event) => {
    const {filePath} = await dialog.showSaveDialog({
        filters: [{name: 'NeDB Database', extensions: ['db']}],
    });
    return filePath; // return the path as a string
});

ipcMain.handle('find-category-by-parent', async (event, parentId) => {
    return new Promise((resolve, reject) => {
        db.find({ type: 'category', parentId: parentId }, (err, docs) => {
            if (err) {
                console.error('Error finding categories by parent:', err);
                reject(err); // Reject the promise if there's an error
            } else {
                console.log(`Found ${docs.length} categories with parent ID:`, parentId);
                resolve(docs); // Resolve the promise with the found documents
            }
        });
    });
});
ipcMain.handle('find-category-by-id', async (event, id) => {
    return new Promise((resolve, reject) => {
        db.find({ type: 'category', _id: id }, (err, docs) => {
            if (err) {
                console.error('Error finding category by ID:', err);
                reject(err); // Reject the promise if there's an error
            } else {
                console.log(`Found category with ID:`, id);
                resolve(docs); // Resolve the promise with the found documents
            }
        });
    });
});
ipcMain.handle('add-category', async (event, args) => {
    return new Promise((resolve, reject) => {
        const newCategory = {
            type: 'category', // This specifies that the document is of type 'category'
            name: args.name,
            parentId: args.parentId,
            createdAt: new Date()
        };

        db.insert(newCategory, (err, newDoc) => {
            if (err) {
                console.error('Error adding category:', err);
                reject(err);  // Reject the promise if there's an error
            } else {
                console.log('Added new category with ID:', newDoc._id);
                resolve(newDoc);  // Resolve the promise with the new document
            }
        });
    });
});
ipcMain.handle('find-all-categories', async (event) => {
    return new Promise((resolve, reject) => {
        // Query the database for documents where the type is 'category'.
        db.find({ type: 'category' }, (err, docs) => {
            if (err) {
                // If there's an error, log it and reject the promise.
                console.error('Error finding all categories:', err);
                reject(new Error('Error finding all categories'));
            } else {
                // If the query is successful, resolve the promise with the category documents.
                console.log('Found all categories:', docs);
                resolve(docs);
            }
        });
    });
});
ipcMain.on('set-database', (event, dbPath) => {
    db = new NeDB({filename: dbPath, autoload: true});
});

ipcMain.handle('get-database-selected', async (event) => {
    return db !== null;
});

