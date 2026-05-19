require('dotenv').config();
const express = require('express');
const { getBucket } = require("../models/gridfs");
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const jwt = require('jsonwebtoken');
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

router.post('/verify-quality', upload.single('profileImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No image provided" });
        }
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: "No token provided" });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const email = decoded.email;
        const rollNumber = email.split("@")[0];
        const form = new FormData();
        form.append('file', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
        });

        const pythonResponse = await axios.post(`${PYTHON_SERVICE_URL}/score`, form, {
            headers: { ...form.getHeaders() }
        });

        const score = pythonResponse.data.score;
        if (score >= 0.8) {

            const bucket = getBucket();

            // Replace any existing image for this student before saving the new one
            const existingFiles = await bucket.find({ "metadata.email": email }).toArray();
            for (const file of existingFiles) {
                await bucket.delete(file._id);
            }

            const uploadStream = bucket.openUploadStream(req.file.originalname, {
                metadata: {
                    email,
                    rollNumber,
                    verified: false,
                    uploadedAt: new Date(),
                    qualityScore: score
                },
                contentType: req.file.mimetype
            });

            await new Promise((resolve, reject) => {
                uploadStream.on("finish", resolve);
                uploadStream.on("error", reject);
                uploadStream.end(req.file.buffer);
            });

        }
        return res.json({
            qualityScore: score,
            message: score >= 0.8 ? "Quality Accepted" : "Quality Low"
        });

    } catch (error) {
        console.error("Internal Error:", error);
        res.status(500).json({
            message: error.message || "Error during image quality verification"
        });
    }
});

module.exports = router;
