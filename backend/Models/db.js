const mongoose = require('mongoose');

const url = process.env.MONGO_CONN || 'mongodb+srv://fyp_user:xkJqTzIZEPFQKmTp@cluster0.yyp52.mongodb.net/FYP_DB?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(url).then(() => {
    console.log('MongoDB Connected');
}).catch((err) => {
    console.log(err);
});

module.exports = { url };
