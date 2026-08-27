const mongoose = require('mongoose');

const url = process.env.MONGO_CONN;
if (!url) {
  throw new Error(
    'MONGO_CONN environment variable is required (set it in backend/.env, or in the ' +
    "cPanel Node.js app's Environment Variables for production)."
  );
}

mongoose.connect(url).then(() => {
    console.log('MongoDB Connected');
}).catch((err) => {
    console.log(err);
});

module.exports = { url };
