# Alif pay 

Real Wallet frontend + Appwrite backend (OTP, Users, Wallet)

## Setup

1. Create Appwrite project
2. Create `users` collection
   - Fields: name (string), contact (string), password (string), address (string), balance (integer), createdAt (string), otp (string, optional), otpExpiry (string, optional)
3. Deploy `send-otp` function (Node.js 20)
4. Update `index.html`:
   - Replace `YOUR_APPWRITE_ENDPOINT`
   - Replace `YOUR_PROJECT_ID`
   - Replace `YOUR_USERS_COLLECTION_ID`
   - Replace `YOUR_OTP_FUNCTION_ID`
5. Serve `index.html` (local or static hosting)
