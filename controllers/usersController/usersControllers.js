const userRepository = require("../../repository/userRepository/userRepos");
const techRepository = require("../../repository/technicalReoistory/technicalRepos");
const reqRepository = require("../../repository/requestRepostiory/requesRepos");
const offersRep = require("../../repository/offerRepository/offerRepos");
const { NotFoundError, BadRequsetError } = require("../../errors/err");

const isValidUserId = (id) =>
  typeof id === "string" && /^[a-f\d]{24}$/i.test(id);

function saveParameter(req, key, value) {
  req.session[key] = value;
}

function getParameter(req, key) {
  return req.session?.[key] || null;
}

const getOffers = async (req, res) => {
  try {
    const helpseekerId = getParameter(req, "helpseekerID");
    if (!isValidUserId(helpseekerId)) return res.redirect("/login");

    const requests = await reqRepository.getRequestByUserID(helpseekerId);
    if (!requests) throw new NotFoundError("Requests");

    const allOffers = await Promise.all(
      requests.map((request) => offersRep.getofferByReqId(request._id)),
    );
    const technicalIDs = allOffers.flatMap((offers) =>
      Array.isArray(offers) ? offers.map((offer) => offer.technicalID) : [],
    );
    const technicalDetails = await Promise.all(
      technicalIDs.map((technicalID) =>
        techRepository.getTechincalById(technicalID),
      ),
    );

    return res.render("helpsekeerOffers", {
      allOffers,
      requests,
      technicalDetails,
      userId: helpseekerId,
    });
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

const user_post = async (req, res) => {
  try {
    const newUser = await userRepository.addUser(req.body);
    if (!newUser) throw new BadRequsetError("User registration failed");
    return res.redirect("/login");
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

const getUserByID = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidUserId(id)) throw new BadRequsetError("Invalid user ID");
    const user = await userRepository.getUserByID(id);
    if (!user) throw new NotFoundError("User");
    return res.status(200).send(user);
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

const getSignup = async (req, res) => {
  try {
    return res.render("userSignup");
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

const getLogin = async (req, res) => {
  try {
    const role = req.query.role === "technical" ? "technical" : "helpseeker";
    return res.render("pages-login", { role });
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

const logout = async (req, res) => {
  try {
    const role = req.query.role;
    if (role === "technical") {
      delete req.session.technicalId;
    } else if (role === "helpseeker") {
      delete req.session.helpseekerID;
    } else {
      return res.status(400).send("Choose which account to sign out.");
    }

    if (isValidUserId(req.session.helpseekerID)) {
      return res.redirect("/home/helpseeker");
    }
    if (isValidUserId(req.session.technicalId)) {
      return res.redirect("/home/technical");
    }

    await new Promise((resolve, reject) => {
      req.session.destroy((error) => (error ? reject(error) : resolve()));
    });
    res.clearCookie("connect.sid");
    return res.redirect("/login");
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const helpseekerId = getParameter(req, "helpseekerID");
    if (!isValidUserId(helpseekerId)) return res.redirect("/login");
    const user = await userRepository.getUserByID(helpseekerId);
    if (!user) return res.redirect("/login");
    return res.render("HelpSeeker-profile", { user });
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

const post_Login = async (req, res) => {
  try {
    const { userName, password } = req.body;
    if (req.body.role === "technical") {
      const technical = await techRepository.checkUser(userName, password);
      if (technical && technical.isMatch) {
        saveParameter(req, "technicalId", technical.technicalId.toString());
        return res.redirect("/home/technical");
      }
    } else {
      const user = await userRepository.checkUser(userName, password);
      if (user && user.isMatch) {
        saveParameter(req, "helpseekerID", user.userId.toString());
        return res.redirect("/home/helpseeker");
      }
    }

    return res.redirect("/login");
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

const getUserPage = async (req, res) => {
  try {
    const userId = getParameter(req, "helpseekerID");
    if (!isValidUserId(userId)) return res.redirect("/login");
    return res.render("helpSeeker-index", { userId });
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

const getRequests = async (req, res) => {
  try {
    const helpseekerId = getParameter(req, "helpseekerID");
    if (!isValidUserId(helpseekerId)) return res.redirect("/login");

    const userData = await userRepository.getName_Number(helpseekerId);
    if (!userData) return res.redirect("/login");

    const requests = await reqRepository.getRequestByUserID(helpseekerId);
    if (!requests) throw new NotFoundError("Requests");
    return res.render("HelpSeekeRequest", { userData, requests });
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

const user_update = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidUserId(id)) throw new BadRequsetError("Invalid user ID");
    const user = await userRepository.udpateUser(id, req.body);
    if (!user) throw new NotFoundError("User");
    return res.status(200).send(user);
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

const user_delete = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidUserId(id)) throw new BadRequsetError("Invalid user ID");
    const user = await userRepository.deleteUser(id);
    if (!user) throw new NotFoundError("User");
    return res.status(200).send(user);
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

const getName_Number = async (_id) => userRepository.getName_Number(_id);

const acceptOffer = async (req, res) => {
  try {
    const { requestID, offerID, bool } = req.body;
    const helpseekerId = getParameter(req, "helpseekerID");
    if (!isValidUserId(helpseekerId)) return res.redirect("/login");

    const request = await reqRepository.getReqById(requestID);
    const offer = await offersRep.getOfferById(offerID);
    if (!request || request.helpseekerId !== helpseekerId) {
      return res.status(403).send("You cannot manage this request.");
    }
    if (!offer || offer.requestID.toString() !== requestID) {
      return res.status(404).send("Offer not found.");
    }

    if (bool === "0") {
      const updatedRequest = await reqRepository.udpateReq(
        requestID,
        "approved",
      );
      const acceptedOffer = await offersRep.udpateOffer(offerID, {
        status: "approved",
      });
      if (!updatedRequest || !acceptedOffer) {
        throw new BadRequsetError("Offer acceptance failed");
      }
      await offersRep.rejectOtherOffers(requestID, offerID);
    } else {
      const rejectedOffer = await offersRep.udpateOffer(offerID, {
        status: "rejected",
      });
      if (!rejectedOffer) throw new BadRequsetError("Offer rejection failed");
    }

    return res.redirect("/home/offers");
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err.message });
  }
};

module.exports = {
  user_post,
  getUserByID,
  getSignup,
  user_update,
  user_delete,
  getLogin,
  logout,
  post_Login,
  getName_Number,
  getUserPage,
  saveParameter,
  getParameter,
  getRequests,
  getProfile,
  getOffers,
  acceptOffer,
};
