require('dotenv').config({ path: `${__dirname}/config/.env`});
const puppeteer = require('puppeteer-core');
const path = require('path');
const logger = require('./helpers/log')
const adapters = require('./helpers/adapters');
const os = require('os');
const fs = require('fs');
let globalPage
let globalBrowser

/**
 * Helper function to create a delay based on inputted milliseconds.
 * @method delay
 * @param {Number} ms
 * @returns {Object} - Returns a timeout promise
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const startApp = () => {
    try {
        const closeLogs = logger()

        console.info('>> Launching NCRI Bot <<')
        puppeteer.launch({ headless: false, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ignoreHTTPSErrors: true, args: ['--ignore-certificate-errors', '--new-window=false'] }).then(async browser => {
            globalBrowser = browser
            const page = await browser.newPage();
            let wrkPage = await adapters.loginPage(page, browser);
            globalPage = wrkPage

            // Detect system unavailable alert
            wrkPage.on('dialog', async (dialog) => {
                console.log('Detected browser alert')
                if (dialog.message().includes('unavailable')) {
                    console.info(dialog.message())
                    await adapters.hardLogout(wrkPage)
                }
            });

            // Move to the meat!
            console.log('Navigating to Report View')
            await wrkPage.waitForNavigation({ waitUntil: 'domcontentloaded' });
            await wrkPage.waitForSelector('#REPORTS')
            await wrkPage.click('#REPORTS')
            console.info('Main Page URL: ', wrkPage.url())

            let cframe = await wrkPage.waitForSelector('#CTBDRS_MAIN');

            const frame = await cframe.contentFrame();

            await frame.waitForSelector('select[name="report_seq"')
            await frame.click('select[name="report_seq"]')
            await frame.select('select[name="report_seq"]', '13')

            await frame.waitForSelector('#generateButton a[href="/blank.phtml"]');

            const [popup] = await Promise.all([
                new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
                frame.click('#generateButton a[href="/blank.phtml"]'), // Click the button that triggers the popup
            ]);

            // Wait for the popup to load
            // await popup.waitForNavigation({ waitUntil: 'domcontentloaded' })

            await waitForNavigationWithRefresh(popup, {waitUntil: 'domcontentloaded'})

            // New Window: Inventory Report Details
            const popupUrl = await popup.url();
            console.log('Popup window URL:', popupUrl);
            if (popupUrl) {
                console.log('Reloading Inventory Report Details window.')
                await popup.reload({ waitUntil: 'domcontentloaded' });
            }

            console.log('Load Transfer Setup Frame')
            let invPage = await popup.waitForSelector('frame[name="transfer_setup"]')
            let invFrame = await invPage.contentFrame()

            // Show Extra Options
            await invFrame.waitForSelector('#extra_options a[href="extra_options.phtml?search_by=U-%&t_seq=0&section=full_search"]');
            await invFrame.click('#extra_options a[href="extra_options.phtml?search_by=U-%&t_seq=0&section=full_search"]');

            // Get User List iFrame
            console.log('Load User List iFrame')
            let invInnerPage = await invFrame.waitForSelector('iframe[name="user_list"]')
            let userFrame = await invInnerPage.contentFrame()

            // Export Checkbox
            await userFrame.waitForSelector('input[name="exportyn"]')
            await userFrame.click('input[name="exportyn"]')

            // Details Button
            await invFrame.waitForSelector('a[href="javascript:refresh()"]');

            const [exportPopup] = await Promise.all([
                // new Promise((resolve, reject) => {
                //     browser.once('targetcreated', async target => {
                //         try {
                //             const page = await target.page();
                //             if (page) {
                //                 await page.reload()
                //                 resolve(page);
                //             }
                //             else reject(new Error('Popup page not found.'));
                //         } catch (error) {
                //             reject(error);
                //         }
                //     });
                // }),
                // invFrame.click('a[href="javascript:refresh()"]')


                new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
                await invFrame.click('a[href="javascript:refresh()"]'), // Click the button that triggers the popup
            ]);

            // Wait for the popup to load
            // await exportPopup.waitForNavigation({ waitUntil: 'load' })
            await waitForNavigationWithRefresh(exportPopup, {waitUntil: 'domcontentloaded'})

            // New Window: Export Question
            console.info('Export Popup window URL:', await exportPopup.url());
            // if (await exportPopup.url()) {
            //     console.log('Reloading Export popup window.')
            //     await exportPopup.reload()
            //     console.log('Export popup window reloaded')
            // }

            await exportPopup.waitForSelector('select[name="layout_seq"]')
            await exportPopup.click('select[name="layout_seq"]')
            await exportPopup.select('select[name="layout_seq"]', '844')

            // Click Export Button
            await exportPopup.waitForSelector('input[type="button"][value="Export"]');
            await exportPopup.click('input[type="button"][value="Export"]')

            // Configure Downloads
            const now = new Date();
            const folderName = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];

            const downloadPath = path.join(os.homedir(), 'Desktop', 'DRS_DL', `${folderName}`);
            console.info(`Download path set to: ${downloadPath}`);

            if (!fs.existsSync(downloadPath)) {
                fs.mkdirSync(downloadPath, { recursive: true });
            }

            // Set download behavior
            const downloadClient = await popup.createCDPSession();
            await downloadClient.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: downloadPath
            });

            console.log('Load Input Frame')
            let invInputPage = await popup.waitForSelector('frame[name="input"]')
            let invInputFrame = await invInputPage.contentFrame()

            // Download File
            await invInputFrame.waitForSelector('a[href*="/download_file.phtml?export_seq="]', { timeout: 40000 })
            await invInputFrame.click('a[href*="/download_file.phtml?export_seq="]')

            const waitForFile = (downloadPath, timeout) => {
                return new Promise((resolve, reject) => {
                    const start = Date.now();
                    const interval = setInterval(() => {
                        const files = fs.readdirSync(downloadPath);
                        if (files.length > 0) {
                            clearInterval(interval);
                            resolve(files[0]); // Return the downloaded file name
                        }
                        if (Date.now() - start > timeout) {
                            clearInterval(interval);
                            reject(new Error('File download timed out'));
                        }
                    }, 100); // Check every 100ms
                });
            };

            const downloadedFile = await waitForFile(downloadPath, 40000); // Wait up to 40 seconds
            console.log(`File downloaded: ${downloadedFile}`);

            if (downloadedFile) {
                console.log('File Downloaded successfully.')
                await adapters.hardLogout(wrkPage)
                await browser.close()
                closeLogs()
                process.exit(0)
            }
        }).catch(async (err) => {
            console.error(err);
            await adapters.softLogout(globalPage)
            // await globalBrowser.close()
            console.log('Restarting app after error.')
            await delay(3000)
            startApp()
        })
    } catch (error) {
        console.error('Error occurred:', error.message);

        // Retry logic in case of page load failure
        // if (error.message.includes('net::ERR_EMPTY_RESPONSE') || error.message.includes('Timeout')) {
        //     console.log('Page failed to load. Closing tab and retrying...');
        //     await newTab.close();
        //
        //     // Retry: Open the page again
        //     newTab = await browser.newPage();
        //     await newTab.goto('https://10.18.82.100', { waitUntil: 'load' });
        //     console.log('Retry successful.');
        // }
    }
}

/**
 * Function to wait for page navigation and refresh page if page not fully loaded.
 * @method waitForNavigationWithRefresh
 * @param {Object} popup
 * @param {Object} options
 * @returns {Object} - Returns a page instance.
 */
const waitForNavigationWithRefresh = async (popup, options = {}) => {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
        try {
            // Wait for navigation with a timeout
            console.log(`Attempt ${retryCount + 1}: Waiting for navigation...`);
            await popup.waitForNavigation({
                waitUntil: options.waitUntil || 'domcontentloaded',
                timeout: options.timeout || 10000, // Default timeout: 10 seconds
            });
            console.log('Navigation successful.');
            return; // Exit the loop if navigation succeeds
        } catch (error) {
            console.error(`Navigation timeout or error: ${error.message}`);
            retryCount++;
            if (retryCount < maxRetries) {
                console.log(`Refreshing the page (attempt ${retryCount + 1})...`);
                await popup.reload(); // Refresh the page
                return;
            } else {
                console.error('Maximum retries reached. Navigation failed.');
                throw error; // Rethrow the error after maximum retries
            }
        }
    }
};


/**
 * Function to start main application.
 * @method startApp
 */
startApp();