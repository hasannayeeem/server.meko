const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 1010


// middleware
app.use(cors());
app.use(express.json());

// verifyJWT 
const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        // console.log(decoded);
        req.decoded = decoded;
        next();
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@sobtool.4pesc.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){
    try{
        await client.connect();
        const productCollection = client.db('sobtool').collection('product');
        const userCollection = client.db('sobtool').collection('users');
        const reviewCollection = client.db('sobtool').collection('reviews');
        const orderCollection = client.db('sobtool').collection('orders');
        const paymentCollection = client.db('sobtool').collection('payment');
        
        // verifyadmin 
        const verifyAdmin = async (req, res, next) =>{
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            }
            else{
                res.status(403).send({message: 'forbidden'});
            }
        }
        
        app.post('/create-payment-intent', async (req, res) =>{
            const service = req.body;
            const price = service.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'USD',
                payment_method_types:['card']
            });
            res.send({clientSecret: paymentIntent.client_secret})
        });
        
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
            const query = {_id: ObjectId(id)};
            const product = await productCollection.findOne(query);
            res.send(product);
        });

        // all order api
        app.get('/allorder', async (req, res) => {
            const query = {};
            const cursor = orderCollection.find(query);
            const orders = await cursor.toArray();
            res.send(orders);
        });

        // all reviews api
        app.get('/reviews', async (req, res) => {
            const query = {};
            const cursor = reviewCollection.find(query);
            const reviews = await cursor.toArray();
            res.send(reviews);
        });
        // all users api (forAdmin) 
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });
        // // single user api 
        // app.get('/user/:id', verifyJWT, async (req, res) => {
        //     const id = req.params.id;
        //     const query = {_id: ObjectId(id)};
        //     const user = await userCollection.findOne(query);
        //     res.send(user);
        // });
        // update or post new user api 
        app.put('/user/:email',  async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email};
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
             res.send({ result, token });
        });
        // get user api 
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            const query = {email: email};
            const user = await userCollection.findOne(query);
            res.send(user);
        });

        app.get('/admin/:email', async (req, res) =>{
            const email = req.params.email;
            const user = await userCollection.findOne({email: email});
            const isAdmin = user.role === 'admin';
            res.send({admin: isAdmin})
        });

        // make admin api for admin
        app.put('/user/admin/:email', verifyAdmin, async (req, res) => {
            const email = req.params.email;
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);
        });

        app.get('/orders', verifyJWT,   async (req, res) => {
            const customer = req.query.customer;
            const decodedEmail = req.decoded.email;
            if (customer === decodedEmail) {
                const query = { customer: customer };
                const orders = await orderCollection.find(query).toArray();
                return res.send(orders);
            }
            else {
                return res.status(403).send({ message: 'Forbidden access' });
            }
        });

        app.get('/orders/:id',  verifyJWT, async (req, res) =>{
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const order = await orderCollection.findOne(query);
            res.send(order);
        });
        
        // delete order api for user 
        app.delete('/orders/:id',  async (req, res) =>{
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const order = await orderCollection.deleteOne(query);
            res.send(order);
        });

        // delete user api for admin 
        app.delete('/users/:id',  async (req, res) =>{
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const user = await userCollection.deleteOne(query);
            res.send(user);
        });

        // single order post api 
        app.post('/order', async (req, res) => {
            const order = req.body; 
            const result = await orderCollection.insertOne(order);
            return res.send({ success: true, result });
        });

        // update order api for user payment 
        app.patch('/orders/:id', verifyJWT, async (req, res) =>{
            const id = req.params.id;
            const payment = req.body;
            const filter = {_id: ObjectId(id)};
            const updateDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updatedOrders = await orderCollection.updateOne(filter, updateDoc);
            res.send(updateDoc);
        });

        //POST product api
        app.post('/products', async (req, res) => {
            const newProduct = req.body;
            const result = await productCollection.insertOne(newProduct);
            res.send(result)
        });
        //POST review api
        app.post('/reviews', async (req, res) => {
            const newReview = req.body;
            const result = await reviewCollection.insertOne(newReview);
            res.send(result)
        });

        // DELETE api for manage products
        app.delete('/products/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const query = { _id: ObjectId(id) };
            const result = await productCollection.deleteOne(query);
            res.send(result);
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
