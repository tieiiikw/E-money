const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// SUPABASE CLIENT
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

// Helper functions
function uid(len = 12) {
  return Math.random().toString(16).slice(2, 2 + len);
}

function nowTs() {
  return new Date().toISOString();
}

/* ======================================================
   SIGNUP → Create user + OTP
====================================================== */
app.post("/signup", async (req, res) => {
  const { name, contact, password } = req.body;

  if (!name || !contact || !password)
    return res.json({ success: false, msg: "All fields required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const { data, error } = await supabase.from("users").insert([
    {
      name,
      contact,
      password,
      balance: 1000,
      address: "0x" + uid(20),
      otp,
      otpExpiry,
      emailVerified: false,
      createdAt: nowTs(),
    },
  ]);

  if (error) return res.json({ success: false, msg: error.message });

  res.json({ success: true, otp });
});

/* ======================================================
   VERIFY OTP → Mark email verified
====================================================== */
app.post("/verify", async (req, res) => {
  const { contact, otp } = req.body;

  const { data: users } = await supabase
    .from("users")
    .select("*")
    .eq("contact", contact)
    .limit(1);

  if (!users || users.length === 0)
    return res.json({ success: false, msg: "User not found" });

  const user = users[0];

  if (user.otp !== otp) return res.json({ success: false, msg: "OTP incorrect" });

  if (new Date() > new Date(user.otpExpiry))
    return res.json({ success: false, msg: "OTP expired" });

  await supabase
    .from("users")
    .update({ otp: null, otpExpiry: null, emailVerified: true })
    .eq("id", user.id);

  res.json({ success: true, user });
});

/* ======================================================
   SEND TRANSACTION → update balances + store tx + block
====================================================== */
app.post("/send", async (req, res) => {
  const { fromContact, toContact, amount, memo } = req.body;

  // Fetch users
  const { data: fromUsers } = await supabase
    .from("users")
    .select("*")
    .eq("contact", fromContact);

  const { data: toUsers } = await supabase
    .from("users")
    .select("*")
    .eq("contact", toContact);

  if (!fromUsers.length || !toUsers.length)
    return res.json({ success: false, msg: "Users not found" });

  const sender = fromUsers[0];
  const recipient = toUsers[0];

  if (sender.balance < amount)
    return res.json({ success: false, msg: "Insufficient balance" });

  // Update balances
  await supabase
    .from("users")
    .update({ balance: sender.balance - amount })
    .eq("id", sender.id);

  await supabase
    .from("users")
    .update({ balance: recipient.balance + amount })
    .eq("id", recipient.id);

  // Save transaction
  const tx = {
    txHash: "0x" + uid(16),
    fromAddr: sender.address,
    toAddr: recipient.address,
    amount,
    memo,
    ts: nowTs(),
  };

  await supabase.from("transactions").insert([tx]);

  // Blocks
  const { data: blocks } = await supabase
    .from("blocks")
    .select("*")
    .order("index", { ascending: true });

  const prevHash = blocks.length ? blocks[blocks.length - 1].hash : "0x0";
  const block = {
    index: blocks.length,
    ts: nowTs(),
    prevHash,
    hash: "0x" + uid(32),
    txs: [tx],
  };

  await supabase.from("blocks").insert([block]);

  res.json({ success: true, tx, block });
});

/* ======================================================
   SERVER START
====================================================== */
app.listen(process.env.PORT, () =>
  console.log("Backend running on port", process.env.PORT)
);
