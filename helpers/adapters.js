const adapters = {}

adapters.loginPage = async (page) => {
    return new Promise(async (resolve) => {
      await page.type('#ctl00_SiteContentPlaceHolder_txtAnswer', process.env.USER_NAME)
        await page.type('#username', process.env.USERNAME)
        await page.type('#password', process.env.PASSWORD)
        await page.click('#login')
        console.log('login page')

        await page.waitForTimeout(2000)


    })
}

module.exports = adapters