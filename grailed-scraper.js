import puppeteer from "puppeteer";
import { assert } from "console";
import keywords from "./keywords.json" assert { type: "json" };
import fs, { link } from "fs";
import axios from "axios";

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const keywords_map = initializeKeywords();
let texts = "";

// keywords.map(word => console.log(word));

const main = async () => {
    const webpage = "https://www.grailed.com/categories/long-sleeve-t-shirts";
    const num_of_links = 40;
    const image_path = "../soft-eng/images/";
    const csv_path = "../soft-eng/";
    const links = await getLinks(webpage, num_of_links);

    const batch_size = 20;
    for (let i = 0; i < links.length; i += batch_size) {
        const batch = links.slice(i, i + batch_size);
        await Promise.all(batch.map((link) => extractDetails(link, image_path, csv_path)));
    }
};

const extractDetails = async (link, image_path, csv_path) => {
    const browser = await puppeteer.launch({
        headless: false,
        timeout: 60000,
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
        // headline Headline_headline___qUL5 Text Details_designers__NnQ20

        const title = await page.evaluate(() => {
            return document.querySelector(
                "h1[class='Body_body__dIg1V Text Details_title__PpX5v']"
            ).innerText;
        });
        const headlines = await page.evaluate(() => {
            const headline_element = document.querySelectorAll(
                "a[class='Designers_designer__quaYl']"
            );
            return Array.from(headline_element).map((e) => e.innerText);
        });
        const categories = await page.evaluate(() => {
            const parent = document.querySelectorAll(
                "li[class='Breadcrumbs_item__AdcIZ']"
            );
            return parent[parent.length - 2].querySelector("a").innerText;
        });
        const hashtags = await page.evaluate(() => {
            const tags = Array.from(
                document.querySelectorAll(
                    "a[class='Text Callout_callout__1Kvdw Hashtag_hashtag__1JuqN Hashtag_link__Tr3RO Hashtags_tag__e7Es1']"
                )
            );
            return tags.map((e) => e.innerText);
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
        const features_map = initializeFeatures();

        texts += title + " " + headlines.join(" ") + " " + categories + " " + hashtags.join(" ") + " " + description.join(" ");
        texts = texts.replace(/[^\w\s]/g, "");
        texts = texts.toLowerCase();
        texts = texts.split(" ");
        console.log(texts);

        checkKeywords(features_map, keywords_map, keywords, texts);
        writeImage(image_path, image_link, image_name);
        writeCSV(image_name, features_map, csv_path);
    } catch (e) {
        console.log(e);
    } finally {
        await browser.close();
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
        await sleep(3000);

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
    }

    console.log("end");
    await browser.close();

    return links;
};

function checkKeywords(features_map, keywords_map, keywords, texts) {
    for (let keyword of keywords) {
        if (keyword.includes(" ")) {
            keyword = keyword.split(" ");
            for (let i = 1; i < texts.length; i++) {
                if (keyword[0] === texts[i - 1] && keyword[1] === texts[i]) {
                    keyword = keyword.join(" ");
                    const feature = keywords_map.get(keyword);
                    features_map.set(feature, 1);
                }
            }
        } else {
            for (let i = 0; i < texts.length; i++) {
                if (keyword === texts[i]) {
                    const feature = keywords_map.get(keyword);
                    features_map.set(feature, 1);
                }
            }
        }
    }
}

async function writeImage(image_path, image_link, image_name) {
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
}

function writeCSV(image_name, features_map, csv_path) {
    let data = image_name + ",";
    for (let value of features_map.values()) {
        data += value + ",";
    }
    data = data.slice(0,-1) + "\r\n";

    fs.appendFile(csv_path + "dataset.csv", data, (err) => {
        if (err) {
            console.error("Error writing to the file:", err);
        } else {
            console.log("Dataset has been written");
        }
    });
    console.log(data);
}

function writeFileLinks(csv_path, img_link) {
    const data = img_link + "\r\n";
    fs.appendFile(csv_path + "links.csv", data, (err) => {
        if (err) {
            console.error('Error writing to the file:', err);
        } else {
            console.log("Links has been written");
        }
    });
    console.log(data);
}

function readFileLinks(csv_path) {

}

function map_keyword(features_map, keywords_map, keyword) {
    const feature = features_map.get(keyword);
    keywords_map.set(result, 1);
}

function initializeFeatures() {
    const tags_map = new Map();
    tags_map.set("Shirt", 0);
    tags_map.set("Vintage", 0);
    tags_map.set("Sweatshirt", 0);
    tags_map.set("T-shirt", 0);
    tags_map.set("Long Sleeve", 0);
    tags_map.set("Polo", 0);
    tags_map.set("Floral", 0);
    tags_map.set("Camo", 0);
    tags_map.set("Striped", 0);
    tags_map.set("Printed", 0);
    tags_map.set("Streetwear", 0);
    tags_map.set("Button Up", 0);
    tags_map.set("Pullover", 0);
    tags_map.set("Flannel", 0);
    tags_map.set("Nike", 0);
    tags_map.set("Distressed", 0);
    tags_map.set("Denim", 0);
    tags_map.set("Jumper", 0);
    tags_map.set("Sweater", 0);
    tags_map.set("Knit", 0);
    tags_map.set("Cardigan", 0);
    tags_map.set("Hoodie", 0);
    tags_map.set("Jacket", 0);
    tags_map.set("Short sleeve", 0);
    tags_map.set("Zipped", 0);
    tags_map.set("Athletic", 0);
    tags_map.set("Sleveless", 0);
    tags_map.set("Vest", 0);
    tags_map.set("Tank top", 0);
    tags_map.set("Jersey", 0);
    tags_map.set("Casual", 0);
    tags_map.set("Y2K", 0);
    tags_map.set("Pants", 0);
    tags_map.set("Cropped", 0);
    tags_map.set("Shorts", 0);
    tags_map.set("Pants", 0);
    tags_map.set("Jeans", 0);
    tags_map.set("Faded", 0);
    tags_map.set("Corduroy", 0);
    tags_map.set("Cotton", 0);
    tags_map.set("Trousers", 0);
    tags_map.set("Leggings", 0);
    tags_map.set("Tight", 0);
    tags_map.set("Sportswear", 0);
    tags_map.set("Overalls", 0);
    tags_map.set("Coverall", 0);
    tags_map.set("Jumpsuit", 0);
    tags_map.set("Cargo", 0);
    tags_map.set("Sweatpants", 0);
    tags_map.set("Pajamas", 0);
    tags_map.set("Swimwear", 0);
    tags_map.set("Trunks", 0);
    tags_map.set("Jacket", 0);
    tags_map.set("Suit", 0);
    tags_map.set("Blazers", 0);
    tags_map.set("Tracksuit", 0);
    tags_map.set("Blouse", 0);
    tags_map.set("Crop top", 0);
    tags_map.set("V neck", 0);
    tags_map.set("Skirt", 0);
    tags_map.set("Mini skirt", 0);
    tags_map.set("Midi skirt", 0);
    tags_map.set("Maxi skirt", 0);
    tags_map.set("Dress", 0);
    tags_map.set("Mini dress", 0);
    tags_map.set("Midi dress", 0);
    tags_map.set("Maxi dress", 0);
    tags_map.set("Turtleneck", 0);
    return tags_map;
}

function initializeKeywords() {
    const keywords_map = new Map();
    keywords_map.set("turtlenecks", "Turtleneck");
    keywords_map.set("turtleneck", "Turtleneck");
    keywords_map.set("maxi dresses", "Maxi dress");
    keywords_map.set("maxi dress", "Maxi dress");
    keywords_map.set("midi dresses", "Midi dress");
    keywords_map.set("midi dress", "Midi dress");
    keywords_map.set("mini dresses", "Mini dress");
    keywords_map.set("mini dress", "Mini dress");
    keywords_map.set("dress", "Dress");
    keywords_map.set("maxi skirts", "Maxi skirt");
    keywords_map.set("maxi skirt", "Maxi skirt");
    keywords_map.set("midi skirts", "Midi skirt");
    keywords_map.set("midi skirt", "Midi skirt");
    keywords_map.set("mini skirts", "Mini skirt");
    keywords_map.set("mini skirt", "Mini skirt");
    keywords_map.set("skirts", "Skirt");
    keywords_map.set("skirt", "Skirt");
    keywords_map.set("vnecks", "V neck");
    keywords_map.set("vneck", "V neck");
    keywords_map.set("v-necks", "V neck");
    keywords_map.set("v-neck", "V neck");
    keywords_map.set("v necks", "V neck");
    keywords_map.set("v neck", "V neck");
    keywords_map.set("crops-tops", "Crop top");
    keywords_map.set("crops-top", "Crop top");
    keywords_map.set("crop-top", "Crop top");
    keywords_map.set("crops tops", "Crop top");
    keywords_map.set("crops top", "Crop top");
    keywords_map.set("crop tops", "Crop top");
    keywords_map.set("crop top", "Crop top");
    keywords_map.set("blouses", "Blouse");
    keywords_map.set("blouse", "Blouse");
    keywords_map.set("tracksuits", "Tracksuit");
    keywords_map.set("tracksuit", "Tracksuit");
    keywords_map.set("blazers", "Blazers");
    keywords_map.set("blazer", "Blazers");
    keywords_map.set("suits", "Suit");
    keywords_map.set("suit", "Suit");
    keywords_map.set("jackets", "Jacket");
    keywords_map.set("jacket", "Jacket");
    keywords_map.set("trunks", "Trunks");
    keywords_map.set("trunk", "Trunks");
    keywords_map.set("swimsuit", "Swimwear");
    keywords_map.set("swimmings", "Swimwear");
    keywords_map.set("swimming", "Swimwear");
    keywords_map.set("swims", "Swimwear");
    keywords_map.set("swim", "Swimwear");
    keywords_map.set("swimwears", "Swimwear");
    keywords_map.set("swimwear", "Swimwear");
    keywords_map.set("pajamas", "Pajamas");
    keywords_map.set("joggings", "Sweatpants");
    keywords_map.set("jogging", "Sweatpants");
    keywords_map.set("joger", "Sweatpants");
    keywords_map.set("joggers", "Sweatpants");
    keywords_map.set("sweat-pants", "Sweatpants");
    keywords_map.set("sweat-pant", "Sweatpants");
    keywords_map.set("sweatpants", "Sweatpants");
    keywords_map.set("sweatpant", "Sweatpants");
    keywords_map.set("cargo", "Cargo");
    keywords_map.set("jump-suits", "Jumpsuit");
    keywords_map.set("jump-suit", "Jumpsuit");
    keywords_map.set("jump suits", "Jumpsuit");
    keywords_map.set("jump suit", "Jumpsuit");
    keywords_map.set("jumpsuits", "Jumpsuit");
    keywords_map.set("jumpsuit", "Jumpsuit");
    keywords_map.set("coveralls", "Coverall");
    keywords_map.set("coverall", "Coverall");
    keywords_map.set("overalls", "Overalls");
    keywords_map.set("overall", "Overalls");
    keywords_map.set("sportswears", "Sportswear");
    keywords_map.set("sportswear", "Sportswear");
    keywords_map.set("sport", "Sportswear");
    keywords_map.set("tights", "Tight");
    keywords_map.set("tight", "Tight");
    keywords_map.set("leggings", "Leggings");
    keywords_map.set("legging", "Leggings");
    keywords_map.set("trousers", "Trousers");
    keywords_map.set("trouser", "Trousers");
    keywords_map.set("cotton", "Cotton");
    keywords_map.set("corduroy", "Corduroy");
    keywords_map.set("faded", "Faded");
    keywords_map.set("jean", "Jeans");
    keywords_map.set("jeans", "Jeans");
    keywords_map.set("pants", "Pants");
    keywords_map.set("pant", "Pants");
    keywords_map.set("shorts-pants", "Shorts");
    keywords_map.set("shorts-pant", "Shorts");
    keywords_map.set("short-pant", "Shorts");
    keywords_map.set("short pant", "Shorts");
    keywords_map.set("short pants", "Shorts");
    keywords_map.set("shorts pants", "Shorts");
    keywords_map.set("shorts", "Shorts");
    keywords_map.set("cropped", "Cropped");
    keywords_map.set("y2k", "Y2K");
    keywords_map.set("casual", "Casual");
    keywords_map.set("jerseypants", "Jersey");
    keywords_map.set("jerseypant", "Jersey");
    keywords_map.set("jerseys-pant", "Jersey");
    keywords_map.set("jerseys-pants", "Jersey");
    keywords_map.set("jerysey-pants", "Jersey");
    keywords_map.set("jersey pant", "Jersey");
    keywords_map.set("jersey pants", "Jersey");
    keywords_map.set("jerseys", "Jersey");
    keywords_map.set("jersey", "Jersey");
    keywords_map.set("tank-top", "Tank top");
    keywords_map.set("tanktop", "Tank top");
    keywords_map.set("tank top", "Tank top");
    keywords_map.set("tank", "Tank top");
    keywords_map.set("vest", "Vest");
    keywords_map.set("sleeveless", "Sleveless");
    keywords_map.set("athletic", "Athletic");
    keywords_map.set("zipped", "Zipped");
    keywords_map.set("zipperup", "Zipped");
    keywords_map.set("zipper-up", "Zipped");
    keywords_map.set("zipper up", "Zipped");
    keywords_map.set("zipper", "Zipped");
    keywords_map.set("zipup", "Zipped");
    keywords_map.set("zip-up", "Zipped");
    keywords_map.set("zip up", "Zipped");
    keywords_map.set("short-sleeve", "Short sleeve");
    keywords_map.set("shortsleeve", "Short sleeve");
    keywords_map.set("short sleeve", "Short sleeve");
    keywords_map.set("hoodies", "Hoodie");
    keywords_map.set("hoodie", "Hoodie");
    keywords_map.set("cardigan", "Cardigan");
    keywords_map.set("knitwear", "Knit");
    keywords_map.set("knit", "Knit");
    keywords_map.set("sweater", "Sweater");
    keywords_map.set("jumper", "Jumper");
    keywords_map.set("denim", "Denim");
    keywords_map.set("distressed", "Distressed");
    keywords_map.set("nike", "Nike");
    keywords_map.set("flannel", "Flannel");
    keywords_map.set("pullover", "Pullover");
    keywords_map.set("buttonsups", "Streetwear");
    keywords_map.set("buttonup", "Streetwear");
    keywords_map.set("button-ups", "Streetwear");
    keywords_map.set("button ups", "Streetwear");
    keywords_map.set("button-up", "Streetwear");
    keywords_map.set("button", "Streetwear");
    keywords_map.set("button up", "Streetwear");
    keywords_map.set("streetwear", "Streetwear");
    keywords_map.set("print", "Printed");
    keywords_map.set("over-printed", "Printed");
    keywords_map.set("over printed", "Printed");
    keywords_map.set("overprinted", "Printed");
    keywords_map.set("overprint", "Printed");
    keywords_map.set("printed", "Printed");
    keywords_map.set("logo", "Printed");
    keywords_map.set("graphic", "Printed");
    keywords_map.set("stripe", "Striped");
    keywords_map.set("striped", "Striped");
    keywords_map.set("camo", "Camo");
    keywords_map.set("floral", "Floral");
    keywords_map.set("polos", "Polo");
    keywords_map.set("polo", "Polo");
    keywords_map.set("long-sleeve", "Long Sleeve");
    keywords_map.set("longsleeve", "Long Sleeve");
    keywords_map.set("long sleeve", "Long Sleeve");
    keywords_map.set("tees", "T-shirt");
    keywords_map.set("tee", "T-shirt");
    keywords_map.set("t shirt", "T-shirt");
    keywords_map.set("t shirts", "T-shirt");
    keywords_map.set("t-shirts", "T-shirt");
    keywords_map.set("t-shirt", "T-shirt");
    keywords_map.set("tshirt", "T-shirt");
    keywords_map.set("sweatshirt", "Sweatshirt");
    keywords_map.set("shirt", "Shirt");
    keywords_map.set("shirts", "Shirt");
    keywords_map.set("vintage", "Vintage");
    return keywords_map;
}

main();