const adapters = {}

adapters.loginPage = async (page) => {
    return new Promise(async (resolve) => {

        const newPagePromise = new Promise(resolve => page.once('targetcreated', async target => {
            const newPage = await target.page();
            if (newPage) {
                await newPage.bringToFront(); // Bring the new window to the front
                resolve(newPage);
            }
        }));
    

        await page.click('#username')
        await page.type('#username', process.env.USER_NAME)
        await page.click('#password')
        await page.type('#password', process.env.PASS_KEY)
        await page.click('input[type="submit"]')
        console.log('login page')

        



        // Wait for the new page (popup window) to be resolved
    const newPage = await newPagePromise;
    console.log('New pop-up window detected');

    // Interact with the new pop-up window
    console.log('New page URL:', await newPage.url());
    await newPage.waitForSelector('body'); // Replace with the appropriate selector
    console.log('Element found in the new window');

    })
}

module.exports = adapters