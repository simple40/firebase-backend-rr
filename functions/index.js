/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

console.log("1");
const express = require('express');
const errorHandler = require('./middleware/errorHandler');

const app = express();

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
console.log("2");
// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
app.use(express.json());
app.get("/",(req,res)=>
{
    res.send("hello");
});
console.log("5");
app.use('/news',require('./routes/newsRoutes'));
console.log("6");
app.use(errorHandler);
console.log("3");
exports.api = onRequest(app);
console.log("4");