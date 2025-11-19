import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";

export interface ThumbnailOptions {
    objPath: string;
    width: number;
    height: number;
    rotationY?: number;
}

// three.js discourse
export async function generateThumbnail(options: ThumbnailOptions) {
    const { objPath, width, height, rotationY } = options;

    const objText = await fs.readFile(objPath, "utf8");

    const browser = await puppeteer.launch({
        headless: true,
        args: ["--disable-gpu", "--no-sandbox"]
    });

    const page = await browser.newPage();

    // const htmlPath = `file:${path.join(__dirname, "renderer", "thumbnail.html")}`;
    const htmlPath = `file:${path.join(__dirname, "thumbnail.html")}`;
    console.log('htmlPath -> ', htmlPath);
    await page.goto(htmlPath);

    await page.setViewport({ width: width, height: height });
    // await page.evaluate(() => document)


    await browser.close();


}


// GPT Generated
// export async function generateThumbnail(options: ThumbnailOptions): Promise<Buffer> {
//     const { objPath, width, height, rotationY } = options;
//
//     const objText = await fs.readFile(objPath, "utf8");
//
//     const browser = await puppeteer.launch({
//         headless: true,
//         args: ["--disable-gpu", "--no-sandbox"]
//     });
//
//     const page = await browser.newPage();
//
//     const htmlPath = `file:${path.join(__dirname, "renderer", "thumbnail.html")}`;
//     await page.goto(htmlPath);
//
//     const waitForImage = new Promise<string>((resolve) => {
//         page.on("console", msg => console.log("browser:", msg.text()));
//
//         page.on("pageerror", err => console.error("page error:", err));
//
//         page.exposeFunction("onThumbnail", (data: string) => {
//             resolve(data);
//         });
//
//         // Listen for postMessage from page
//         page.evaluate(() => {
//             window.addEventListener("message", (event) => {
//                 // call exposed Node function
//                 window.onThumbnail(event.data.image);
//             });
//         });
//     });
//
//     // Send data to the page for rendering
//     await page.evaluate(
//         (payload) => window.postMessage(payload, "*"),
//         { objText, width, height, rotationY }
//     );
//
//     const base64 = await waitForImage;
//
//     await browser.close();
//
//     // Convert dataURL → Buffer
//     const png = base64.replace(/^data:image\/png;base64,/, "");
//     return Buffer.from(png, "base64");
// }


