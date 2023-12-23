const {app, BrowserWindow, ipcMain, dialog} = require('electron');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const crypto = require('crypto');
const {promisify} = require('util');
const readDir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlinkAsync = promisify(fs.unlink);

let win;

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

app.whenReady().then(createWindow);

ipcMain.on('open-file-dialog-for-directory', async (event) => {
    const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory']
    });
    if (result.canceled === false) {
        const directoryPath = result.filePaths[0];
        const win = BrowserWindow.fromWebContents(event.sender);
        scanDirectory(directoryPath, win);
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
                win.webContents.send('update-progress-bar', { processedFiles, totalFiles });
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
