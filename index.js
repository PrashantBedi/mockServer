const jsonServer = require("json-server");
const server = jsonServer.create();
const router = jsonServer.router(require("./db.js"));
const middlewares = jsonServer.defaults();
let db = require("./db.js");
const { users } = require("./db.js");
const axios = require("axios");

server.use(middlewares);

server.use(jsonServer.bodyParser);

function writeToDB() {
  router.db.setState(db);
  router.db.write();
}

function paginate(array, page_size, page_number) {
  return array.slice((page_number - 1) * page_size, page_number * page_size);
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
}

const isAuthorized = (req) => {
  if (req.headers.authorization) {
    const token = req.headers.authorization.split("Bearer ").pop();
    const index = db.users.findIndex((user) => user.token === token);
    if (index === -1) {
      return false;
    }
    const user = { ...db.users[index] };
    delete user.password;
    delete user.token;
    return user;
  }
};

server.use("/api", (req, res, next) => {
  const user = isAuthorized(req);
  if (user) {
    req.user = user;
    // add your authorization logic here
    next(); // continue to JSON Server router
  } else {
    res.sendStatus(401);
  }
});

server.post("/sendOtp", (req, res) => {
  let index = db.users.findIndex((user) => user.phone_no == req.body.phone_no);

  if (index != -1) {
    return res.sendStatus(403);
  }

  let otp = req.body.phone_no.slice(-5);
  db.otps.push({ phone_no: req.body.phone_no, otp: otp });
  writeToDB();
  res.status(200).jsonp({ message: "OTP Sent Successfully" });
});

server.post("/signup", (req, res) => {
  let index = db.users.findIndex((user) => user.phone_no == req.body.phone_no);

  if (index != -1) {
    return res.sendStatus(403);
  }
  let userId = db.users.length + 1,
    username = req.body.name;

  let user = {
    id: userId,
    phone_no: req.body.phone_no,
    password: req.body.password,
    dob: req.body.dob,
    name: username,
    upi: req.body.phone_no + "@okaxis",
    fcm_token: req.body.fcm_token,
  };

  db.users.push(user);
  let accountLastId = db.accounts.length;
  db.accounts.push(
    {
      id: accountLastId + 1,
      user_id: userId,
      bank_name: "SBI",
      holder_name: username,
      account_type: "Savings",
      account_number: `6098587965${accountLastId}`,
      balance: getRandomInt(1, 100000),
    },
    {
      id: accountLastId + 2,
      user_id: userId,
      bank_name: "HDFC",
      holder_name: username,
      account_type: "Savings",
      account_number: `6098587965${accountLastId + 1}`,
      balance: getRandomInt(1, 100000),
    }
  );

  writeToDB();

  res.status(200).send("Signup Successful");
});

server.get("/api/search", (req, res) => {
  let searchText = req.query.text?.toLowerCase() || "";
  let mobileOnly = req.query.mobileOnly === "true";
  let filteredList = [];
  db.users.forEach((user) => {
    if (!mobileOnly && user.upi.toLowerCase().includes(searchText)) {
      filteredList.push({
        id: user.id,
        name: user.name,
        phone_no: user.phone_no,
        upi: user.upi,
        fieldName: "upi",
      });
    } else if (user.phone_no.toLowerCase().includes(searchText)) {
      filteredList.push({
        id: user.id,
        name: user.name,
        phone_no: user.phone_no,
        upi: user.upi,
        fieldName: "phone_no",
      });
    } else if (!mobileOnly && user.name.toLowerCase().includes(searchText)) {
      filteredList.push({
        id: user.id,
        name: user.name,
        phone_no: user.phone_no,
        upi: user.upi,
        fieldName: "upi",
      });
    }
  });

  return res.status(200).send(filteredList);
});

server.get("/api/getTransactions", (req, res) => {
  const { upi } = req.query;

  let user_id = req.user.id;
  const recipient = db.users.find((user) => user.upi === upi);

  let filteredList = [];

  db.transactions.forEach((transaction) => {
    if (transaction.transaction_type === "send") {
      if (
        (transaction.user_id === user_id &&
          transaction.payee_id === recipient.id) ||
        (transaction.user_id === recipient.id &&
          transaction.payee_id === user_id)
      )
        filteredList.push(transaction);
    } else if (transaction.transaction_type === "request") {
      if (
        (transaction.user_id === user_id &&
          transaction.payer_id === recipient.id) ||
        (transaction.user_id === recipient.id &&
          transaction.payer_id === user_id)
      )
        filteredList.push(transaction);
    }
  });

  return res.status(200).send(filteredList);
});

