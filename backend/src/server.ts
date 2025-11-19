import express from 'express';
import cors from 'cors';
import {generateThumbnail} from "./thumbnail.ts";
import puppeteer from "puppeteer";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// app.post('/api/thumbnail', async (req, res) => {
//     // TODO: Load the model and render to PNG
//     // console.log('req ->', req);
//     // console.log("Body:", req.body);
//     const {modelUrl, pose, resolution: size} = req.body;
//
//     try {
//         const buffer = await generateThumbnail({
//             modelUrl,
//             width: size?.w ?? 512,
//             height: size?.h ?? 512,
//             rotationY: pose?.rotationY ?? 0,
//         })
//
//         res.setHeader('Content-Type', 'image/png');
//         res.send(buffer);
//
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({error: "Thumbnail generation failed."});
//     }
//
//
//     // res.json({ok: true});
// })

app.post('/api/test', async (req, res) => {
    console.log('Request body ->', req.body);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(req.body));
})

app.post('/api/puppeteer', async (req, res) => {
    console.log('Request body ->', req.body);

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const filePath = path.resolve('src/threeScene.html');

    await page.goto(`file://${filePath}`);

    await page.setViewport({width: 512, height: 512});
    await page.evaluate(() => document.body.style.background = 'transparent');
    // await page.screenshot({path: `imgs/example-${Math.random().toString().substring(2, 6)}.png`, omitBackground: true});
    await page.screenshot({path: `imgs/example-${Math.random().toString().substring(2, 6)}.png`});

    await browser.close();

    res.json({ok: true});
})

app.listen(3000, () => {
    console.log('Server running on port 3000');
});