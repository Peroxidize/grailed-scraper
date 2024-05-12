import puppeteer from "puppeteer";
import fs from "fs";
import axios from "axios";

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const main = async () => {
    const webpage = "https://www.grailed.com/categories/long-sleeve-t-shirts";
    const main_label = "Long-Sleeve";
    const num_of_links = 40;
    const image_path = "../soft-eng/";
    const links = await getLinks(webpage, num_of_links);

    for (const link of links) {
        await extractDetails(link, image_path);
    }
};

const extractDetails = async (link, image_path) => {
    const browser = await puppeteer.launch({
        headless: false,
    });
    try {
        const page = await browser.newPage();

        await page.goto(link, {
            waitUntil: "networkidle2",
        });

        // title Body_body__dIg1V Text Details_title__PpX5v
        // size Details_value__S1aVR
        // description SimpleFormat Description_body__cJryj select all paragraph
        // tags Hashtags_tags__CwSY4 select all <a> href with their innertext

        const title = await page.evaluate(() => {
            return document.querySelector(
                "h1[class='Body_body__dIg1V Text Details_title__PpX5v']"
            ).innerText;
        });
        const size = await page.evaluate(() => {
            return document.querySelector("span[class='Details_value__S1aVR']").innerText;
        });
        const description = await page.evaluate(() => {
            const element = document.querySelectorAll(
                "div[class='SimpleFormat Description_body__cJryj'] > p"
            );
            return Array.from(element).map((element) => element.innerText);
        });
        const image = await page.evaluate(() => {
            return document.querySelector(
                "img[class='Photo_picture__g7Lsj Image_fill__QTtNL Image_clip__bU5A3 Image_center__CG78h']"
            ).srcset;
        });
        const image_array = image.split(", ");
        const image_link = image_array[image_array.length - 1].split(" ")[0];
        const image_name_array = image_link.split("/");
        const image_name = image_name_array[image_name_array.length - 1].split("?")[0];
        console.log(title);
        console.log(size);
        console.log(description);
        console.log(image_link);

        try {
            const response = await axios.get(image_link, { responseType: "stream" });
            const writer = fs.createWriteStream(image_path + image_name + ".png");
            response.data.pipe(writer);
            return new Promise((resolve, reject) => {
                writer.on("finish", resolve);
                writer.on("error", reject);
            });
        } catch (e) {
            console.log(e);
        }

        const pages = await browser.pages();
        for (let i = 0; i < pages.length; i++) {
            await pages[i].close();
        }
    } catch (e) {
        console.log(e);
    } finally {
        await browser.close()
    }
};

const getLinks = async (webpage, num_of_links) => {
    const browser = await puppeteer.launch({
        headless: false,
    });
    let links = [];
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
