var db = require("./db.json");
var user1Transactions = require("./transactions_user1.json");
var user2Transactions = require("./transactions_user2.json");

module.exports = {
  ...db,
  transactions: [...user1Transactions, ...user2Transactions],
};
