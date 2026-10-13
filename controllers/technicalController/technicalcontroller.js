const techRepository = require("../../repository/technicalReoistory/technicalRepos");
const offerRepository = require("../../repository/offerRepository/offerRepos");
const requestRepository = require("../../repository/requestRepostiory/requesRepos");
const userRepository = require("../../repository/userRepository/userRepos");
const techReqRepository = require("../../repository/techRequestRepo/techRequestRepos");
const socketManager = require("../../socketManager"); // Adjust the path to your socketManager module

const { getParameter } = require("../usersController/usersControllers");
const { NotFoundError, BadRequsetError } = require("../../errors/err");

const isValidTechnicalId = (id) =>
  typeof id === "string" && /^[a-f\d]{24}$/i.test(id);

const getOffersPage = async (req, res) => {
  try {
    const technicalID = getParameter(req, "technicalId");
    if (!isValidTechnicalId(technicalID)) return res.redirect("/login");
    const { requestTech, helpseekers, requestUser, offers } =
      await techReqRepository.getData(technicalID);
    res.render("techOffersPage", {
      requestTech,
      helpseekers,
      requestUser,
      offers,
      technicalID,
    });
  } catch (err) {
    res.status(err?.status || 500).json({ message: err.message });
  }
};

// add new offer
const addOffer = async (req, res) => {
  try {
    const technicalID = getParameter(req, "technicalId");
    if (!isValidTechnicalId(technicalID)) return res.redirect("/login");
    const { requestID, bid, comments } = req.body;
    const request = await requestRepository.getReqById(requestID);
    const assignments = await techReqRepository.getReqById(technicalID);
    const isAssigned = assignments.some(
      (assignment) => assignment.requestID.toString() === requestID,
    );
    if (!request || request.status !== "pending" || !isAssigned) {
      return res.status(404).send("Request is no longer available.");
    }
    const existingOffers = await offerRepository.getofferByReqId(requestID);
    if (
      existingOffers.some(
        (offer) => offer.technicalID.toString() === technicalID,
      )
    ) {
      return res
        .status(409)
        .send("You have already submitted an offer for this request.");
    }

    const new_Offer = await offerRepository.addOffer(
      requestID,
      technicalID,
      bid,
      comments,
    );

    const userId =
      await requestRepository.getHelpSeekerIdByRequestId(requestID);
    // Store the new offer in Redis
    const helpSeekerSocketId = socketManager.getUserSocket(userId);
    const io = require("../../io").getIO();

    if (!new_Offer)
      throw new BadRequsetError(`Technical implement is not true`);
    if (helpSeekerSocketId)
      io.to(helpSeekerSocketId).emit("newOffer", new_Offer);
    return res.redirect("/tech/offers");
  } catch (err) {
    res.status(err?.status || 500).json({ message: err.message });
  }
};

// update offer
const update_offer = async (req, res) => {
  try {
    const technicalID = getParameter(req, "technicalId");
    if (!isValidTechnicalId(technicalID)) return res.redirect("/login");
    const { offerID, bid, comments } = req.body;
    const offer = await offerRepository.getOfferById(offerID);
    if (!offer || offer.technicalID.toString() !== technicalID) {
      return res.status(404).send("Offer not found.");
    }
    const new_Offer = await offerRepository.udpateTecOffer(offerID, {
      bid,
      comments,
    });
    if (!new_Offer)
      throw new BadRequsetError(`Technical implement is not true`);
    return res.redirect("/tech/offers");
  } catch (err) {
    res.status(err?.status || 500).json({ message: err.message });
  }
};

