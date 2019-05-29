let fs = require('fs');
let database = require('./database').get();
let csv = require('csv-string');

let filename = process.argv[2];
let gradeName = process.argv[3];

let parsedRows = csv.parse(fs.readFileSync(filename, 'utf-8'));
let db = database.firestore();

let promises = [];

for (let row of parsedRows) {
    promises.push(
        db.collection('user-records').doc(row[0]).set({
            grade: gradeName,
            isMale: row[2] === 'Boy',
        })
    );

    promises.push()
    db.collection('preferences').doc(gradeName).set({
        [row[0]]: row.slice(3),
    }, { merge: true });
}

Promise.all(promises).then(() => {
    console.log('Done updating.');
}).catch((error) => {
    console.log(error);
})