server.get("/api/getPaymentRequests", (req, res) => {
  let user_id = req.user.id;

  let filteredList = [];

  db.transactions.forEach((transaction) => {
    if (
      transaction.payer_id == user_id &&
      transaction.transaction_type == "request" &&
      transaction.status == "pending"
    ) {
      const account = db.accounts.find(
        (account) => account.user_id == transaction.payee_id
      );
      const response = {
        name: account.holder_name,
        note: transaction.note,
        amount: transaction.amount,
        date: transaction.date,
        upi: account.upi,
      };
      filteredList.push(response);
    }
  });
  filteredList.sort(
    (transaction1, transaction2) =>
      Date.parse(transaction2.date) - Date.parse(transaction1.date)
  );
  return res.status(200).send(filteredList);
});

server.get("/api/getRecentPayments", (req, res) => {
  let user_id = req.user.id;

  let filteredList = [];
  let listOfupi = [];

  db.transactions.forEach((transaction) => {
    if (transaction.payer_id == user_id) {
      let account = db.accounts.find(
        (account) => account.user_id == transaction.payee_id
      );
      if (account != -1) {
        const response = {
          name: account.holder_name,
          date: transaction.date,
          upi: account.upi,
        };
        if (!listOfupi.includes(response.upi)) {
          filteredList.push(response);
          listOfupi.push(response.upi);
        }
      }
    }
  });
  filteredList.sort(
    (transaction1, transaction2) =>
      Date.parse(transaction2.date) - Date.parse(transaction1.date)
  );
  return res.status(200).send(filteredList);
});

server.post("/verifyOtp", (req, res) => {
  let index = db.otps.findIndex((otp) => otp.phone_no == req.body.phone_no);

  if (index == -1) {
    return res.sendStatus(404);
  }
  if (db.otps[index].otp == req.body.otp) {
    res.status(200).jsonp({ message: "OTP Verified" });
  } else {
    res.status(401).jsonp({ message: "Invalid OTP" });
  }
});

server.post("/api/:t/sendMoney", (req, res) => {
  const tech = req.params.t;
  const user_id = req.user.id;
  const { payee_upi, amount, user_account_id, message } = req.body;
  if (user_id && payee_upi) {
    //find user_account
    let user_account = db.accounts.find(
      (account) => account.id === user_account_id
    );

    if (!user_account) {
      return res.status(404).send("Entered bank number is invalid");
    }
    //find payee_account
    let payee_account = db.accounts.find(
      (account) => account.upi === payee_upi
    );
    if (!payee_account) {
      return res
        .status(404)
        .send("No bank account present with the entered details");
    }

    const transaction = {
      transaction_id: db.transactions.length + 1,
      user_account_id: user_account.id,
      user_id: user_id,
      payee_account_id: payee_account.id,
      payee_id: payee_account.user_id,
      participant_name: payee_account.holder_name,
      date: new Date(),
      amount: amount,
      status: "success",
      is_debit: true,
      payer_id: user_id,
      transaction_type: "send",
      note: message,
    };

    if (user_account.balance < amount) {
      db.transactions.push({ ...transaction, status: "failed" });
      writeToDB();
      return res.status(404).send("Insufficient Balance");
    }

    db.accounts.forEach((account) => {
      if (account.id === user_account.id) {
        account.balance = account.balance - amount;
      }
    });

    db.accounts.forEach((account) => {
      if (account.id === payee_account.id) {
        account.balance = account.balance + amount;
      }
    });
    db.transactions.push(transaction);
    pushNotification(
      transaction.payee_id,
      sendBody(transaction),
      sendData(transaction),
      tech
    );
    writeToDB();
    return res.status(200).send("Sent Successfully");
  }
  return res.status(401).send("Request Declined");
});

