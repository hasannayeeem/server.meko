const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const { ObjectID } = require('bson');
const app = express();
const port = process.env.PORT || 1010


// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@sobtool.4pesc.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){
    try{
        await client.connect();
        const productCollection = client.db('sobtool').collection('product');
        // all products api
        app.get('/products', async (req, res) => {
            const query = {};
            const cursor = productCollection.find(query);
            const products = await cursor.toArray();
            res.send(products);
        });
        // single product api 
        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = {_id: ObjectID(id)};
            const product = await productCollection.findOne(query);
            res.send(product);
        });
    }
    finally{
        
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('hello from toolsy!')
})
app.listen(port, () => {
    console.log(`toolsy app listening on port ${port}`);
})