const ignoreOffer = async (req, res) => {
  try {
    const technicalID = getParameter(req, "technicalId");
    if (!isValidTechnicalId(technicalID)) return res.redirect("/login");
    const { ignoreID } = req.body;
    const ignore = await techReqRepository.deletebyReqIdTechId(
      ignoreID,
      technicalID,
    );
    if (!ignore || ignore.length === 0)
      throw new NotFoundError("request not fonud");

    res.status(200).redirect("/techhome/request");
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

const deleteOffer = async (req, res) => {
  try {
    const technicalID = getParameter(req, "technicalId");
    if (!isValidTechnicalId(technicalID)) return res.redirect("/login");
    const { offerID } = req.body;
    const offer = await offerRepository.getOfferById(offerID);
    if (!offer || offer.technicalID.toString() !== technicalID) {
      return res.status(404).send("Offer not found.");
    }
    const deletedReq = await offerRepository.deleteOffer(offerID);
    if (!deletedReq) throw new BadRequsetError(`error delete offer`);
    return res.redirect("/tech/offers");
  } catch (error) {
    throw error;
  }
};

//
const getrequestspage = async (req, res) => {
  try {
    const technicalID = getParameter(req, "technicalId");
    if (!isValidTechnicalId(technicalID)) return res.redirect("/login");
    const techRequests = await techReqRepository.getReqById(technicalID);
    const existingOffers = await offerRepository.getOffersByTechID(technicalID);
    const offeredRequestIds = new Set(
      existingOffers.map((offer) => offer.requestID.toString()),
    );

    let requests = [];
    for (const request of techRequests) {
      const requestID = request.requestID;
      const result = await requestRepository.getReqById(requestID);
      if (
        result &&
        result.status === "pending" &&
        !offeredRequestIds.has(result._id.toString())
      ) {
        requests.push(result);
      }
    }
    let helpseekers = (
      await Promise.all(
        requests.map((request) =>
          userRepository.getUserByID(request.helpseekerId),
        ),
      )
    ).filter(Boolean);

    const query = req.query.query?.trim().toLowerCase();
    if (query) {
      const matchingUserIds = new Set(
        helpseekers
          .filter((user) => user.fullName.toLowerCase().includes(query))
          .map((user) => user._id.toString()),
      );
      requests = requests.filter((request) =>
        matchingUserIds.has(request.helpseekerId.toString()),
      );
      helpseekers = helpseekers.filter((user) =>
        matchingUserIds.has(user._id.toString()),
      );
    }

    return res.render("technicalRequests", {
      requests,
      helpseekers,
      technicalID,
    });
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

// get profile
const gettechincalprofile = async (req, res) => {
  try {
    if (!isValidTechnicalId(getParameter(req, "technicalId"))) {
      return res.redirect("/login");
    }
    res.render("techincalprofile");
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

// get signup page
const getSignup = async (req, res) => {
  try {
    res.render("techSingup");
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

const getTechPage = async (req, res) => {
  try {
    const technicalID = getParameter(req, "technicalId"); // Make sure to retrieve the correct technical ID
    if (!isValidTechnicalId(technicalID)) return res.redirect("/login");

    const assignedRequests = await techReqRepository.getReqById(technicalID);
    const requestRecords = await Promise.all(
      assignedRequests.map((assignment) =>
        requestRepository.getReqById(assignment.requestID),
      ),
    );
    const activeRequestsCount = requestRecords.filter(
      (request) => request && request.status === "pending",
    ).length;

    // Calculate revenue from the last month
    const revenueLastMonth =
      await offerRepository.calculateRevenueLastMonth(technicalID);

    // Calculate the number of approved offers for the current week
    const approvedOffersCurrentWeek =
      await offerRepository.calculateApprovedOffersCurrentWeek(technicalID);

    // Retrieve the last five offers
    let lastFiveOffers = await offerRepository.getAnyFiveOffers(technicalID);

    // Fetch details for each request associated with the offers, including the help seeker's name
    lastFiveOffers = await Promise.all(
      lastFiveOffers.map(async (offer) => {
        const requestDetails = await requestRepository.getRequestDetailsById(
          offer.requestID,
        ); // Fetch additional request details
        const helpSeekerId = await requestRepository.getHelpSeekerIdByRequestId(
          offer.requestID,
        );
        // Assuming requestDetails includes a helpseekerId field
        let helpSeekerName = "Name not found"; // Default value if the help seeker's name can't be found
        helpSeekerName =
          (await userRepository.getUserFullName(helpSeekerId)) ||
          "Name not found";

        // }

        return {
          ...offer,
          requestDetails: requestDetails || "Details not found",
          helpSeekerName,
        };
      }),
    );
    // Render the template with the necessary data
    res.render("technical_index", {
      revenueLastMonth,
      approvedOffersCurrentWeek,
      activeRequestsCount,
      lastFiveOffers,
      technicalID,
    });
  } catch (err) {
    console.error("Error in getTechPage:", err);
    res.status(err?.status || 500).json({ message: err.message });
  }
};

const getOffers = async (technicalID) => {
  try {
    const offers = await offerRepository.getOffersByTechID(technicalID);
    console.log(offers);
    // const request = await requestRepository.getReqById(offer);

    // const requestIDs = offers.map(offer => offer.requestID.toString());
    return offers;
  } catch (err) {
    throw err;
  }
};

// add new Technical to db
const techincal_post = async (req, res) => {
  try {
    const allowedCategories = ["pip", "power socket", "door handlers"];
    const submittedCategories = Array.isArray(req.body.category)
      ? req.body.category
      : [req.body.category];
    const categories = [
      ...new Set(
        submittedCategories
          .filter((category) => typeof category === "string")
          .map((category) => category.trim())
          .filter((category) => allowedCategories.includes(category)),
      ),
    ];
    if (categories.length === 0) {
      return res.status(400).send("Select at least one service category.");
    }

    const new_Tech = await techRepository.addTechincal({
      ...req.body,
      category: categories,
    });
    if (!new_Tech) throw new BadRequsetError(`Technical implement is not true`);

    const matchingRequests = await requestRepository.gettAllReq({
      status: "pending",
      category: { $in: categories },
    });
    if (!matchingRequests)
      throw new BadRequsetError("Could not load open requests");

    const assignments = await Promise.all(
      matchingRequests.map((request) =>
        techReqRepository.addRequest({
          requestID: request._id,
          technicalID: new_Tech._id,
        }),
      ),
    );
    if (assignments.some((assignment) => !assignment)) {
      throw new BadRequsetError("Could not assign matching requests");
    }

    return res.redirect("/login?role=technical");
  } catch (err) {
    res.status(err?.status || 500).json({ message: err.message });
  }
};

// get all Technical in db
const getTechincalByID = async (req, res) => {
  try {
    const { id } = req.params;
    const tech = await techRepository.getTechincalById(id);
    if (!tech || tech.length === 0) throw new NotFoundError("Technical");
    return res.status(200).send(tech);
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

// update Technical
const techincal_update = async (req, res) => {
  const { id } = req.params;
  try {
    const updatedTec = await techRepository.udpateTechincal(id, req.body);
    if (!updatedTec || updatedTec.length === 0)
      throw new NotFoundError("Technical");
    return res.status(200).send(updatedTec);
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

// delete Technical
const techincal_delete = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedTech = await techRepository.deleteTechincal(id);
    if (!deletedTech || deletedTech.length === 0)
      throw new NotFoundError("Technical");
    return res.status(200).send(deletedTech);
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

// get all Technical in db
const getAllTechincal = async (req, res) => {
  try {
    const Tech = await techRepository.getAllTechincal();
    if (!Tech || Tech.length === 0) throw new NotFoundError("Technical");
    return res.status(200).send(Tech);
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

module.exports = {
  techincal_post,
  getTechincalByID,
  techincal_update,
  techincal_delete,
  getAllTechincal,
  getTechPage,
  getOffers,
  deleteOffer,
  getSignup,
  getrequestspage,
  gettechincalprofile,
  addOffer,
  getOffersPage,
  update_offer,
  ignoreOffer,
};
