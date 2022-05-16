const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express')
const app = express()
const cors = require('cors');
let jwt = require('jsonwebtoken');

require('dotenv').config()
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// const uri = "mongodb+srv://doctor_admin:MkoOVty4ROTRMPfz@cluster0.af5hd.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.af5hd.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        let doctorServicesdb = client.db("doctor_portal").collection("services");
        let bookingdb = client.db("doctor_portal").collection("booking");
        let userdb = client.db("doctor_portal").collection("user");

        app.get('/services', async (req, res) => {
            let query = {}
            let cursor = doctorServicesdb.find(query);
            let result = await cursor.toArray();
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
            let accessToken = jwt.sign({email: email}, process.env.ACCESS_TOKEN, { expiresIn:'10d'});
            res.send({result, token: accessToken});
        })

        app.get('/booking', async (req, res) => {
            let email = req.query.email;
            let query = { patientEmail: email };
            let result = await bookingdb.find(query).toArray();
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
        })



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