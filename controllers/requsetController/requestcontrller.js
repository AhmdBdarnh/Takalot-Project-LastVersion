const reqRepository = require("../../repository/requestRepostiory/requesRepos");
const techReqRepo = require("../../repository/techRequestRepo/techRequestRepos");
const offerRep = require("../../repository/offerRepository/offerRepos");
const Techincal = require("../../module/technicalDataSchema/techincal");
const TechnicianSocketMapping = require("../../module/technicalCategoryMapping");
const { NotFoundError, BadRequsetError } = require("../../errors/err");
const { getParameter } = require("../usersController/usersControllers");
require("dotenv").config();
const sgMail = require("@sendgrid/mail");
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn(
    "SENDGRID_API_KEY is not set. Email notifications are disabled.",
  );
}
const twilio = require("twilio");
const FormData = require("form-data");
const fs = require("fs");
const socketIO = require("../../io");

// Function to send SMS
async function sendSMS(to, body) {
  const client = new twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN,
  );

  try {
    const message = await client.messages.create({
      body: body,
      to: to, // Text this number
      from: process.env.TWILIO_PHONE_NUMBER, // From a valid Twilio number
    });
    console.log(`SMS sent! ID: ${message.sid}`);
  } catch (error) {
    console.error(`Failed to send SMS:`, error);
  }
}

async function notifyRelevantTechnicals(matchingTechnicals, newRequest) {
  for (const technical of matchingTechnicals) {
    const msg = {
      to: technical.email, // recipient email from the technical document
      from: "aminw999mn@gmail.com", // Verified sender email in SendGrid
      subject: `New Request Available in ${newRequest.category}`, // Subject line
      text: `Hello ${technical.fullName},\n\nA new request in your category "${newRequest.category}" has been opened. Details: ${newRequest.details}`, // Plain text body
      html: `<p>Hello <b>${technical.fullName}</b>,</p><p>A new request in your category "<b>${newRequest.category}</b>" has been opened. Details: ${newRequest.details}</p>`, // HTML body content
    };

    try {
      await sgMail.send(msg);
      console.log(`Email sent to ${technical.fullName}`);
    } catch (error) {
      console.error(
        `Failed to send notification to ${technical.fullName}:`,
        error,
      );
    }

    socketIO.sendNotificationToUser(technical._id.toString(), "newRequest", {
      title: `New Request in ${newRequest.category}`,
      message: `A new request in your category "${newRequest.category}" has been opened. Details: ${newRequest.details}`,
      requestId: newRequest._id,
      category: newRequest.category,
      details: newRequest.details,
    });
  }
}

// Controller method for uploading image
const request_post = async (req, res) => {
  try {
    const { req_id, category, details, image } = req.body;
    const safeCategory = category && category.trim();
    const normalizedDetails = typeof details === "string" ? details.trim() : "";
    const helpseekerId = getParameter(req, "helpseekerID");
    if (!/^[a-f\d]{24}$/i.test(helpseekerId || "")) {
      return res.redirect("/login");
    }

    if (req_id) {
      const existingRequest = await reqRepository.getReqById(req_id);
      if (!existingRequest || existingRequest.helpseekerId !== helpseekerId) {
        return res.status(404).send("Request not found.");
      }
      const updateData = {
        category: safeCategory,
        details: normalizedDetails,
      };
      if (req.file) {
        updateData.image = {
          filename: req.file.originalname,
          contentType: req.file.mimetype,
          image: req.file.buffer,
        };
      }
      await reqRepository.updateReqq(req_id, updateData);
      return res.redirect("/home/helpseeker/requests");
    }

    if (!safeCategory) {
      console.log("No category provided for request.");
      return res
        .status(400)
        .send("Please select a category before creating the request.");
    }

    if (!normalizedDetails) {
      return res
        .status(400)
        .send("Please describe the issue before creating the request.");
    }
    const requestPayload = {
      helpseekerId,
      category: safeCategory,
      details: normalizedDetails,
    };

    if (req.file) {
      requestPayload.image = {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
        image: req.file.buffer,
      };
    }

    const matchingTechnicals = await Techincal.find({
      category: safeCategory,
    });

    if (!matchingTechnicals || matchingTechnicals.length === 0) {
      console.log("No matching technicals found for category:", safeCategory);
    }

    const newReq = await reqRepository.addReq(requestPayload);

    const io = require("../../io").getIO();
    io.emit("new-request", {
      category: newReq.category,
      details: newReq.details,
    });

    if (matchingTechnicals && matchingTechnicals.length > 0) {
      await notifyRelevantTechnicals(matchingTechnicals, newReq);
      const requestID = newReq._id;

      for (const technical of matchingTechnicals) {
        const technicalID = technical._id;
        const chReq = await techReqRepo.addRequest({
          requestID,
          technicalID,
        });

        if (!chReq) {
          throw new BadRequsetError(`something is not true in add request`);
        }
      }
    }

    return res.redirect("/home/helpseeker/requests");
  } catch (err) {
    console.error(err);
    return res.status(500).send("Error uploading image");
  }
};

const renderUploadForm = async (req, res) => {
  try {
    // Assuming 'name' is the field by which you want to retrieve the image
    const imageName = req.params.name; // Assuming the name is passed as a parameter

    // Retrieve the latest uploaded image from MongoDB based on the name
    const latestImage = await req
      .findOne({ filename: imageName })
      .sort({ _id: -1 });

    // Render the upload form along with the latest image data
    res.render("upload", { latestImage: latestImage });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error retrieving image");
  }
};

// add new request to db
const getReqPage = async (req, res) => {
  try {
    const userId = getParameter(req, "helpseekerID");
    if (!/^[a-f\d]{24}$/i.test(userId || "")) return res.redirect("/login");
    res.render("Helpseeker-requestform", {
      userId,
      selectedCategory: req.query.category || "",
    });
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

// get all request in db
const getReqByID = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await reqRepository.getReqById(id);
    if (!request || request.length === 0) throw new NotFoundError("Request");
    return res.status(200).send(request);
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

// update request
const req_update = async (req, res) => {
  try {
    const userId = getParameter(req, "helpseekerID");
    const requestID = req.body.requestID;
    if (!/^[a-f\d]{24}$/i.test(userId || "")) return res.redirect("/login");
    const requestData = await reqRepository.getReqById(requestID);
    if (!requestData || requestData.helpseekerId !== userId) {
      return res.status(404).send("Request not found.");
    }
    res.render("Helpseeker-requestform", { requestID, userId, requestData });
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

// delete request
const req_delete = async (req, res) => {
  try {
    const requestId = req.body.requestID;
    const helpseekerId = getParameter(req, "helpseekerID");
    if (!/^[a-f\d]{24}$/i.test(helpseekerId || ""))
      return res.redirect("/login");
    const request = await reqRepository.getReqById(requestId);
    if (!request || request.helpseekerId !== helpseekerId) {
      return res.status(404).send("Request not found.");
    }

    const deletedReq = await reqRepository.deleteReq(requestId);
    if (!deletedReq) throw new NotFoundError("Request");

    await techReqRepo.deleteRequestsByRequestId(requestId);
    await offerRep.deleteOfferbyReqId(requestId);

    return res.redirect("/home/helpseeker/requests");
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

// get all request in db
const getAllReq = async (req, res) => {
  try {
    const req = await reqRepository.gettAllReq();
    if (!req || req.length === 0) throw new NotFoundError("Request");
    return res.status(200).send(req);
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

module.exports = {
  request_post,
  getReqByID,
  req_update,
  req_delete,
  getAllReq,
  getReqPage,

  // uploadImage,
  renderUploadForm,
};
