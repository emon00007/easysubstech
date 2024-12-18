const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const Stripe = require("stripe");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.x8jkuyh.mongodb.net/?retryWrites=true&w=majority`;

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
    console.log("Successfully connected to MongoDB!");

    // Database and Collections
    const database = client.db("youtubeBoostingDB");
    const usersCollection = database.collection("users");
    const servicesCollection = database.collection("services");
    const paymentsCollection = database.collection("payments");

    // Routes

    // Home Route
    app.get("/", (req, res) => {
      res.send("Welcome to YouTube Boosting!");
    });

    // Add User
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // Get All Users
    app.get("/users", async (req, res) => {
      try {
        const users = await usersCollection.find({}).toArray();
        res.status(200).send(users);
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // Add Service
    app.post("/services", async (req, res) => {
      try {
        const result = await servicesCollection.insertOne(req.body);
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // Get All Services
    app.get("/services", async (req, res) => {
      try {
        const services = await servicesCollection.find({}).toArray();
        res.status(200).send(services);
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // Get Service by ID
    app.get("/services/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const service = await servicesCollection.findOne({ _id: new ObjectId(id) });
        res.status(200).send(service);
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
      const { fees } = req.body;

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(fees * 100), // Stripe requires the amount in cents
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).send({ error: "Failed to create payment intent" });
      }
    });

    // Save payment details
    app.post("/payments", async (req, res) => {
      const paymentDetails = req.body;

      try {
        const result = await paymentsCollection.insertOne(paymentDetails);
        res.send({ paymentResult: result });
      } catch (error) {
        console.error("Error saving payment:", error);
        res.status(500).send({ error: "Failed to save payment" });
      }
    });

    // Retrieve user data (replace with your logic)
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;

      try {
        // Assuming you fetch user data from your DB
        const userData = await usersCollection.find({ email }).toArray();
        res.send(userData);
      } catch (error) {
        console.error("Error retrieving user data:", error);
        res.status(500).send({ error: "Failed to retrieve user data" });
      }
    });
    
  } finally {
   
  }
}


run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
