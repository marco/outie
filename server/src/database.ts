let fs = require('fs');
let path = require('path');
import * as admin from 'firebase-admin';

let serviceAccount = require('../config/firebase-service-key.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://outie-adfe8.firebaseio.com",
});

export let get = function getDatabase() {
    return admin;
}
