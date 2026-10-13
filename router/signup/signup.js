const express = require("express");
const router = express.Router();

//signup
router.get("/signup", async (req, res) => {
  res.redirect("/signup/helpseeker");
});

module.exports = router;
