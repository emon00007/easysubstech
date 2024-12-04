const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const Stripe = require('stripe');
const nodemailer = require('nodemailer');
const crypto = require('crypto'); // To generate OTP

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

// Nodemailer Setup for OTP
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
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

    // Home Route
    app.get('/', (req, res) => {
      res.send("Welcome to YouTube Boosting!");
    });

    // Add User
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'User already exists', insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
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

    // OTP Generation and Email Sending Route
    app.post('/send-otp', async (req, res) => {
      const { email } = req.body;

      // Generate OTP
      const otp = crypto.randomInt(100000, 999999).toString();

      try {
        // Check if the user exists
        let user = await usersCollection.findOne({ email });
        if (!user) {
          user = { email, otp }; // Create new user with OTP
        } else {
          user.otp = otp; // Update existing user with new OTP
        }

        // Save OTP in database
        await usersCollection.updateOne(
          { email },
          { $set: { otp } },
          { upsert: true }
        );

        // Send OTP to user email
        await transporter.sendMail({
          from: `"YouTube Boosting" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Your OTP for YouTube Boosting',
          html: `<h3>Your OTP is: <strong>${otp}</strong></h3><p>Please use this to verify your account.</p>`,
        });

        res.status(200).send({ message: 'OTP sent to your email!' });
      } catch (error) {
        res.status(500).send({ error: 'Failed to send OTP' });
      }
    });

    // OTP Verification Route
    app.post('/verify-otp', async (req, res) => {
      const { email, otp } = req.body;

      try {
        // Find user by email
        const user = await usersCollection.findOne({ email });

        if (!user) {
          return res.status(400).send({ error: 'User not found' });
        }

        if (user.otp === otp) {
          // OTP matches, mark user as verified
          await usersCollection.updateOne(
            { email },
            { $set: { isVerified: true, otp: null } } // Clear OTP after successful verification
          );

          res.status(200).send({ message: 'OTP verified successfully!' });
        } else {
          res.status(400).send({ error: 'Invalid OTP' });
        }
      } catch (error) {
        res.status(500).send({ error: 'Failed to verify OTP' });
      }
    });

    // Resend OTP Route
    app.post('/resend-otp', async (req, res) => {
      const { email } = req.body;

      try {
        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(400).send({ error: 'User not found' });
        }

        // Generate new OTP and save
        const otp = crypto.randomInt(100000, 999999).toString();
        await usersCollection.updateOne(
          { email },
          { $set: { otp } }
        );

        // Send new OTP via email
        await transporter.sendMail({
          from: `"YouTube Boosting" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Your New OTP for YouTube Boosting',
          html: `<h3>Your new OTP is: <strong>${otp}</strong></h3><p>Please use this to verify your account.</p>`,
        });

        res.status(200).send({ message: 'New OTP sent to your email!' });
      } catch (error) {
        res.status(500).send({ error: 'Failed to resend OTP' });
      }
    });

    // Start the Application
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });

  } catch (error) {
    console.error("Error running server:", error);
  }
}

run().catch(console.dir);
