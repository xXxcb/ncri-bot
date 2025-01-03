require('dotenv').config({ path: `${__dirname}/config/.env`});
const puppeteer = require('puppeteer-core');
const path = require('path');
const adapters = require('./helpers/adapters');
const os = require('os');
const fs = require('fs');
let globalPage
let globalBrowser

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Endpoint to create a new admin account
 * @method POST /create
 * @param {String} password
 * @param {String} email
 * @param {String} name
 * @returns {Object} - Returns a response object {created: true}
 */

const startApp = () => {
    try {
        puppeteer.launch({ headless: false, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ignoreHTTPSErrors: true, args: ['--ignore-certificate-errors', '--new-window=false'] }).then(async browser => {
            globalBrowser = browser
            const page = await browser.newPage();
            let wrkPage = await adapters.loginPage(page, browser);
            globalPage = wrkPage

            // Move to the meat!
            console.info('Navigating to Report View')
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
            await popup.waitForNavigation({ waitUntil: 'domcontentloaded' })

            // New Window: Inventory Report Details
            const popupUrl = await popup.url();
            console.log('Popup window URL:', popupUrl);
            if (popupUrl) {
                console.info('Reloading Inventory Report Details window.')
                await popup.reload({ waitUntil: 'domcontentloaded' });
            }

            console.info('Load Transfer Setup Frame')
            let invPage = await popup.waitForSelector('frame[name="transfer_setup"]')
            let invFrame = await invPage.contentFrame()

            // Show Extra Options
            await invFrame.waitForSelector('#extra_options a[href="extra_options.phtml?search_by=U-%&t_seq=0&section=full_search"]');
            await invFrame.click('#extra_options a[href="extra_options.phtml?search_by=U-%&t_seq=0&section=full_search"]');

            // Get User List iFrame
            console.info('Load User List iFrame')
            let invInnerPage = await invFrame.waitForSelector('iframe[name="user_list"]')
            let userFrame = await invInnerPage.contentFrame()

            // Export Checkbox
            await userFrame.waitForSelector('input[name="exportyn"]')
            await userFrame.click('input[name="exportyn"]')

            // Details Button
            await invFrame.waitForSelector('a[href="javascript:refresh()"]');

            const [exportPopup] = await Promise.all([
                new Promise((resolve, reject) => {
                    browser.once('targetcreated', async target => {
                        try {
                            const page = await target.page();
                            if (page) {
                                await page.reload()
                                resolve(page);
                            }
                            else reject(new Error('Popup page not found.'));
                        } catch (error) {
                            reject(error);
                        }
                    });
                }),
                invFrame.click('a[href="javascript:refresh()"]')


                // new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
                // await invFrame.click('a[href="javascript:refresh()"]'), // Click the button that triggers the popup
            ]);

            // Wait for the popup to load
            // await exportPopup.waitForNavigation({ waitUntil: 'load' })

            // New Window: Export Question
            console.log('Export Popup window URL:', await exportPopup.url());
            if (await exportPopup.url()) {
                console.info('Reloading Export popup window.')
                await exportPopup.reload()
            }

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
            console.log(`Download path set to: ${downloadPath}`);

            if (!fs.existsSync(downloadPath)) {
                fs.mkdirSync(downloadPath, { recursive: true });
            }

            // Set download behavior
            const downloadClient = await popup.createCDPSession();
            await downloadClient.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: downloadPath
            });

            console.info('Load Input Frame')
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

startApp();