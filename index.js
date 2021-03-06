const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const app = express()
const cors = require('cors');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY0);
let jwt = require('jsonwebtoken');



require('dotenv').config()
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// const uri = "mongodb+srv://doctor_admin:MkoOVty4ROTRMPfz@cluster0.af5hd.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.af5hd.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    let authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorization Access' });
    }
    let token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ massage: 'Forbidden Access' });
        }
        req.decoded = decoded;
        console.log(decoded);
        next()

    });
}


async function run() {
    try {
        await client.connect();
        let doctorServicesdb = client.db("doctor_portal").collection("services");
        let bookingdb = client.db("doctor_portal").collection("booking");
        let userdb = client.db("doctor_portal").collection("user");
        let doctordb = client.db("doctor_portal").collection("doctors");


        let verifyAdmin = async (req, res, next) => {
            let requester = req.decoded.email;
            let requesterAccount = await userdb.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next()
            }
            else {
                return res.status(403).send({ massage: 'Forbidden Access' });
            }
        }

        app.get('/doctors', verifyJWT, verifyAdmin, async(req, res)=> {
            let doctors = await doctordb.find().toArray();
            res.send(doctors);
        });

        app.get('/services', async (req, res) => {
            let query = {}
            let cursor = doctorServicesdb.find(query).project({ name: 1 });
            let result = await cursor.toArray();
            res.send(result);
        });

        app.get('/user', verifyJWT, async (req, res) => {
            let result = await userdb.find().toArray();
            res.send(result);
        });

        app.get('/admin/:email', verifyJWT, async (req, res) => {
            let email = req.params.email;
            let user = await userdb.findOne({ email: email });
            let isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        });


        app.post('/create-payment-intent', verifyJWT, async(req, res)=> {
            let service = req.body;
            let price = service.price;
            let amount = price * 100;
            
            let paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd  ",
                payment_method_types: ['card'],
            })
            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        })

        // app.put('/user/admin/:email', verifyJWT, async (req, res) => {
        //     let email = req.params.email;
        //     let requester = req.decoded.email;
        //     let requesterAccount = await userdb.findOne({ email: requester });
        //     if (requesterAccount.role === 'admin') {
        //         let filter = { email: email };
        //         const updateDoc = {
        //             $set: { role: 'admin' },
        //         };
        //         let result = await userdb.updateOne(filter, updateDoc);
        //         res.send(result);
        //     }
        //     else {
        //         return res.status(403).send({ massage: 'Forbidden Access' });
        //     }
        // });


        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            let email = req.params.email;
            let filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            let result = await userdb.updateOne(filter, updateDoc);
            res.send(result);
        });



        app.put('/user/:email', async (req, res) => {
            let email = req.params.email;
            let user = req.body;
            let filter = { email: email };
            let option = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            let result = await userdb.updateOne(filter, updateDoc, option);
            let accessToken = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '10d' });
            res.send({ result, token: accessToken });
        });

        app.get('/booking', verifyJWT, async (req, res) => {
            let email = req.query.email;
            // let authorization = req.headers.authorization;
            let decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                let query = { patientEmail: email };
                let result = await bookingdb.find(query).toArray();
                return res.send(result);
            }
            else {
                return res.status(403).send({ massage: 'Forbidden Access' });
            }

        })

        app.post('/doctors', verifyJWT, async (req, res) => {
            let doctor = req.body;
            let result = await doctordb.insertOne(doctor);
            res.send(result);
        });

        app.delete('/doctors/:email', verifyJWT, verifyAdmin, async(req, res) => {
            let email = req.params.email;
            let filter = {email: email};
            let result = await doctordb.deleteOne(filter);
            res.send(result);
        })

        app.post('/booking', async (req, res) => {
            let booking = req.body;
            let query = { name: booking.name, patientEmail: booking.patientEmail, date: booking.date }
            let exits = await bookingdb.findOne(query);
            if (exits) {
                return res.send({ success: false, booking: exits })
            }
            else {
                let result = await bookingdb.insertOne(booking);
                return res.send({ success: true, result });
            }

        });

        app.get('/payment/:id', verifyJWT, async(req, res) => {
            let id = req.params.id;
            let query = {_id: ObjectId(id)};
            let data = await bookingdb.findOne(query);
            res.send(data);

        })

        app.get('/available', async (req, res) => {

            let date = req.query.date;
            let services = await doctorServicesdb.find().toArray();
            let query = { date: date };
            let bookings = await bookingdb.find(query).toArray();
            services.forEach(service => {
                let serviceBooking = bookings.filter(b => b.service === service.name);
                let bookedSlots = serviceBooking.map(booked => booked.slot);
                let available = service.slots.filter(s => !bookedSlots.includes(s));
                // console.log(available);
                service.slots = available;
            })

            res.send(services);
        });





    }

    finally {

    }



}




run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Doctor On Fire!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})