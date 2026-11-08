const mongoose = require('mongoose');
const { mongoUri } = require('./config');

async function connectDb() {
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
  console.log('MongoDB connected');
}

module.exports = { connectDb };
