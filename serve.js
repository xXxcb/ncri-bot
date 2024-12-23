const puppeteer = require('puppeteer');

(() => {

    puppeteer.launch({ headless: false }).then(async browser => {
        console.log('Running tests..')

        const page = await browser.newPage()
        await page.goto('https://www.google.com')

        await page.waitForTimeout(2000)

        await browser.close()
    })

})();