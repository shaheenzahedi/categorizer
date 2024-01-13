const {ipcRenderer, shell} = require('electron');

document.addEventListener('DOMContentLoaded', async (event) => {
    let databaseSelected = await ipcRenderer.invoke('get-database-selected');
    let label = document.getElementById('database-label');
    if (!databaseSelected) {
        label.textContent = 'No database selected';
        label.style.color = '#FF0000'; // Set the text color to red
    } else label.visibility = false;
    const logs = await ipcRenderer.invoke('find-logs', null);
    const content = document.getElementById('content');

    logs.forEach((log) => {
        let card = document.createElement('div');
        card.className = 'log-card';

        let icon = document.createElement('i');
        icon.className = getIconClass(log.type);
        icon.textContent=' ' + mapLogType(log.type);


        let path = document.createElement('p');
        path.textContent = truncateText(log.path, 50); // Truncate path to fit within the card

        let createdAt = document.createElement('p');
        createdAt.textContent = new Date(log.createdAt).toLocaleString();

        card.appendChild(icon);
        card.appendChild(path);
        card.appendChild(createdAt);

        content.appendChild(card);
    });
});

function truncateText(text, maxLength) {
    if (text.length > maxLength) {
        return text.substring(0, maxLength) + '...';
    }
    return text;
}
function mapLogType(logType) {
    switch (logType) {
        case 'deleted':
            return 'File Delete';
        case 'scanDir':
            return 'Scan Start';
        case 'scanDirFinish':
            return 'Scan Finish';
        default:
            return 'Unknown';
    }
}

function getIconClass(logType) {
    switch (logType) {
        case 'deleted':
            return 'fas fa-trash';
        case 'scanDir':
            return 'fas fa-hourglass-start';
        case 'scanDirFinish':
            return 'fas fa-check-square';
        default:
            return 'fas fa-question';
    }
}