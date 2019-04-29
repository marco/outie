let _ = require('lodash');
let database = require('../src/database.js').get();
let testConstants = require('./test-constants.js');

let boysNames = testConstants.BOYS_NAMES;
let girlsNames = testConstants.GIRLS_NAMES;

let currentPromises = [];
let totalNames = boysNames.concat(girlsNames);
let db = database.firestore();

for (let i = 0; i < totalNames.length; i++) {
    let name = totalNames[i];
    let username = totalNames[i] + testConstants.TEST_SUFFIX;
    let isMale = boysNames.includes(name);

    currentPromises.push(
        db.collection('user-records').doc(username).set({
            isMale,
            grade: testConstants.TEST_GRADE
        })
    );
    currentPromises.push(
        db.collection('grades').doc(testConstants.TEST_GRADE).set({
            students: {
                [username]: name
            }
        }, { merge: true  })
    );
    // currentPromises.push(
    //     db.collection('preferences').doc(testConstants.TEST_GRADE).set({
    //         [username]: getRandomChoices(username, isMale, testConstants.PREFERENCE_COUNT),
    //     }, { merge: true })
    // )
}

currentPromises.push(
    db.collection('preferences').doc(testConstants.TEST_GRADE).set(testConstants.PREFERENCES)
);

Promise.all(currentPromises).then(() => {
    console.log('done');
});

function getRandomChoices(username, isMale, count) {
    if (count === 0) {
        return [];
    }

    if (_.random(0, 1, true) < testConstants.GENDER_SWAP_CHANCE) {
        return getRandomChoices(username, !isMale, count - 1).concat(getRandomChoices(username, isMale, count - 1))
    }

    return _.sampleSize(isMale ? boysNames : girlsNames.filter((name) => {
        return name + testConstants.TEST_SUFFIX !== username
    }), count).map((name) => {
        return name + testConstants.TEST_SUFFIX;
    });
}