server.post("/api/:t/requestMoney", (req, res) => {
  const tech = req.params.t;
  const user_id = req.user.id;
  const { payer_upi, amount, message } = req.body;
  if (user_id && payer_upi) {
    //find user_account
    let user_account = db.accounts.find((account) => account.id === user_id);

    if (!user_account) {
      return res.status(404).send("Entered user details is invalid");
    }
    //find payee_account
    let payer_account = db.accounts.find(
      (account) => account.upi === payer_upi
    );
    if (!payer_account) {
      return res
        .status(404)
        .send("No bank account present with the entered upi details");
    }

    const transaction = {
      transaction_id: db.transactions.length + 1,
      user_account_id: user_account.id,
      user_id: user_id,
      payee_account_id: user_account.id,
      payee_id: user_id,
      participant_name: payer_account.holder_name,
      date: new Date(),
      amount: amount,
      status: "pending",
      is_debit: false,
      payer_id: payer_account.user_id,
      transaction_type: "request",
      note: message,
    };

    db.transactions.push(transaction);
    writeToDB();
    pushNotification(
      transaction.payer_id,
      requestBody(transaction),
      requestData(transaction),
      tech
    );
    return res.status(200).send("requested Successfully");
  }
  return res.status(401).send("Request Declined");
});

server.post("/validate/mobile", (req, res) => {
  const phone_no = req.body.phone_no;
  if (phone_no) {
    let index = db.users.findIndex((user) => user.phone_no == phone_no);
    if (index == -1) {
      return res.status(404).send("Entered number is not registred yet");
    }
    return res.status(200).jsonp({ message: "Validation successfull" });
  }
  return res.status(401).send("Invalid number");
});

server.get("/api/validate/upi", (req, res) => {
  const participant_upi = req.query.upi?.toLowerCase();
  if (participant_upi) {
    let index = db.users.findIndex((user) => user.upi == participant_upi);
    if (index == -1) {
      return res.status(404).send("Invalid UPI ID");
    }
    const { id, name, dob, upi, phone_no } = db.users[index];
    return res.status(200).jsonp({
      message: "Validation successful",
      user: { id, name, dob, upi, phone_no },
    });
  }
  return res.sendStatus(400);
});

server.post("/login", (req, res) => {
  const phone_no = req.body.phone_no;
  const password = req.body.password;
  const fcm_token = req.body.fcm_token;

  if (phone_no && password) {
    let index = db.users.findIndex((user) => user.phone_no == phone_no);
    if (index == -1) {
      return res.status(404).send("Entered number is not registred yet");
    }
    if (db.users[index].password === password) {
      const user = { ...db.users[index] };
      delete user.password;
      let accessToken;
      if (!user.token) {
        accessToken = Buffer.from(
          `${Object.values(user)}${Math.random() * 9999999}`
        ).toString("base64");
      } else {
        accessToken = user.token;
      }
      db.users[index].token = accessToken;
      db.users[index].fcm_token = fcm_token;
      user.fcm_token = fcm_token;
      writeToDB();

      return res.status(200).jsonp({ accessToken, user });
    }
    return res.status(401).send("Incorrect password !");
  }
  return res.status(401).send("Invalid user detais");
});

server.get("/api/user", (req, res) => {
  return res.status(200).jsonp(req.user);
});

server.get("/api/accounts", (req, res) => {
  const usersAccounts =
    db.accounts.filter((acc) => acc.user_id === req.user.id) || [];
  return res.status(200).jsonp(usersAccounts);
});
server.use(
  jsonServer.rewriter({
    "/api/accounts/:id": "/accounts/:id",
  })
);
server.get("/api/accounts/:id/transactions", (req, res) => {
  const accountId = parseInt(req.params.id);
  const userId = parseInt(req.user.id);
  const accountIndex = db.accounts.findIndex((acc) => {
    return acc.user_id === userId && acc.id === accountId;
  });
  if (accountIndex === -1) {
    return res.status(404).send("Account not exist");
  }
  const query = req.query;
  let page = 1,
    pageSize = 10,
    filterBy = null,
    filterValue = null;
  if (query.page > 1) {
    page = query.page;
  }
  if (query.pageSize) {
    pageSize = query.pageSize;
  }
  if (["is_debit", "status"].includes(query.filterBy) && query.filterValue) {
    filterBy = query.filterBy;
    if (query.filterBy === "is_debit") {
      filterValue = query.filterValue === "true" ? true : false;
    } else {
      filterValue = query.filterValue;
    }
  }
  const allTransactions =
    db.transactions.filter((transaction) => {
      if (
        transaction.user_id === userId &&
        transaction.user_account_id === accountId
      ) {
        if (filterBy && filterValue !== null) {
          return transaction[filterBy] === filterValue;
        } else {
          return true;
        }
      }
      return false;
    }) || [];
  return res.status(200).jsonp({
    data: paginate(allTransactions, pageSize, page),
    total: allTransactions.length,
  });
});

