var db = require("./db.json");
var userTransactions = require("./user_transactions.json");

module.exports = {
  ...db,
  transactions: userTransactions,
};
