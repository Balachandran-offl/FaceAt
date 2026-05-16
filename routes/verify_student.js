const { getBucket } = require("../models/gridfs");

const mongoose = require("mongoose");

const express = require("express");

const jwt = require("jsonwebtoken");

const axios = require("axios");

const FormData = require("form-data");

const multer = require("multer");

const JWT_SECRET = process.env.JWT_SECRET;

const router = express.Router();


// =========================================
// MULTER CONFIGURATION
// =========================================

const storage = multer.memoryStorage();

const upload = multer({
    storage: storage
});


// =========================================
// PROCESS ATTENDANCE
// =========================================

router.post(

    "/process-attendance",

    upload.single("classroomImage"),

    async (req, res) => {

        try {

            // Check uploaded file
            if (!req.file) {

                return res.status(400).json({

                    success: false,

                    message:
                        "No classroom image uploaded"
                });
            }

            // Create FormData for FastAPI
            const formdata = new FormData();

            formdata.append(

                "file",

                req.file.buffer,

                req.file.originalname
            );

            // Send image to FastAPI
            const fastapiresponse =
                await axios.post(

                    "http://127.0.0.1:8000/process-attendance",

                    formdata,

                    {
                        headers:
                            formdata.getHeaders()
                    }
                );

            // Return response to frontend
            return res.status(200).json({

                success: true,

                presentStudents:
                    fastapiresponse.data.presentStudents,

                absentStudents:
                    fastapiresponse.data.absentStudents
            });

        }
        catch (error) {

            console.error(

                "Attendance Processing Error:",

                error.message
            );

            return res.status(500).json({

                success: false,

                message:
                    "Attendance processing failed"
            });
        }
    }
);


// =========================================
// STUDENT STATUS
// =========================================

router.get('/student-status', async (req, res) => {

    try {

        const bucket = getBucket();

        const authHeader =
            req.headers.authorization;

        if (!authHeader) {

            return res.status(401).json({

                message: "No token provided"
            });
        }

        const token =
            authHeader.split(" ")[1];

        const decoded =
            jwt.verify(token, JWT_SECRET);

        const email = decoded.email;

        // Find student image
        const file = await bucket.find({

            "metadata.email": email

        }).next();

        if (file) {

            return res.json({

                exists: true,

                verified:
                    file.metadata.verified
            });
        }

        return res.json({

            exists: false,

            verified: false
        });

    }
    catch (error) {

        console.error(

            "Student Status Error:",

            error
        );

        return res.status(500).json({

            message: "Server Error"
        });
    }
});


// =========================================
// APPROVED STUDENT COUNT
// =========================================

router.get('/approved-stats', async (req, res) => {

    try {

        const db = mongoose.connection.db;

        const count = await db
            .collection("studentImages.files")
            .countDocuments({

                "metadata.verified": true
            });

        return res.json({ count });

    }
    catch (error) {

        console.error("Stats Error:", error);

        return res.status(500).json({

            message: "Error fetching stats"
        });
    }
});


// =========================================
// FETCH PENDING VERIFICATION IMAGES
// =========================================

router.get(

    '/pending-verification',

    async (req, res) => {

        try {

            const bucket = getBucket();

            const files = await bucket.find({

                "metadata.verified": false

            }).toArray();

            if (!files || files.length === 0) {

                return res.status(200).json([]);
            }

            const studentData =
                await Promise.all(

                    files.map(async (file) => {

                        return new Promise((resolve) => {

                            const chunks = [];

                            const downloadStream =
                                bucket.openDownloadStream(
                                    file._id
                                );

                            // Read GridFS chunks
                            downloadStream.on(
                                'data',
                                (chunk) => {

                                    chunks.push(chunk);
                                }
                            );

                            // After full image downloaded
                            downloadStream.on(
                                'end',
                                () => {

                                    const buffer =
                                        Buffer.concat(chunks);

                                    const email =
                                        file.metadata.email || "";

                                    const extractedRollNumber =
                                        email.split('@')[0];

                                    resolve({

                                        rollNumber:
                                            extractedRollNumber,

                                        email: email,

                                        qualityScore:
                                            file.metadata.qualityScore ??
                                            file.metadata.qualityscore,

                                        image: {

                                            data: buffer,

                                            contentType:
                                                file.contentType ||
                                                "image/jpeg"
                                        }
                                    });
                                }
                            );

                            // Stream error
                            downloadStream.on(
                                'error',
                                (err) => {

                                    console.error(
                                        "Stream Error:",
                                        err
                                    );

                                    resolve(null);
                                }
                            );
                        });
                    })
                );

            return res.json(

                studentData.filter(
                    item => item !== null
                )
            );
        }
        catch (error) {

            console.error(

                "GridFS Fetch Error:",

                error
            );

            return res.status(500).json({

                message: "GridFS Fetch Error"
            });
        }
    }
);


