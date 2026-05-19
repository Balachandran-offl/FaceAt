require('dotenv').config();
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const JWT_SECRET = process.env.JWT_SECRET;

// --- Registration Route ---
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role} = req.body; // Added role to destructuring

        const userExists = await User.findOne({ email }); // Fixed variable name (userExist vs userExists)
        if (userExists) {
            return res.status(400).json({ message: "Email already registered" });
        }

        const salt = await bcrypt.genSalt(10); // Fixed typo: genSalt (lowercase 's')
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: role // Ensure role is defined
        });

        await newUser.save();
        res.status(201).json({ message: "User created successfully" });
    } catch (error) {
        console.error(error); // Good to log the error for debugging
        res.status(500).json({ message: "Registration error" });
    }
});

// --- Login Route ---
router.post('/login', async (req, res) => { // Added missing '/' in front of 'login'
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email }); // Fixed typo: await (not awit)
        if (!user) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        const isMatch = await bcrypt.compare(password, user.password); // Fixed typos: compare and isMatch
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        // Generate the token
        const token = jwt.sign(
        { id: user._id, email: user.email ,role : user.role},
            JWT_SECRET,
        { expiresIn: '1h' }
        );


        res.json({
            token,
            user: {
                name: user.name,
                email: user.email,
                role:user.role
            }
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "Login error" });
    }
});

module.exports = router;
