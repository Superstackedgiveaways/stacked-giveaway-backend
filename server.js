const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// Root route for testing
app.get("/", (req, res) => {
  res.send("Backend connected to Render!");
});

// Verify Paystack payment and send unique code
app.post("/verify-payment", async (req, res) => {
  const { reference, email } = req.body;

  if (!reference || !email) {
    return res.status(400).json({ success: false, message: "Missing reference or email" });
  }

  try {
    // Verify payment with Paystack
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
      }
    });
    const data = await response.json();

    if (data.status && data.data.status === "success") {
      // Generate unique code
      const uniqueCode = "STACKED_" + Math.floor(Math.random() * 1000000000);

      // Send email
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

      transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ success: false, message: "Failed to send email" });
        } else {
          return res.json({ success: true, message: "Payment verified! Email sent.", code: uniqueCode });
        }
      });
    } else {
      return res.status(400).json({ success: false, message: "Payment not verified" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