server.get("/api/payment/requested", (req, res) => {
  const userId = req.user.id;

  const list =
    db.requests.filter((r) => {
      return r.requested_to_user_id === userId;
    }) || [];
  return res.status(200).jsonp(list);
});

server.post("/api/changeStatus", (req, res) => {
  const { upi, amount, status, transaction_id } = req.body;
  let transactionStatus = false;
  if (status === "pay") {
    db.accounts.forEach((account) => {
      if (account.upi === req.user.upi) {
        if (amount <= account.balance) {
          account.balance -= amount;
          transactionStatus = true;
        }
      }
    });
    if (transactionStatus) {
      db.accounts.forEach((account) => {
        if (account.upi === upi) {
          account.balance += amount;
        }
      });
    }
  }
  db.transactions.forEach((transaction) => {
    if (transaction.transaction_id == transaction_id) {
      if (status === "decline") {
        transaction.status = "declined";
        transactionStatus = true;
      } else {
        if (transactionStatus) {
          transaction.status = "success";
        } else {
          transaction.status = "failed";
        }
      }
    }
  });

  if (!transactionStatus) {
    return res.status(401).send("Insufficient ");
  }
  return res.status(200).send("Successful");
});

server.get("/api/transactions", (req, res) => {
  const userId = parseInt(req.user.id);
  const accountIndex = db.accounts.findIndex((acc) => {
    return acc.user_id === userId;
  });
  if (accountIndex === -1) {
    return res.status(404).send("Account not exist");
  }
  const query = req.query;
  let page = 1,
    pageSize = 10,
    filterBy = null,
    filterValue = null;
  accountIds = [];
  if (query.page > 1) {
    page = query.page;
  }
  if (query.pageSize) {
    pageSize = query.pageSize;
  }
  if (query.accountIds) {
    accountIds = query.accountIds;
  }
  if (["is_debit", "status"].includes(query.filterBy) && query.filterValue) {
    filterBy = query.filterBy;
    if (query.filterBy === "is_debit") {
      filterValue = query.filterValue === "true" ? true : false;
    } else {
      filterValue = query.filterValue;
    }
  }

  let filteredTransactions = db.transactions.filter(
    (transaction) =>
      transaction.user_id === userId &&
      accountIds.includes(transaction.user_account_id.toString())
  );

  if (filterBy && filterValue !== null) {
    filteredTransactions = filteredTransactions.filter(
      (transaction) => transaction[filterBy] == filterValue
    );
  }

  return res.status(200).jsonp({
    data: paginate(filteredTransactions, pageSize, page),
    total: filteredTransactions.length,
  });
});

function sendBody(transaction) {
  const user = db.users.find((users) => users.id === transaction.payer_id);
  return {
    title: `Received ₹${transaction.amount}`,
    body: `${user.name} paid ₹${transaction.amount} to you.`,
  };
}

function requestBody(transaction) {
  const user = db.users.find((users) => users.id === transaction.payee_id);
  return {
    title: `Requested ₹${transaction.amount}`,
    body: `${user.name} requested ₹${transaction.amount} from you.`,
  };
}

function sendData(transaction) {
  const user = db.users.find((users) => users.id === transaction.payer_id);
  return {
    upi: user.upi,
    name: user.name,
  };
}

function requestData(transaction) {
  const user = db.users.find((users) => users.id === transaction.payee_id);
  return {
    upi: user.upi,
    name: user.name,
  };
}

function pushNotification(user_id, notification_body, notification_data, tech) {
  const user = db.users.find((users) => users.id === user_id);

  let fcmApiToken;

  switch (tech) {
    case "fl":
      fcmApiToken = process.env.FCM_API_TOKEN_FL;
      break;
    default:
      fcmApiToken = process.env.FCM_API_TOKEN_RN;
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: fcmApiToken,
  };
  const options = {
    method: "POST",
    headers,
    data: {
      to: user.fcm_token,
      notification: notification_body,
      data: notification_data,
    },
    url: "https://fcm.googleapis.com/fcm/send",
  };

  if (user.fcm_token != null) {
    axios(options);
  }
}

server.use(router);
server.listen(process.env.PORT || 3001, () => {
  console.log("JSON Server is running");
});

module.exports = server;
