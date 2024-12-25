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
            // await wrkPage.waitForNavigation({ waitUntil: 'domcontentloaded' });
            await page.click('select[name="report_seq"]')
            await page.select('select[name="report_seq"]', '13')

            // Click Generate button
            let generate = await page.$('//*[@id="generateButton"]/table/tbody/tr[1]/td/a')
            await generate[0].click()


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

function delay(time) {
    return new Promise(function(resolve) {
        setTimeout(resolve, time)
    });
}