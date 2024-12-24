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
        puppeteer.launch({ headless: false, ignoreHTTPSErrors: true, args: ['--ignore-certificate-errors'] }).then(async browser => {
            console.log('Running tests..')

            const page = await browser.newPage();


            const [newTab] = await Promise.all([
                new Promise(resolve => browser.once('targetcreated', async target => {
                    if (target.type() === 'page') {
                        const newPage = await target.page();
                        resolve(newPage);
                    }
                })),
                // Navigate to the URL, which might trigger a new tab
                page.goto('https://10.18.82.100', { waitUntil: 'load' }) // Wait for the page to load completely
            ]);

            // Once the new tab is opened, interact with it
            await newTab.waitForSelector('body');  // Ensure the new tab has loaded

            await adapters.loginPage(newTab);
        })
    } catch (error) {
        console.log(error)
    }

})();