const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

// Initialize express router
const router = express.Router();

// Configure multer for file uploads
const upload = multer({ dest: "uploads/" }); // Files will be temporarily saved to 'uploads/' directory

// Define the POST route for image upload
router.post("/upload-image", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No image uploaded.");
  }

  try {
    // Prepare the file to be forwarded to the Flask app
    const formData = new FormData();
    formData.append("image", fs.createReadStream(req.file.path));

    const predictionUrl =
      process.env.PYTHON_API_URL || "http://localhost:5000/predict";

    // Send the file to the Flask app
    const response = await axios.post(predictionUrl, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    // Send the response back to the client
    res.json(response.data);
  } catch (error) {
    console.error("Error forwarding image to Flask app:", error);
    res.status(500).send("Error processing image.");
  } finally {
    if (req.file?.path) {
      fs.unlink(req.file.path, (cleanupError) => {
        if (cleanupError && cleanupError.code !== "ENOENT") {
          console.error("Error removing temporary upload:", cleanupError);
        }
      });
    }
  }
});

module.exports = router;
