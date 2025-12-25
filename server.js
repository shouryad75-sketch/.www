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
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ Connection Error:', err));

// User Schema
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    otp: String,
    otpExpires: Date
});
const User = mongoose.model('User', UserSchema);

// Email Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ROUTE: SIGNUP
app.post('/signup', async (req, res) => {
    try {
        const email = req.body.email.trim().toLowerCase();
        const password = req.body.password.trim();
        const newUser = new User({ email, password });
        await newUser.save();
        res.json({ success: true, message: 'Account created for Aimers Classes!' });
    } catch (error) {
        res.json({ success: false, message: 'Registration failed or email exists.' });
    }
});

// ROUTE: LOGIN
app.post('/login', async (req, res) => {
    try {
        const email = req.body.email.trim().toLowerCase();
        const password = req.body.password.trim();
        
        const user = await User.findOne({ email, password });
        if (!user) return res.json({ success: false, message: 'Incorrect email or password.' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpires = Date.now() + 5 * 60 * 1000;
        await user.save();

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Aimers Classes Login OTP',
            text: `Welcome back! Your OTP is: ${otp}`
        });
        res.json({ success: true, message: 'OTP sent to email.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});

// ROUTE: VERIFY
app.post('/verify', async (req, res) => {
    try {
        const email = req.body.email.trim().toLowerCase();
        const otp = req.body.otp.trim();
        const user = await User.findOne({ email });
        
        if (user && user.otp === otp && user.otpExpires > Date.now()) {
            user.otp = null;
            user.otpExpires = null;
            await user.save();
            res.json({ success: true, message: 'Verified!' });
        } else {
            res.json({ success: false, message: 'Invalid or expired OTP.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error during verification.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server active on port ${PORT}`));
