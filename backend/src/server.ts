import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/thumbnail', (req, res) => {
    // TODO: Load the model and render to PNG
    // console.log('req ->', req);
    console.log("Body:", req.body);
    res.json({ok: true});
})

app.listen(3000, () => {
    console.log('Server running on port 3000');
});