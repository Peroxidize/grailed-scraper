import puppeteer from "puppeteer";

const sleep = ms => new Promise(res => setTimeout(res, ms));

const main = async () => {
    const webpage = "https://www.grailed.com/categories/long-sleeve-t-shirts";
    const main_label = "Long-Sleeve";
    const num_of_links = 1000;
    const links = await getLinks(webpage, num_of_links);

};

const getLinks = async (webpage, num_of_links) => {
    let links = [];
    const browser = await puppeteer.launch({
        headless: false,
    });
    const page = await browser.newPage();

    await page.goto(webpage, {
        waitUntil: "networkidle2",
    });

    while (links.length < num_of_links) {
        const getAllLinks = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("div[class='feed-item']")).map(
                (item) => item.querySelector("a").href
            );
        });

        links = getAllLinks;
        console.log(links.length);

        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)", {
            waitUntil: "networkidle2",
        });
        await sleep(2000);
    }

    console.log("end");
    await browser.close();
    
    return links;
};

main();