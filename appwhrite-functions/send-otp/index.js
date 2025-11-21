const sdk = require("node-appwrite");
const client = new sdk.Client();

client.setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

const database = new sdk.Database(client);

module.exports = async function (req, res) {
  const payload = JSON.parse(req.payload);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiry = new Date(Date.now() + 5*60*1000).toISOString();

  const users = await database.listDocuments('YOUR_USERS_COLLECTION_ID', []);
  const user = users.documents.find(u => u.contact === payload.contact);
  if(!user) return res.json({ success:false, error:"User not found" });

  await database.updateDocument('YOUR_USERS_COLLECTION_ID', user.$id, { otp, otpExpiry });

  await client.call('POST', '/v1/mails', {
    sender: 'noreply@laamwallet.com',
    recipient: payload.contact,
    subject: 'Laam Wallet OTP',
    text: `Your OTP is ${otp}`
  });

  res.json({ success:true, message:"OTP sent" });
};
