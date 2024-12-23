const puppeteer = require('puppeteer');



/**
 * Endpoint to create a new admin account
 * @method POST /create
 * @param {String} password
 * @param {String} email
 * @param {String} name
 * @returns {Object} - Returns a response object {created: true}
 */

(() => {

    puppeteer.launch({ headless: false }).then(async browser => {
        console.log('Running tests..')

        const page = await browser.newPage()
        await page.goto('https://www.google.com')

        await page.waitForTimeout(2000)

        await browser.close()
    })

})();