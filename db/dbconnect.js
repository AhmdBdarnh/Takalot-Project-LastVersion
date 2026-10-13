//./db/dbconnect
require("dotenv").config();
const mongoose = require("mongoose");

const connectDB = async () => {
  const dbUri =
    process.env.MONGO_URI ||
    process.env.DB_URI ||
    (process.env.DB_USERNAME &&
    process.env.DB_PASSWORD &&
    process.env.DB_CLUSTER &&
    process.env.DB_NAME
      ? `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_CLUSTER}/${process.env.DB_NAME}?retryWrites=true&w=majority`
      : null);

  if (!dbUri) {
    throw new Error("Configure MONGO_URI or DB_URI before starting the app.");
  }

  try {
    await mongoose.connect(dbUri, {
      serverSelectionTimeoutMS: 15000,
      retryWrites: true,
      maxPoolSize: 10,
    });
    console.log("Connected to MongoDB");
    return mongoose.connection;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

module.exports = { connectDB };
