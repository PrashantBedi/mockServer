const jsonServer = require('json-server')
const server = jsonServer.create()
const router = jsonServer.router('./db.json')
const middlewares = jsonServer.defaults()
const data = require('../db.json')

server.use(middlewares)
// server.use((req, res, next) => {
//     //  if (isAuthorized(req)) { // add your authorization logic here
//     if (true) {
//         next() // continue to JSON Server router
//     } else {
//         res.sendStatus(401)
//     }
// })
server.use(jsonServer.bodyParser)

function writeToDB() {
    router.db.setState(data)
    router.db.write()
}

server.get('/', (req, res) => {
    res.jsonp({
        "message": "Success"
    })
})

server.post('/sendOtp', (req, res) => {
    var otp = req.body.phone_no.slice(-5)
    data.otps.push({phone_no: req.body.phone_no, otp: otp})
    writeToDB();
    res.status(200).jsonp({"message":"OTP Sent Successfully"})
})

server.post('/verifyOtp', (req, res) => {
    var index = data.otps.findIndex((otp) => otp.phone_no == req.body.phone_no)

    if(index == -1) {
        res.sendStatus(404)
    }
    if(data.otps[index].otp == req.body.otp) {
        res.status(200).jsonp({"message":"OTP Verified"})
    } else {
        res.status(401).jsonp({"message":"Invalid OTP"})
    }
})

server.use(router)
server.listen(3000, () => {
    console.log('JSON Server is running')
})

module.export = server