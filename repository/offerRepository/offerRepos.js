const Offer = require("../../module/offersSchema/offer");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");

const getOfferById = async (id) => {
  try {
    const offer = await Offer.findById(id);
    return offer;
  } catch {
    return false;
  }
};

const addOffer = async (requestID, technicalID, bid, comments) => {
  try {
    const newOffer = new Offer({ requestID, technicalID, bid, comments });
    await newOffer.save();
    return newOffer;
  } catch {
    return false;
  }
};

const udpateOffer = async (offerID, updateData) => {
  try {
    return await Offer.findByIdAndUpdate(offerID, updateData, { new: true });
  } catch (error) {
    console.error("Error updating offer:", error);
    throw error;
  }
};

const deleteOffer = async (_id) => {
  try {
    const offer = await Offer.findByIdAndDelete(_id);
    if (!offer) {
      console.log(`Offer with ID ${_id} not found.`);
      return null;
    }
    console.log(`Offer with ID ${_id} deleted successfully.`);
    return offer;
  } catch (error) {
    console.error("Error deleting offer:", error);
    return false;
  }
};

const gettAllOffer = async (technicalID) => {
  try {
    const offers = await Offer.find({ technicalID });
    return offers;
  } catch {
    return false;
  }
};

const getOffersByTechID = async (technicalID) => {
  try {
    const offers = await Offer.find({ technicalID });
    return offers;
  } catch (err) {
    throw err;
  }
};

const calculateRevenueLastMonth = async (technicalID) => {
  try {
    const totalRevenueLastMonth = await Offer.aggregate([
      {
        $match: {
          technicalID: new ObjectId(technicalID),
          status: "approved",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$bid" },
        },
      },
    ]);

    return totalRevenueLastMonth[0] ? totalRevenueLastMonth[0].totalRevenue : 0;
  } catch (err) {
    console.error("Error calculating revenue last month:", err);
    throw err;
  }
};

const calculateApprovedOffersCurrentWeek = async (technicalID) => {
  try {
    const approvedOffersThisWeek = await Offer.aggregate([
      {
        $match: {
          technicalID: new ObjectId(technicalID),
          status: "approved",
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
        },
      },
    ]);

    // Return the count of approved requests, or 0 if none were found
    return approvedOffersThisWeek[0] ? approvedOffersThisWeek[0].count : 0;
  } catch (err) {
    throw err;
  }
};

const getAnyFiveOffers = async (technicalID) => {
  try {
    const anyFiveOffers = await Offer.aggregate([
      { $match: { technicalID: new ObjectId(technicalID) } }, // Match offers by technicalID
      { $limit: 5 }, // Limit to the first 5 offers found
    ]);

    // Since we're directly fetching documents, there's no need for a $group stage like in the count example
    // Check if offers are found and return them, or return an empty array if none were found
    return anyFiveOffers.length > 0 ? anyFiveOffers : [];
  } catch (err) {
    console.error("Failed to retrieve offers:", err);
    throw err;
  }
};

/**
 * Gets the requestID for a given offerId.
 * @param {String} offerId The ID of the offer document.
 * @returns {Promise<mongoose.Schema.Types.ObjectId>} A promise that resolves to the requestID if found, or null if not found.
 */
async function getRequestIdByOfferId(offerId) {
  if (!mongoose.Types.ObjectId.isValid(offerId)) {
    throw new Error("Invalid offerId");
  }

  try {
    const offer = await Offer.findById(offerId).exec();
    if (!offer) {
      console.log("Offer not found");
      return null;
    }
    return offer.requestID;
  } catch (error) {
    console.error("Error fetching Offer:", error);
    throw error; // or handle it as you see fit
  }
}

const deleteOfferbyReqId = async (requestID) => {
  try {
    return await Offer.deleteMany({ requestID });
  } catch {
    return false;
  }
};

const rejectOtherOffers = async (requestID, acceptedOfferID) => {
  try {
    return await Offer.updateMany(
      { requestID, _id: { $ne: acceptedOfferID } },
      { $set: { status: "rejected" } },
    );
  } catch (error) {
    console.error("Error rejecting other offers:", error);
    throw error;
  }
};

const getofferByReqId = async (requestID) => {
  try {
    const offers = await Offer.find({ requestID });
    return offers;
  } catch {
    return false;
  }
};

const udpateTecOffer = async (requestID, updateData) => {
  try {
    console.log(requestID, updateData);

    const offer = await Offer.findOneAndUpdate(
      { _id: requestID },
      { $set: { bid: updateData.bid, comments: updateData.comments } },
      { new: true },
    );
    return offer;
  } catch (error) {
    console.error("Error updating offer:", error);
    throw error;
  }
};

module.exports = {
  getOfferById,
  addOffer,
  udpateOffer,
  deleteOffer,
  gettAllOffer,
  getOffersByTechID,
  calculateRevenueLastMonth,
  calculateApprovedOffersCurrentWeek,
  getAnyFiveOffers,
  getRequestIdByOfferId,
  deleteOfferbyReqId,
  getofferByReqId,
  rejectOtherOffers,
  udpateTecOffer,
};
