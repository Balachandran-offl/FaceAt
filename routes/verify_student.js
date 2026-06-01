const { getBucket } = require("../models/gridfs");

const mongoose = require("mongoose");

const express = require("express");

const jwt = require("jsonwebtoken");

const axios = require("axios");

const FormData = require("form-data");

const multer = require("multer");

const JWT_SECRET = process.env.JWT_SECRET;
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "https://faceat1.onrender.com";

const router = express.Router();

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function clearAcceptProcessingState(filesCollection, fileId) {
    await filesCollection.updateOne(
        { _id: fileId },
        {
            $unset: {
                "metadata.processingAccept": "",
                "metadata.processingStartedAt": ""
            }
        }
    );
}

function getRollNumberFromFile(file) {
    return (
        file?.metadata?.rollNumber ||
        String(file?.metadata?.email || "").split("@")[0]
    );
}

function mapGridFsFileToStudent(file, buffer) {
    return {
        rollNumber:
            getRollNumberFromFile(file),
        email:
            file.metadata?.email || "",
        filename:
            file.filename || "",
        contentType:
            file.contentType ||
            "image/jpeg",
        qualityScore:
            file.metadata?.qualityScore ??
            file.metadata?.qualityscore ??
            0,
        verifiedAt:
            file.metadata?.verifiedAt ||
            null,
        uploadedAt:
            file.metadata?.uploadedAt ||
            file.uploadDate ||
            null,
        processingAccept:
            Boolean(
                file.metadata?.processingAccept
            ),
        image: {
            data: buffer,
            contentType:
                file.contentType ||
                "image/jpeg"
        }
    };
}

