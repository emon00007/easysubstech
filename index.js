const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const Stripe = require('stripe');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.x8jkuyh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Stripe Initialization
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// MongoDB Client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Run Function
async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    console.log("Successfully connected to MongoDB!");

    // Database and Collections
    const database = client.db("youtubeBoostingDB");
    const usersCollection = database.collection("users");
    const servicesCollection = database.collection("services");
    // Routes

    // Home Route
    app.get('/', (req, res) => {
      res.send("Welcome to YouTube Boosting!");
    });

    // Add User
    app.post('/users', async (req, res) => {
        const user = req.body;
        const query = { email: user.email }
        const existingUser = await usersCollection.findOne(query)
        if (existingUser) {
            return res.send({ massage: 'user Already Exists', insertedId: null })
        }
        const result = await  usersCollection.insertOne(user);
        res.send(result);
    });

    app.post("/services", async (req, res) => {
        console.log("Received data:", req.body);
        try {
            const result = await servicesCollection.insertOne(req.body);
            res.status(201).send(result);
        } catch (error) {
            console.error("Error inserting data:", error.message);
            res.status(500).send({ error: error.message });
        }
    });
    //   app.post("/services", (req, res) => {
    //     const service = req.body;
    //     // Mock database insertion
    //     console.log("Service received:", service);
    //     res.status(201).json({ message: "Service added successfully!" });
    //   });

      // Get All Services
app.get("/services", async (req, res) => {
  try {
    const services = await servicesCollection.find({}).toArray();
    res.status(200).send(services);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

    // Get Users by Role
    app.get("/users/:role", async (req, res) => {
      const { role } = req.params;
      try {
        const users = await usersCollection.find({ role }).toArray();
        res.status(200).send(users);
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // Create Payment Intent
    app.post("/create-payment-intent", async (req, res) => {
      const { amount } = req.body;

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: "usd",
        });

        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });
  } catch (error) {
    console.error("Error running server:", error);
  }
}



// Add Service




// Get a Single Service by ID
app.get("/services/:id", async (req, res) => {
  const { id } = req.params;
  const { ObjectId } = require("mongodb"); // Ensure this is imported
  try {
    const service = await servicesCollection.findOne({ _id: new ObjectId(id) });
    res.status(200).send(service);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});


// Start the Application
run().catch(console.dir);

// Start the Server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
