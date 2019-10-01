let fs = require('fs');
let database = require('./database').get();
let csv = require('csv-string');

let filename = process.argv[2];
let gradeName = process.argv[3];
let separateGenders = process.argv[4] === 'true';

let parsedRows = csv.parse(fs.readFileSync(filename, 'utf-8'));
let db = database.firestore();

let promises = [];

for (let row of parsedRows) {
    let isMale = row[1] === 'Boy';
    let fullGradeName = gradeName + (separateGenders ? (isMale ? 'm' : 'f') : '');

    promises.push(
        db.collection('user-records').doc(row[0]).set({
            grade: fullGradeName,
            isMale: isMale,
        })
    );

    console.log(fullGradeName)
    promises.push(
        db.collection('preferences').doc(fullGradeName).set({
            [row[0]]: row.slice(2),
        }, { merge: true })
    );
}

Promise.all(promises).then(() => {
    console.log('Done updating.');
}).catch((error) => {
    console.log(error);
})
