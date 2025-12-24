require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Middleware: Allows the frontend to send data to the backend
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // This lets us show the HTML files

// 1. Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('❌ MongoDB Error:', err));

// 2. Define how user data looks in the database
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    otp: String,         // Stores the temporary code
    otpExpires: Date     // Stores when the code expires
});
const User = mongoose.model('User', UserSchema);

// 3. Setup the Email Sender
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
// ROUTE 1: REGISTER (Sign Up)
app.post('/signup', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Create new user in database
        const newUser = new User({ email, password });
        await newUser.save();
        res.json({ success: true, message: 'User registered! Please login.' });
    } catch (error) {
        res.json({ success: false, message: 'Error: Email might already exist.' });
    }
});

// ROUTE 2: LOGIN (Generate & Send OTP)
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Find user
        const user = await User.findOne({ email, password });
        if (!user) {
            return res.json({ success: false, message: 'Invalid email or password.' });
        }

        // Generate 6-digit Code
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Save OTP to database (valid for 5 minutes)
        user.otp = otpCode;
        user.otpExpires = Date.now() + 5 * 60 * 1000;
        await user.save();

        // Send Email
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your Login Code',
            text: `Your OTP is: ${otpCode}`
        });

        res.json({ success: true, message: 'OTP sent to your email!' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ROUTE 3: VERIFY OTP
app.post('/verify', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await User.findOne({ email });
        
        // Check if OTP matches and hasn't expired
        if (user && user.otp === otp && user.otpExpires > Date.now()) {
            // Clear the OTP so it can't be used twice
            user.otp = null;
            user.otpExpires = null;
            await user.save();
            res.json({ success: true, message: 'Login Success!' });
        } else {
            res.json({ success: false, message: 'Invalid or expired OTP.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error verifying.' });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
