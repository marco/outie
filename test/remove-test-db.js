let database = require('../src/database.js').get();
let testConstants = require('./test-constants.js');

let currentPromises = [];
let db = database.firestore();

db.collection('user-records').get().then((snapshot) => {
    for (let i = 0; i < snapshot.docs.length; i++) {
        let docID = snapshot.docs[i].id;

        if (docID.endsWith(testConstants.TEST_SUFFIX)) {
            currentPromises.push(db.collection('user-records').doc(docID).delete());
        }
    }
});

currentPromises.push(
    db.collection('grades').doc(testConstants.TEST_GRADE).delete()
);

Promise.all(currentPromises).then(() => {
    console.log('done');
});
