const sdk = require("node-appwrite");

// Appwrite client
const client = new sdk.Client();

client
  .setEndpoint(process.env.APPWRITE_ENDPOINT) // https://nyc.cloud.appwrite.io/v1
  .setProject(process.env.APPWRITE_PROJECT_ID) // Project ID
  .setKey(process.env.APPWRITE_API_KEY); // 6920c9a6002f73daaf09

const database = new sdk.Database(client);

const USERS_COLLECTION = "users"; // collection ID
const TX_COLLECTION = "transactions"; // collection ID
const BLOCKS_COLLECTION = "blocks"; // collection ID

// Helper
function uid(len = 8) {
  return Math.random().toString(16).slice(2, 2 + len);
}

function nowTs() {
  return new Date().toISOString();
}

// ====== HANDLER ======
module.exports = async function (req, res) {
  try {
    const body = JSON.parse(req.payload || "{}");
    const action = body.action;

    if (action === "signup") {
      const { name, contact, password } = body;
      if (!name || !contact || !password)
        return res.json({ success: false, msg: "Dhammaan xogta waa required" });

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5min

      // Save user
      const user = {
        name,
        contact,
        password,
        address: "0x" + uid(20),
        balance: 1000,
        createdAt: nowTs(),
        otp,
        otpExpiry,
        emailVerified: false,
      };

      await database.createDocument(USERS_COLLECTION, uid(24), user);

      return res.json({ success: true, msg: "OTP la diray", otp });
    }

    if (action === "verifyOtp") {
      const { contact, otp } = body;
      const users = await database.listDocuments(USERS_COLLECTION, [
        sdk.Query.equal("contact", contact),
      ]);

      if (!users.documents.length)
        return res.json({ success: false, msg: "User ma jiro" });

      const user = users.documents[0];
      if (user.otp !== otp) return res.json({ success: false, msg: "OTP khalad" });
      if (new Date() > new Date(user.otpExpiry))
        return res.json({ success: false, msg: "OTP expired" });

      await database.updateDocument(USERS_COLLECTION, user.$id, {
        otp: null,
        otpExpiry: null,
        emailVerified: true,
      });

      return res.json({ success: true, msg: "Email verified", user });
    }

    if (action === "send") {
      const { fromContact, toContact, amount, memo } = body;

      const usersFrom = await database.listDocuments(USERS_COLLECTION, [
        sdk.Query.equal("contact", fromContact),
      ]);
      const usersTo = await database.listDocuments(USERS_COLLECTION, [
        sdk.Query.equal("contact", toContact),
      ]);

      if (!usersFrom.documents.length || !usersTo.documents.length)
        return res.json({ success: false, msg: "Users ma jiraan" });

      const sender = usersFrom.documents[0];
      const recipient = usersTo.documents[0];

      if (sender.balance < amount)
        return res.json({ success: false, msg: "Balance ma filna" });

      // Update balances
      await database.updateDocument(USERS_COLLECTION, sender.$id, {
        balance: sender.balance - amount,
      });
      await database.updateDocument(USERS_COLLECTION, recipient.$id, {
        balance: recipient.balance + amount,
      });

      // Save transaction
      const tx = {
        txHash: "0x" + uid(12),
        fromAddr: sender.address,
        toAddr: recipient.address,
        amount,
        memo,
        ts: nowTs(),
      };

      await database.createDocument(TX_COLLECTION, uid(24), tx);

      // Add block
      const blocks = await database.listDocuments(BLOCKS_COLLECTION);
      const prevHash = blocks.documents.length
        ? blocks.documents[blocks.documents.length - 1].hash
        : "0x0";

      const block = {
        index: blocks.documents.length,
        ts: nowTs(),
        prevHash,
        hash: "0x" + uid(20),
        txs: [tx],
      };
      await database.createDocument(BLOCKS_COLLECTION, uid(24), block);

      return res.json({ success: true, tx, block });
    }

    return res.json({ success: false, msg: "Action unknown" });
  } catch (err) {
    return res.json({ success: false, msg: err.message });
  }
};
