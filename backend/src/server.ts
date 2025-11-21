import express from 'express';
import cors from 'cors';
import puppeteer from "puppeteer";
import path from "path";
import http from 'http'
// import https from "https";


const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));
const httpServer = http.createServer(app);
// const httpsServer = https.createServer(app);

const HTTP_PORT = 8080;

interface HeadPaths {
    headModelPath: string;
    headColorTexPath: string;
    eyeColorLTexPath: string;
    eyeColorRTexPath: string;
}

app.post('/api/thumbnail', async (req, res) => {
    try {
        const {ip, body: reqBody} = req;
        console.log('Request ip ->', ip);
        console.log('Request body ->', reqBody);

        const headModelPath = reqBody.head['final.obj'];
        const headColorTexPath = reqBody.head['headColor.png'];
        const eyeColorLTexPath = reqBody.head['eyeColorL.png'];
        const eyeColorRTexPath = reqBody.head['eyeColorR.png'];
        const headPaths = {
            headModelPath,
            headColorTexPath,
            eyeColorLTexPath,
            eyeColorRTexPath
        }
        console.log('headPaths ->', headPaths);

        const browser = await puppeteer.launch();
        const page = await browser.newPage();


        // Go to page
        const filePath = path.resolve('src/threeScene.html');
        await page.goto(`file://${filePath}`);


        // Pass the OBJ path to the HTML


        // callback fn way
        await page.evaluate((paths: HeadPaths) => {
            console.log('paths in evaluate ->', paths);
            const wd = window as any;
            wd.headPaths = paths;
            wd.dispatchEvent(new Event('headPaths-passed'));
        }, headPaths);


        // Wait for model loading
        await page.waitForFunction('window.isReady2Screenshot === true', {
            timeout: 30000
        });

        const width = 1545;
        const height = 953;

        const fullPage = true;

        await page.setViewport({width, height});
        await page.evaluate(() => document.body.style.background = 'transparent');

        const imgBuffer = await page.screenshot({
            omitBackground: false,
            fullPage
        });

        await browser.close();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Length', imgBuffer.length);
        res.send(imgBuffer);

    } catch (e) {
        res.status(500).send("Error generating thumbnail.");
    }
});

app.post('/api/thumbnail-tst', async (req, res) => {
    try {
        const {ip, body: reqBody} = req;
        console.log('Request ip ->', ip);
        console.log('Request body ->', reqBody);

        const headModelPath = reqBody.head['final.obj'];
        const headColorTexPath = reqBody.head['headColor.png'];
        const eyeColorLTexPath = reqBody.head['eyeColorL.png'];
        const eyeColorRTexPath = reqBody.head['eyeColorR.png'];
        const headPaths = {
            headModelPath,
            headColorTexPath,
            eyeColorLTexPath,
            eyeColorRTexPath
        }
        console.log('headPaths ->', headPaths);

        const browser = await puppeteer.launch();
        const page = await browser.newPage();


        // Go to page
        const filePath = path.resolve('src/threeScene.html');
        await page.goto(`file://${filePath}`);


        // Pass the OBJ path to the HTML


        // callback fn way
        await page.evaluate((paths: HeadPaths) => {
            console.log('paths in evaluate ->', paths);
            const wd = window as any;
            wd.headPaths = paths;
            wd.dispatchEvent(new Event('headPaths-passed'));
        }, headPaths);


        // Wait for model loading
        await page.waitForFunction('window.isReady2Screenshot === true', {
            timeout: 30000
        });

        const width = 1545;
        const height = 953;

        const fullPage = true;

        await page.setViewport({width, height});
        await page.evaluate(() => document.body.style.background = 'transparent');

        const imgBuffer = await page.screenshot({
            omitBackground: false,
            fullPage
        });

        await browser.close();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Length', imgBuffer.length);
        res.send(imgBuffer);

    } catch (e) {
        res.status(500).send("Error generating thumbnail.");
    }
});

app.post('/api/test', async (req, res) => {
    console.log('Request body ->', req.body);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(req.body));
})

app.post('/api/puppeteer-tst', async (req, res) => {
    console.log('Request body ->', req.body);

    const headModelPath = req.body.head['final.obj'];
    const headColorTexPath = req.body.head['headColor.png'];
    const eyeColorLTexPath = req.body.head['eyeColorL.png'];
    const eyeColorRTexPath = req.body.head['eyeColorR.png'];
    const headPaths = {
        headModelPath,
        headColorTexPath,
        eyeColorLTexPath,
        eyeColorRTexPath
    }
    console.log('headPaths ->', headPaths);

    const browser = await puppeteer.launch();
    const page = await browser.newPage();


    // Go to page
    const filePath = path.resolve('src/threeScene.html');
    await page.goto(`file://${filePath}`);


    // Pass the OBJ path to the HTML


    // callback fn way
    await page.evaluate((paths: HeadPaths) => {
        console.log('paths in evaluate ->', paths);
        const wd = window as any;
        wd.headPaths = paths;
        wd.dispatchEvent(new Event('headPaths-passed'));
    }, headPaths);
    // string way
    // function safeEvalString(code: string) {
    //     return code.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    // }
    // const code = `window.headModelPath = "${safeEvalString(headModelPath)}";`;
    // await page.evaluate(code);

    // Pass string tst
    // await page.evaluate((str: string) => {
    //     console.log('passed str in evaluate ->', str);
    //     let wd = window as any;
    //     wd.strPassed = str;
    //     wd.dispatchEvent(new Event('str-passed'));
    // }, 'Passed Str');

    // Wait for model loading
    // await page.waitForFunction(() => window.isReady2Screenshot === true, {
    //     timeout: 30000
    // });
    await page.waitForFunction('window.isReady2Screenshot === true', {
        timeout: 30000
    });


    const width = 1545;
    const height = 953;

    const fullPage = true;

    await page.setViewport({width, height});
    await page.evaluate(() => document.body.style.background = 'transparent');
    // await page.screenshot({path: `imgs/example-${Math.random().toString().substring(2, 6)}.png`, omitBackground: true});

    const imgStoragePathName = `imgs/crt/scrst-${Math.random().toString().substring(2, 6)}`;
    await page.screenshot({
        path: `${imgStoragePathName}.png`,
        omitBackground: false,
        fullPage
    });

    await browser.close();

    res.json({ok: true});
})


httpServer.listen(HTTP_PORT, '0.0.0.0', () =>
    console.log(`HTTP server running at http://localhost:${HTTP_PORT}`)
);