const path = require('path')
const fs = require('fs')
const os = require("os");

module.exports = () => {
    const logFilePath = path.join(path.join(os.homedir(), 'Desktop', 'DRS_DL'), 'ncri_bot_log.txt');

// Create a writable stream
    const logStream = fs.createWriteStream(logFilePath, {flags: 'a'}); // 'a' appends to the file

// Override console.log to write to both the log file and the console
    const originalLog = console.log;
    console.log = (...args) => {
        const timestamp = new Date().toISOString();
        const message = `[${timestamp}] ${args.join(' ')}`;
        logStream.write(`${message}\n`); // Write to log file
        originalLog(...args); // Also output to the console
    };

    console.error = (...args) => {
        const timestamp = new Date().toISOString();
        const message = `[${timestamp}] ERROR: ${args.join(' ')}`;
        logStream.write(`${message}\n`); // Write error to log file
        originalLog(...args); // Also output to the console
    };

    console.info = (...args) => {
        const timestamp = new Date().toISOString();
        const message = `[${timestamp}] INFO: ${args.join(' ')}`;
        logStream.write(`${message}\n`); // Write warning to log file
        originalLog(...args); // Also output to the console
    }

    // Return a cleanup function to close the stream
    return () => {
        logStream.end(() => {
            originalLog('Log stream closed.');
        });
    };
}