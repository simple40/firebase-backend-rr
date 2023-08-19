const admin = require("firebase-admin");
// Initialize the Firebase Admin SDK
const serviceAccount = require("../rr-test-project-393915-firebase-adminsdk-8tk58-8e97be0eef.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
module.exports = admin;
