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

    puppeteer.launch({ headless: false }).then(async browser => {
        console.log('Running tests..')

        const page = await browser.newPage()
        await page.goto('https://10.18.82.100')

        // Check for security page
        // Check for login page
        await page.waitForTimeout(2000)

        await browser.close()
    })

})();