require("dotenv").config();
const express = require("express");
const userRout = require("./router/usersRouter/users");
const rqeRout = require("./router/requestsRouter/request");
const TechRout = require("./router/technicalRouter/technical");
const offerRout = require("./router/offerRouter/offer");
const homeRout = require("./router/homePageRouter/home");
const feedbackRout = require("./router/feedbackRouter/feedback");
const singupRout = require("./router/signup/signup");
const uploadImageRouter = require("./router/flaskApiRouter/uploadImageRouter");
const path = require("path");
const http = require("http");
const session = require("express-session");
const crypto = require("crypto");
const MongoStore = require("connect-mongo").default;
const app = express();
const morgan = require("morgan"); // Logging middleware

// Create an HTTP server
const server = http.createServer(app);

app.set("view engine", "ejs");
const { connectDB } = require("./db/dbconnect");
const io = require("./io");

// Constants
const port = process.env.PORT || 8000;

app.use(express.static(path.join(__dirname, "public")));
// app.use(express.json());
app.use(morgan("dev")); // Use morgan for logging

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set("trust proxy", 1);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", database: "connected" });
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${port} is already in use. Stop the running app or change the PORT in .env.`,
    );
    process.exit(1);
  }
  throw error;
});

const startServer = async () => {
  const database = await connectDB();
  const isProduction = process.env.NODE_ENV === "production";
  const sessionSecret =
    process.env.SESSION_SECRET ||
    (!isProduction ? crypto.randomBytes(32).toString("hex") : null);

  if (isProduction && !sessionSecret) {
    throw new Error("SESSION_SECRET must be configured in production.");
  }
  if (isProduction && !process.env.PYTHON_API_URL) {
    throw new Error(
      "PYTHON_API_URL must point to the deployed classifier in production.",
    );
  }

  app.use(
    session({
      secret: sessionSecret,
      store: MongoStore.create({
        client: database.getClient(),
        dbName: database.name,
        collectionName: "sessions",
        ttl: 24 * 60 * 60,
        touchAfter: 6 * 60 * 60,
      }),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction || process.env.RENDER === "true",
        maxAge: 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.use(userRout);
  app.use(rqeRout);
  app.use(TechRout);
  app.use(offerRout);
  app.use(feedbackRout);
  app.use(homeRout);
  app.use(singupRout);
  app.use("/api", uploadImageRouter);

  server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    io.init(server);
  });
};

startServer().catch((error) => {
  console.error("Application startup failed:", error.message);
  process.exit(1);
});

// Export the app and server for testing purposes (if needed)
module.exports = { app, server };
