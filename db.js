const db = require("./db.json");
const userTransactions = require("./user_transactions.json");
const notifications = require("./notifications.json");
const requestedTransactions = require("./requested_transactions.json");

module.exports = {
  ...db,
  transactions: userTransactions,
  requests: requestedTransactions,
  notifications: notifications,
};
