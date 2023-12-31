const { ipcRenderer } = require('electron');
const fs = require('fs');
// Require NeDB Database
const NeDB = require('nedb');
let db;

let loadDB = document.getElementById('loadDb');
loadDB.addEventListener('click', async () => {
    try {
        const dbPath = await ipcRenderer.invoke('select-database');
        if (dbPath) {
            loadDB.textContent = 'Database selected';
            loadDB.disabled = true;
            console.log('Database loaded from:', dbPath);
        }
    } catch (error) {
        console.error('Failed to load database:', error);
    }
});

document.getElementById('saveDb').addEventListener('click', async () => {
    if (db) {
        const savePath = await ipcRenderer.invoke('save-database');
        if (savePath) {
            db.persistence.setAutocompactionInterval(0); // Disable autocompaction
            db.persistence.compactDatafile();
            db.loadDatabase(err => {
                if (err) {
                    console.error('Error compacting database:', err)
                } else {
                    fs.copyFile(db.filename, savePath, (copyErr) => {
                        if (copyErr) {
                            console.error('Error saving database:', copyErr);
                        } else {
                            console.log('Database saved to:', savePath);
                        }
                    });
                }
            });
        }
    } else {
        alert('No database is loaded.');
    }
});