"use strict";
var _a;
var fs = require('fs');
var database = require('./database').get();
var csv = require('csv-string');
var filename = process.argv[2];
var gradeName = process.argv[3];
var separateGenders = process.argv[4] === 'true';
var parsedRows = csv.parse(fs.readFileSync(filename, 'utf-8'));
var db = database.firestore();
var promises = [];
for (var _i = 0, parsedRows_1 = parsedRows; _i < parsedRows_1.length; _i++) {
    var row = parsedRows_1[_i];
    var isMale = row[1] === 'Boy';
    var fullGradeName = gradeName + (separateGenders ? (isMale ? 'm' : 'f') : '');
    promises.push(db.collection('user-records').doc(row[0]).set({
        grade: fullGradeName,
        isMale: isMale
    }));
    console.log(fullGradeName);
    promises.push(db.collection('preferences').doc(fullGradeName).set((_a = {},
        _a[row[0]] = row.slice(2),
        _a), { merge: true }));
}
Promise.all(promises).then(function () {
    console.log('Done updating.');
})["catch"](function (error) {
    console.log(error);
});
