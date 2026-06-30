require('dotenv').config();

const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const qualityRoutes = require('./routes/quality');
const authRoutes = require('./routes/auth');
const staffVerifyRoutes = require('./routes/verify_student');
const { initGridFS } = require('./models/gridfs');

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'frontend')));

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB connected successfully');
        initGridFS();
    })
    .catch((err) => console.error('MongoDB connection error:', err));

app.use('/api', authRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/staff', staffVerifyRoutes);

app.get('/', (req, res) => {
    res.redirect('/index.html');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
