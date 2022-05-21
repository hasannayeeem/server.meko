const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 5050


// middleware
app.use(cors());
app.use(express.json());







app.get('/', (req, res) => {
    res.send('hello from toolsy!')
})
app.listen(port, () => {
    console.log(`toolsy app listening on port ${port}`);
})
