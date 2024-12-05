const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
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

// In-memory storage for OTPs (use a database like Redis for production)
const otpStore = {};

// Email Configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Helper Function to Generate OTP
const generateOtp = () => crypto.randomInt(100000, 999999).toString();

// Run Function
async function run() {
  try {
  
    console.log("Successfully connected to MongoDB!");

    // Database and Collections
    const database = client.db("youtubeBoostingDB");
    const usersCollection = database.collection("users");
    const servicesCollection = database.collection("services");

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

    // OTP Routes

    // Send OTP
    app.post("/send-otp", (req, res) => {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const otp = generateOtp();
      otpStore[email] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Your OTP for Signup",
        text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
      };

      transporter.sendMail(mailOptions, (err) => {
        if (err) {
          return res.status(500).json({ message: "Failed to send OTP" });
        }
        res.status(200).json({ message: "OTP sent successfully" });
      });
    });

    // Verify OTP
    app.post("/verify-otp", (req, res) => {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required" });
      }

      const record = otpStore[email];
      if (!record) {
        return res.status(400).json({ message: "No OTP found for this email" });
      }

      if (Date.now() > record.expiresAt) {
        return res.status(400).json({ message: "OTP has expired" });
      }

      if (record.otp !== otp) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      delete otpStore[email];
      res.status(200).json({ message: "OTP verified successfully" });
    });

  } catch (error) {
    console.error("Error running server:", error);
  }
}

// Start the Application
run().catch(console.dir);

// Start the Server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