// =========================================
// STAFF VERIFY DECISION
// =========================================

router.post(

    '/verify-decision',

    async (req, res) => {

        const { rollNumber, action } =
            req.body;

        const bucket = getBucket();

        try {

            // Match email starting with roll number
            const emailPattern =
                new RegExp(
                    `^${rollNumber}@`,
                    'i'
                );

            const file = await bucket.find({

                "metadata.email": emailPattern

            }).next();

            if (!file) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Student record not found"
                });
            }


            // =========================================
            // ACCEPT STUDENT
            // =========================================

            if (action === 'accept') {

                const db =
                    mongoose.connection.db;

                const chunks = [];

                const downloadStream =
                    bucket.openDownloadStream(
                        file._id
                    );

                // Read image chunks
                downloadStream.on(
                    'data',
                    (chunk) => {

                        chunks.push(chunk);
                    }
                );

                // After image fully downloaded
                downloadStream.on(

                    'end',

                    async () => {

                        try {

                            // Combine chunks
                            const buffer =
                                Buffer.concat(chunks);

                            // Create multipart/form-data
                            const form =
                                new FormData();

                            form.append(

                                "file",

                                buffer,

                                {

                                    filename:
                                        "student.jpg",

                                    contentType:
                                        "image/jpeg"
                                }
                            );

                            // Send image to FastAPI
                            const response =
                                await axios.post(

                                    "http://localhost:8000/generate-embedding",

                                    form,

                                    {
                                        headers:
                                            form.getHeaders()
                                    }
                                );

                            // Embedding failed
                            if (
                                !response.data.success
                            ) {

                                return res.status(400).json({

                                    success: false,

                                    message:
                                        response.data.message
                                });
                            }

                            // Extract embedding
                            const embedding =
                                response.data.embedding;

                            // Store embedding
                            await db
                                .collection(
                                    "studentEmbeddings"
                                )
                                .insertOne({

                                    rollNo:
                                        rollNumber,

                                    email:
                                        file.metadata.email,

                                    embedding:
                                        embedding,

                                    gridfsFileId:
                                        file._id
                                });

                            // Mark verified
                            await db
                                .collection(
                                    "studentImages.files"
                                )
                                .updateOne(

                                    {
                                        _id:
                                            file._id
                                    },

                                    {
                                        $set: {
                                            "metadata.verified":
                                                true
                                        }
                                    }
                                );

                            return res.json({

                                success: true,

                                message:
                                    "Approved and embedding stored"
                            });
                        }
                        catch (err) {

                            console.error(

                                "Embedding Generation Error:",

                                err
                            );

                            return res.status(500).json({

                                success: false,

                                message:
                                    "Embedding generation failed"
                            });
                        }
                    }
                );

                // Stream error
                downloadStream.on(

                    'error',

                    (err) => {

                        console.error(

                            "GridFS Download Error:",

                            err
                        );

                        return res.status(500).json({

                            success: false,

                            message:
                                "Error reading image from GridFS"
                        });
                    }
                );
            }


            // =========================================
            // REJECT STUDENT
            // =========================================

            if (action === 'reject') {

                await bucket.delete(file._id);

                return res.json({

                    success: true,

                    message:
                        "Rejected and image deleted"
                });
            }

        }
        catch (error) {

            console.error(
                "Decision Error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Internal Decision Error"
            });
        }
    }
);

module.exports = router;