async function fetchStudentImagesByVerification(
    bucket,
    verified
) {
    const files = await bucket.find({
        "metadata.verified": verified
    }).toArray();

    if (!files || files.length === 0) {
        return [];
    }

    files.sort((left, right) => {
        const leftDate = new Date(
            left.metadata?.verifiedAt ||
            left.metadata?.uploadedAt ||
            left.uploadDate ||
            0
        );
        const rightDate = new Date(
            right.metadata?.verifiedAt ||
            right.metadata?.uploadedAt ||
            right.uploadDate ||
            0
        );

        return rightDate - leftDate;
    });

    const studentData = await Promise.all(
        files.map(async (file) => {
            return new Promise((resolve) => {
                const chunks = [];
                const downloadStream =
                    bucket.openDownloadStream(
                        file._id
                    );

                downloadStream.on(
                    "data",
                    (chunk) => {
                        chunks.push(chunk);
                    }
                );

                downloadStream.on(
                    "end",
                    () => {
                        resolve(
                            mapGridFsFileToStudent(
                                file,
                                Buffer.concat(
                                    chunks
                                )
                            )
                        );
                    }
                );

                downloadStream.on(
                    "error",
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

    return studentData.filter(
        (item) => item !== null
    );
}


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
                    `${PYTHON_SERVICE_URL}/process-attendance`,
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
            const studentData =
                await fetchStudentImagesByVerification(
                    bucket,
                    false
                );

            return res.json(studentData);
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

router.get(

    '/approved-verification',

    async (req, res) => {

        try {

            const bucket = getBucket();
            const studentData =
                await fetchStudentImagesByVerification(
                    bucket,
                    true
                );

            return res.json(studentData);
        }
        catch (error) {

            console.error(

                "Approved GridFS Fetch Error:",

                error
            );

            return res.status(500).json({

                message:
                    "Approved GridFS Fetch Error"
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

            if (
                !rollNumber ||
                !['accept', 'reject'].includes(action)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid verification request"
                });
            }

            const db =
                mongoose.connection.db;

            const filesCollection =
                db.collection(
                    "studentImages.files"
                );

            const embeddingsCollection =
                db.collection(
                    "studentEmbeddings"
                );

            // Match email starting with roll number
            const emailPattern =
                new RegExp(
                    `^${escapeRegex(rollNumber)}@`,
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

                if (file.metadata?.verified) {

                    return res.status(409).json({

                        success: false,

                        message:
                            "This image has already been approved."
                    });
                }

                const claimResult =
                    await filesCollection.updateOne(

                        {
                            _id: file._id,
                            "metadata.verified":
                                false,
                            "metadata.processingAccept":
                                { $ne: true }
                        },

                        {
                            $set: {
                                "metadata.processingAccept":
                                    true,
                                "metadata.processingStartedAt":
                                    new Date()
                            }
                        }
                    );

                if (
                    claimResult.modifiedCount === 0
                ) {

                    const latestFile =
                        await filesCollection.findOne(
                            { _id: file._id },
                            {
                                projection: {
                                    metadata: 1
                                }
                            }
                        );

                    return res.status(409).json({

                        success: false,

                        message:
                            latestFile?.metadata
                                ?.verified
                                ? "This image has already been approved."
                                : "Embedding generation is already in progress for this image."
                    });
                }

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

                            const approvalTimestamp =
                                new Date();
                            const email =
                                file.metadata.email;
                            const rollNumberValue =
                                getRollNumberFromFile(
                                    file
                                );

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

                                    `${PYTHON_SERVICE_URL}/generate-embedding`,

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

                                await clearAcceptProcessingState(
                                    filesCollection,
                                    file._id
                                );

                                return res.status(400).json({

                                    success: false,

                                    message:
                                        response.data.message
                                });
                            }

                            // Extract embedding
                            const embedding =
                                response.data.embedding;

                            const existingEmbeddings =
                                await embeddingsCollection
                                    .find({
                                        email: email
                                    })
                                    .sort({
                                        createdAt: 1,
                                        _id: 1
                                    })
                                    .toArray();

                            const primaryEmbedding =
                                existingEmbeddings[0] ||
                                null;

                            if (
                                existingEmbeddings.length > 1
                            ) {

                                await embeddingsCollection
                                    .deleteMany({
                                        _id: {
                                            $in:
                                                existingEmbeddings
                                                    .slice(1)
                                                    .map(
                                                        (document) => document._id
                                                    )
                                        }
                                    });
                            }

                            const createdAt =
                                primaryEmbedding
                                    ?.createdAt ||
                                approvalTimestamp;

                            // Store embedding
                            await embeddingsCollection
                                .updateOne(

                                    primaryEmbedding
                                        ? {
                                            _id:
                                                primaryEmbedding._id
                                        }
                                        : {
                                            email: email
                                        },

                                    {
                                        $set: {

                                            email:
                                                email,

                                            rollNumber:
                                                rollNumberValue,

                                            contentType:
                                                file.contentType ||
                                                "image/jpeg",

                                            filename:
                                                file.filename ||
                                                "student.jpg",

                                            imageFileId:
                                                file._id,

                                            gridfsFileId:
                                                file._id,

                                            qualityScore:
                                                file.metadata
                                                    ?.qualityScore ??
                                                file.metadata
                                                    ?.qualityscore ??
                                                null,

                                            embedding:
                                                embedding,

                                            embeddingLength:
                                                Array.isArray(
                                                    embedding
                                                )
                                                    ? embedding.length
                                                    : 0,

                                            createdAt:
                                                createdAt,

                                            verifiedAt:
                                                approvalTimestamp,

                                            updatedAt:
                                                approvalTimestamp
                                        },
                                        $unset: {
                                            rollNo: ""
                                        }
                                    },

                                    {
                                        upsert:
                                            !primaryEmbedding
                                    }
                                );

                            // Mark verified
                            await filesCollection
                                .updateOne(

                                    {
                                        _id:
                                            file._id
                                    },

                                    {
                                        $set: {
                                            "metadata.verified":
                                                true,
                                            "metadata.verifiedAt":
                                                approvalTimestamp
                                        },
                                        $unset: {
                                            "metadata.processingAccept":
                                                "",
                                            "metadata.processingStartedAt":
                                                ""
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

                            await clearAcceptProcessingState(
                                filesCollection,
                                file._id
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

                    async (err) => {

                        console.error(

                            "GridFS Download Error:",

                            err
                        );

                        await clearAcceptProcessingState(
                            filesCollection,
                            file._id
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

                if (file.metadata?.processingAccept) {

                    return res.status(409).json({

                        success: false,

                        message:
                            "This image is already being approved. Please wait for embedding generation to finish."
                    });
                }

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
