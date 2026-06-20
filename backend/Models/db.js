const mongoose = require('mongoose');

// To use MongoDB Atlas instead, set MONGO_CONN in .env and swap this for process.env.MONGO_CONN
const url = 'mongodb://127.0.0.1:27017/MERN_Project_01';

// Connect to MongoDB
mongoose.connect(url).then(() => {
    console.log('MongoDB Connected');
}).catch((err) => {
    console.log(err);
});



