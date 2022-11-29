const jsonServer = require("json-server");
const server = jsonServer.create();
const router = jsonServer.router("./db.json");
const middlewares = jsonServer.defaults();
const data = require("../db.json");

server.use(middlewares);

server.use(jsonServer.bodyParser);

function writeToDB() {
  router.db.setState(data);
  router.db.write();
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
  var index = data.otps.findIndex((otp) => otp.phone_no == req.body.phone_no);

  if (index != -1) {
    res.sendStatus(422);
  }

  var otp = req.body.phone_no.slice(-5);
  data.otps.push({ phone_no: req.body.phone_no, otp: otp });
  writeToDB();
  res.status(200).jsonp({ message: "OTP Sent Successfully" });
});

server.post("/verifyOtp", (req, res) => {
  var index = data.otps.findIndex((otp) => otp.phone_no == req.body.phone_no);

  if (index == -1) {
    res.sendStatus(404);
  }
  if (data.otps[index].otp == req.body.otp) {
    res.status(200).jsonp({ message: "OTP Verified" });
  } else {
    res.status(401).jsonp({ message: "Invalid OTP" });
  }
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
      const accessToken = btoa(
        `${Object.values(user)}${Math.random() * 9999999}`
      );
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

server.use(router);
server.listen(process.env.PORT || 3001, () => {
  console.log("JSON Server is running");
});

module.export = server;
