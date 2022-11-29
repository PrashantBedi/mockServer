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
      return res
        .status(404)
        .jsonp({ message: "Entered number is not registred yet" });
    }
    return res.status(200).jsonp({ message: "Validation successfull" });
  }
  return res.status(401).jsonp({ message: "Invalid number" });
});

server.use(router);
server.listen(process.env.PORT || 3001, () => {
  console.log("JSON Server is running");
});

module.export = server;
