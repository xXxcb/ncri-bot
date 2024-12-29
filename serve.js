require('dotenv').config({ path: `${__dirname}/config/.env`});
const puppeteer = require('puppeteer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const adapters = require('./helpers/adapters');

/**
 * Endpoint to create a new admin account
 * @method POST /create
 * @param {String} password
 * @param {String} email
 * @param {String} name
 * @returns {Object} - Returns a response object {created: true}
 */

(async () => {

    try {
        puppeteer.launch({ headless: false, ignoreHTTPSErrors: true, args: ['--ignore-certificate-errors', '--new-window=false'] }).then(async browser => {

            const page = await browser.newPage();

            const [newTab] = await Promise.all([
                new Promise(resolve => browser.once('targetcreated', async target => {
                    if (target.type() === 'page') {
                        const newPage = await target.page(); // Get the new tab or window
                        // await newPage.waitForNavigation({ waitUntil: 'load' })
                        await newPage.waitForNetworkIdle()
                        console.log('New window/tab opened:', newPage.url());
                        resolve(newPage);
                    }
                })),
                // Navigate to the URL, which might trigger a new tab
                page.goto('https://10.18.82.100', { waitUntil: 'load' }) // Wait for the page to load completely

            ]);

            // Once the new tab is opened, interact with it
            await newTab.waitForSelector('body');  // Ensure the new tab has loaded

            console.info('Initial Login page')

            await newTab.click('#username')
            await newTab.type('#username', process.env.USER_NAME)
            await newTab.click('#password')
            await newTab.type('#password', process.env.PASS_KEY)

            await newTab.click('input[type="submit"]')

            await newTab.waitForNavigation({ waitUntil: 'domcontentloaded' });
            // await newTab.waitForSelector('body'); // Wait until the body is available
            await newTab.waitForNetworkIdle()

            const pages = await browser.pages();
            let enterURL

            for (const page of pages) {
                enterURL = page.url().includes('enter') ? page.url() : '';
                if (page.url().includes('about')) await page.close()
                if (page.url().includes('index')) await page.close()
            }
            let wrkPage = await browser.newPage()
            if (!enterURL) {
                console.info('Port Auth Enter URL malformed or missing.')
            } else {
                await wrkPage.goto(enterURL)
            }

            await wrkPage.waitForSelector('#username', {timeout: 20000})

            console.info('Login Page loaded again. Retrying login...');
            await wrkPage.click('#username')
            await wrkPage.type('#username', process.env.USER_NAME)
            await wrkPage.click('#password')
            await wrkPage.type('#password', process.env.PASS_KEY)
            await wrkPage.click('input[type="submit"]')

            // Move to the meat!
            console.info('Navigating to Report View')
            await wrkPage.waitForNavigation({ waitUntil: 'domcontentloaded' });
            await wrkPage.waitForSelector('#REPORTS')
            await wrkPage.click('#REPORTS')

            let cframe = await wrkPage.waitForSelector('#CTBDRS_MAIN');

            const frame = await cframe.contentFrame();

            await frame.waitForSelector('select[name="report_seq"')
            await frame.click('select[name="report_seq"]')
            await frame.select('select[name="report_seq"]', '13')

            await frame.waitForSelector('#generateButton a[href="/blank.phtml"]');
            // await frame.click('#generateButton a[href="/blank.phtml"]');

            const [popup] = await Promise.all([
                new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
                frame.click('#generateButton a[href="/blank.phtml"]'), // Click the button that triggers the popup
            ]);

            // Wait for the popup to load
            await popup.waitForNavigation({ waitUntil: 'domcontentloaded' })

            // New Window: Inventory Report Details
            console.log('Popup window URL:', await popup.url());

            // await popup.bringToFront()

            // await popup.waitForNavigation({ waitUntil: 'loaded' })

            console.info('Load Transfer Setup Frame')
            let invPage = await popup.waitForSelector('frame[name="transfer_setup"]')
            let invFrame = await invPage.contentFrame()

            // await invFrame.waitForNavigation({ waitUntil: 'networkidle0' })

            // Show Extra Options
            await invFrame.waitForSelector('#extra_options a[href="extra_options.phtml?search_by=U-%&t_seq=0&section=full_search"]');
            await invFrame.click('#extra_options a[href="extra_options.phtml?search_by=U-%&t_seq=0&section=full_search"]');
            // Stopped here @TODO Continue

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
                new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
                await invFrame.click('a[href="javascript:refresh()"]'), // Click the button that triggers the popup
            ]);

            // Wait for the popup to load
            await exportPopup.waitForNavigation({ waitUntil: 'domcontentloaded' })

            // New Window: Export Question
            console.log('Popup window URL:', await popup.url());

            await exportPopup.waitForSelector('select[name="layout_seq"]')
            await exportPopup.click('select[name="layout_seq"]')
            await exportPopup.select('select[name="layout_seq"]', '844')

            // Click Export Button
            await exportPopup.waitForSelector('input[type="button"][value="Export"]');
            await exportPopup.click('input[type="button"][value="Export"]')


            console.info('Load Input Frame')
            let invInputPage = await popup.waitForSelector('frame[name="input"]')
            let invInputFrame = await invInputPage.contentFrame()


            // Configure Downloads
            const now = new Date();
            const folderName = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];

            const downloadPath = path.join(os.homedir(), 'Desktop', 'DRS_DL', `${folderName}`);
            console.log(`Download path set to: ${downloadPath}`);

            if (!fs.existsSync(downloadPath)) {
                fs.mkdirSync(downloadPath, { recursive: true });
            }

            // Set download behavior
            const client = await invInputFrame.target().createCDPSession();
            await client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: downloadPath
            });

            // Download File
            await invInputFrame.waitForSelector('a[href="/download_file.phtml?export_seq=2941"]')
            await invInputFrame.click('a[href="/download_file.phtml?export_seq=2941"]')


        }).catch((err) => {
            console.error(err);


            // err.message
            // net::ERR_EMPTY_RESPONSE at https://10.18.82.100
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

})();