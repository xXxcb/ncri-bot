const adapters = {}
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

adapters.loginPage = async (page, browser) => {
    return new Promise(async (resolve) => {
        const [newTab] = await Promise.all([
            new Promise(resolve => browser.once('targetcreated', async target => {
                if (target.type() === 'page') {
                    const newPage = await target.page(); // Get the new tab or window
                    // await newPage.waitForNavigation({ waitUntil: 'load' })
                    await newPage.waitForNetworkIdle()
                    console.info('New window/tab opened:', newPage.url());
                    resolve(newPage);
                }
            })),
            // Navigate to the URL, which might trigger a new tab
            page.goto('https://10.18.82.100', { waitUntil: 'load' }) // Wait for the page to load completely

        ]);

        // Once the new tab is opened, interact with it
        await newTab.waitForSelector('body');  // Ensure the new tab has loaded

        console.log('Loading Initial Login page')

        await newTab.click('#username')
        await newTab.type('#username', process.env.USER_NAME)
        await newTab.click('#password')
        await newTab.type('#password', process.env.PASS_KEY)

        await newTab.click('input[type="submit"]')

        await newTab.waitForNavigation({ waitUntil: 'domcontentloaded' });

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
            console.log('Port Auth Enter URL malformed or missing.')
            await adapters.loginPage(page, browser);
        } else {
            await wrkPage.goto(enterURL)
        }

        // Detect temporary lockout
        for (const page of pages) {
            if (page.url().includes('enter') ) {
                let lockoutID = await page.$('#temporary_crap')
                const boldTexts = await page.evaluate(() => {
                    const boldElements = Array.from(document.querySelectorAll('b'));
                    return boldElements.map((el) => el.textContent.trim());
                });

                let alertFound = boldTexts.length > 0 && boldTexts.some((text) => text.includes('not allowed to login'))

                if (alertFound && lockoutID) {
                    console.log('Temporary lockout detected.')
                    console.log('Waiting 2 minutes.')
                    await delay(120000)
                    await wrkPage.goto(enterURL)
                }
            }
        }

        await wrkPage.waitForSelector('#username', {timeout: 20000})

        console.log('Login Page loaded again. Logging in again.');
        await wrkPage.click('#username')
        await wrkPage.type('#username', process.env.USER_NAME)
        await wrkPage.click('#password')
        await wrkPage.type('#password', process.env.PASS_KEY)
        await wrkPage.click('input[type="submit"]')

        resolve(wrkPage)
    }).catch((err) => {
        console.error('Login Error: ', err)
    })
}

adapters.mainPage = async (wrkPage, browser) => {
    return new Promise(async (resolve) => {
        console.log('Navigating to Report View')
        await wrkPage.waitForNavigation({ waitUntil: 'domcontentloaded' });
        await wrkPage.waitForSelector('#REPORTS')

        await adapters.logout(wrkPage)
        await wrkPage.click('#REPORTS')

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
        console.log('Popup window URL:', await popup.url());

        // await popup.bringToFront()

        // await popup.waitForNavigation({ waitUntil: 'loaded' })

        resolve(popup)
    })
}

adapters.hardLogout = async (page) => {
    return new Promise(async () => {
        console.log('Logging Out...')
        await page.goto('https://10.18.82.100/logout.phtml')
        console.log('Logged Out...')
        process.exit(0)
    })
}

adapters.softLogout = async (page) => {
    return new Promise(async () => {
        console.log('Logging Out...')
        await page.goto('https://10.18.82.100/logout.phtml')
        console.log('Logged Out...')
    })
}

module.exports = adapters