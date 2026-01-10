const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const nodemailer = require("nodemailer");
const axios = require("axios");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

/**
 * IMPORTANT:
 * We must NOT use express.json() on Paystack webhook
 */
app.use(cors());
app.use((req, res, next) => {
  if (req.originalUrl === "/api/paystack/webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});

/**
 * ROOT TEST ROUTE
 */
app.get("/", (req, res) => {
  res.send("Backend connected to Render!");
});

/**
 * 1️⃣ INITIALIZE PAYMENT (THIS WAS MISSING)
 * Frontend MUST call this endpoint
 */
app.post("/initialize-payment", async (req, res) => {
  try {
    const { email, amount, phone, provider } = req.body;

    if (!email || !amount || !phone || !provider) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount, // in pesewas (e.g. 7500 = GHS 75)
        currency: "GHS",
        channels: ["mobile_money"],
        mobile_money: {
          phone,
          provider // "vod" for Telecel
        },
        callback_url:
          "https://superstackedgiveaways.github.io/Superstackedgiveaways/payment-success.html"
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.json(response.data);
  } catch (error) {
    console.error(
      "PAYSTACK INITIALIZE ERROR:",
      error.response?.data || error.message
    );
    return res.status(500).json({
      success: false,
      message: "Payment initialization failed"
    });
  }
});

/**
 * 2️⃣ PAYSTACK WEBHOOK (CONFIRMATION)
 */
app.post(
  "/api/paystack/webhook",
  bodyParser.raw({ type: "application/json" }),
  (req, res) => {
    const event = JSON.parse(req.body.toString());

    console.log("PAYSTACK EVENT:", event.event);

    if (event.event === "charge.success") {
      console.log("PAYMENT SUCCESS:", event.data.reference);
      // You can save this to DB if needed
    }

    res.sendStatus(200);
  }
);

/**
 * 3️⃣ VERIFY PAYMENT + SEND EMAIL (YOUR EXISTING LOGIC)
 */
app.post("/verify-payment", async (req, res) => {
  const { reference, email } = req.body;

  if (!reference || !email) {
    return res.status(400).json({
      success: false,
      message: "Missing reference or email"
    });
  }

  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const data = await response.json();

    if (data.status && data.data.status === "success") {
      const uniqueCode = "STACKED_" + Math.floor(Math.random() * 1000000000);

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Your Stacked Giveaway Entry Code",
        text: `🎉 Congratulations! Your unique code is: ${uniqueCode}`
      };

      transporter.sendMail(mailOptions, (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({
            success: false,
            message: "Failed to send email"
          });
        }

        return res.json({
          success: true,
          message: "Payment verified and email sent",
          code: uniqueCode
        });
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Payment not successful"
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/**
 * START SERVER
 */
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
