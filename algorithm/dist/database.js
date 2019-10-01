"use strict";
exports.__esModule = true;
var fs = require('fs');
var path = require('path');
var admin = require("firebase-admin");
var serviceAccount = require('../config/firebase-service-key.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://outie-adfe8.firebaseio.com"
});
exports.get = function getDatabase() {
    return admin;
};
