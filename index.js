const jsonServer = require("json-server");
const server = jsonServer.create();
const router = jsonServer.router(require("./db.js"));
const middlewares = jsonServer.defaults();
let data = require("./db.js");

server.use(middlewares);

server.use(jsonServer.bodyParser);

function writeToDB() {
  router.db.setState(data);
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
    const index = data.users.findIndex((user) => user.token === token);
    if (index === -1) {
      return false;
    }
    const user = { ...data.users[index] };
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
  let index = data.users.findIndex(
    (user) => user.phone_no == req.body.phone_no
  );

  if (index != -1) {
    return res.sendStatus(403);
  }

  let otp = req.body.phone_no.slice(-5);
  data.otps.push({ phone_no: req.body.phone_no, otp: otp });
  writeToDB();
  res.status(200).jsonp({ message: "OTP Sent Successfully" });
});

server.post("/signup", (req, res) => {
  let index = data.users.findIndex(
    (user) => user.phone_no == req.body.phone_no
  );

  if (index != -1) {
    return res.sendStatus(403);
  }
  let userId = data.users.length + 1,
    username = req.body.name;

  let user = {
    id: userId,
    phone_no: req.body.phone_no,
    password: req.body.password,
    dob: req.body.dob,
    name: username,
    upi: req.body.phone_no + "@okaxis",
  };

  data.users.push(user);
  let accountLastId = data.accounts.length;
  data.accounts.push(
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
  data.users.forEach((user) => {
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

  let PayeeUpi = req.query.payeeUpi;
  let getPayeeUpi=decodeURIComponent(PayeeUpi);
  let getUserId = req.user.id;
  const payee_user_index=data.users.findIndex((user)=>user.upi===getPayeeUpi);
  const payee_id=data.users[payee_user_index].id;
  let filteredList=[];

  data.transactions.forEach((transaction)=>{
    if(transaction.payee_id===payee_id && transaction.user_id===getUserId){
      filteredList.push({
        note:transaction.note,
        amount:transaction.amount,
        status:transaction.status,
        isPayee:false,
      });
    }
    else if(transaction.user_id===payee_id && transaction.payee_id===getUserId){
      filteredList.push({
        note:transaction.note,
        amount:transaction.amount,
        status:transaction.status,
        isPayee:true,
      })
    }
  });

  return res.status(200).send(filteredList);

});

server.post("/verifyOtp", (req, res) => {
  let index = data.otps.findIndex((otp) => otp.phone_no == req.body.phone_no);

  if (index == -1) {
    return res.sendStatus(404);
  }
  if (data.otps[index].otp == req.body.otp) {
    res.status(200).jsonp({ message: "OTP Verified" });
  } else {
    res.status(401).jsonp({ message: "Invalid OTP" });
  }
});

server.post("/api/sendMoney", (req, res) => {
  const user_id=req.user.id;
  const payee_upi=req.body.payee_upi;
  const amount=req.body.amount;
  if(user_id && payee_upi){

    //find_user_index_in_accountsDB
    let user_index=data.accounts.findIndex((account)=>account.user_id === user_id);

    if(user_index===-1){
      return res.status(404).send("Entered bank number is invalid");
    }

    //find_payee_id
    let payee_index_id=data.users.findIndex((user)=>user.upi===payee_upi);

    //find_payee_index_in_accountsDB
    let payee_index=data.accounts.findIndex((account)=>account.user_id === data.users[payee_index_id].id);

    if(payee_index===-1){
      return res.status(404).send("No bank account present with the entered details");
    }

    let user_account_balance= parseFloat(data.accounts[user_index].balance);
    if(user_account_balance<amount){
      const transaction ={
        "id": data.transactions.length+1,
        "user_account_id": data.accounts[user_index].id,
        "user_id": user_id,
        "payee_account_id": data.accounts[payee_index].id,
        "payee_id": data.users[payee_index_id].id,
        "payee_name": data.users[payee_index_id].name,
        "date": Date.now(),
        "amount": amount,
        "status": "Failed",
        "is_debit": true
      }
      data.transactions.push(transaction);
      writeToDB();
      return res.status(404).send("Insufficient Balance");
    }
    let payee_account_balance=""+(parseFloat(data.accounts[payee_index].balance)+amount);

    data.accounts[user_index].balance = ""+(user_account_balance-amount);
    data.accounts[payee_index].balance = payee_account_balance;

    const transaction ={
      "id": data.transactions.length+1,
      "user_account_id": data.accounts[user_index].id,
      "user_id": user_id,
      "payee_account_id": data.accounts[payee_index].id,
      "payee_id": data.users[payee_index_id].id,
      "payee_name": data.users[payee_index_id].name,
      "date": Date.now(),
      "amount": amount,
      "status": "Successful",
      "is_debit": true
    }
    data.transactions.push(transaction);
    writeToDB();
    return res.status(200).send("Sent Successfully");

  }
  return res.status(401).send("Request Declined");
});


server.post("/validate/mobile", (req, res) => {
  const phone_no = req.body.phone_no;
  if (phone_no) {
    let index = data.users.findIndex((user) => user.phone_no == phone_no);
    if (index == -1) {
      return res.status(404).send("Entered number is not registred yet");
    }
    return res.status(200).jsonp({ message: "Validation successfull" });
  }
  return res.status(401).send("Invalid number");
});

server.get("/api/validate/upi", (req, res) => {
  const upi = req.query.upi?.toLowerCase();
  if (upi) {
    let index = data.users.findIndex((user) => user.upi == upi);
    if (index == -1) {
      return res.status(404).send("Invalid UPI ID");
    }
    return res
      .status(200)
      .jsonp({ message: "Validation successfull", id: data.users[index].id });
  }
  return res.sendStatus(400);
});

server.post("/login", (req, res) => {
  const phone_no = req.body.phone_no;
  const password = req.body.password;

  if (phone_no && password) {
    let index = data.users.findIndex((user) => user.phone_no == phone_no);
    if (index == -1) {
      return res.status(404).send("Entered number is not registred yet");
    }
    if (data.users[index].password === password) {
      const user = { ...data.users[index] };
      delete user.password;
      delete user.token;
      const accessToken = Buffer.from(
        `${Object.values(user)}${Math.random() * 9999999}`
      ).toString("base64");
      data.users[index].token = accessToken;
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
    data.accounts.filter((acc) => acc.user_id === req.user.id) || [];
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
  const accountIndex = data.accounts.findIndex(
    (acc) => acc.user_id === userId && acc.id === accountId
  );
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
    data.transactions.filter((transaction) => {
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

server.use(router);
server.listen(process.env.PORT || 3001, () => {
  console.log("JSON Server is running");
});

module.exports = server;
