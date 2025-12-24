require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('❌ MongoDB Error:', err));

// User Schema
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    otp: String,
    otpExpires: Date
});
const User = mongoose.model('User', UserSchema);

// Email Setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ROUTE: SIGNUP (Create Account)
app.post('/signup', async (req, res) => {
    const email = req.body.email.trim().toLowerCase();
    const password = req.body.password.trim();
    try {
        const newUser = new User({ email, password });
        await newUser.save();
        res.json({ success: true, message: 'Account created for Aimers Classes!' });
    } catch (error) {
        res.json({ success: false, message: 'Account already exists.' });
    }
});

// ROUTE: LOGIN (Send OTP)
app.post('/login', async (req, res) => {
    const email = req.body.email.trim().toLowerCase();
    const password = req.body.password.trim();
    try {
        const user = await User.findOne({ email, password });
        if (!user) return res.json({ success: false, message: 'Incorrect email or password.' });

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otpCode;
        user.otpExpires = Date.now() + 5 * 60 * 1000;
        await user.save();

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your Aimers Classes Login Code',
            text: `Welcome! Your verification code is: ${otpCode}`
        });
        res.json({ success: true, message: 'OTP sent to your email!' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ROUTE: VERIFY OTP
app.post('/verify', async (req, res) => {
    const email = req.body.email.trim().toLowerCase();
    const otp = req.body.otp.trim();
    try {
        const user = await User.findOne({ email });
        if (user && user.otp === otp && user.otpExpires > Date.now()) {
            user.otp = null;
            user.otpExpires = null;
            await user.save();
            res.json({ success: true, message: 'Login successful!' });
        } else {
            res.json({ success: false, message: 'Invalid or expired code.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Verification error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));

