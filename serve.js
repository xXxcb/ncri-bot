require('dotenv').config({ path: `${__dirname}/config/.env`});
const puppeteer = require('puppeteer');
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

            console.log('first login page')

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
            await wrkPage.waitForNavigation({ waitUntil: 'domcontentloaded' });
            await wrkPage.waitForSelector('#REPORTS')
            await wrkPage.click('#REPORTS')

            let cframe = await wrkPage.waitForSelector('#CTBDRS_MAIN');

            const frame = await cframe.contentFrame();

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

            await popup.bringToFront()

            // await popup.waitForNavigation({ waitUntil: 'domcontentloaded' })

            let invPage = await popup.waitForSelector('frame[name="transfer_setup"]')

            await invPage.waitForSelector('table a[href="javascript:refresh()"]');
            await invPage.click('table a[href="javascript:refresh()"]');

            await invPage.waitForSelector('table #extra_options a[href="extra_options.phtml?search_by=U-%&t_seq=0&section=full_search"]');
            await invPage.click('table #extra_options a[href="extra_options.phtml?search_by=U-%&t_seq=0&section=full_search"]');

            await invPage.waitForSelector('table a[href="changeValue(\'exportyn\',\'1\');blankValue(\'notesyn\');blankValue(\'lettersyn\');"]')
            await invPage.click('table a[href="changeValue(\'exportyn\',\'1\');blankValue(\'notesyn\');blankValue(\'lettersyn\');"]')

        }).catch((err) => {
            console.error(err);
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