const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express')
const app = express()
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = "mongodb+srv://doctor_admin:MkoOVty4ROTRMPfz@cluster0.af5hd.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.af5hd.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        let doctorServicesdb = client.db("doctor_portal").collection("services");


        app.get('/services', async(req, res)=> {
            let query = {}
            let cursor = doctorServicesdb.find(query);
            let result = await cursor.toArray();
            res.send(result);
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