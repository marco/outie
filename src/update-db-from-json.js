let fs = require('fs');
let database = require('../src/database.js').get();

let studentsFilename = process.argv[2];
let preferencesFilename = process.argv[3];
let gradeNameInput = process.argv[4];

let studentsInput = JSON.parse(fs.readFileSync(studentsFilename, 'utf-8')).student;
let preferencesInput = JSON.parse(fs.readFileSync(preferencesFilename, 'utf-8')).preference;

let db = database.firestore();

Promise.all([
    getNewUserRecords(studentsInput, gradeNameInput),
    getNewPreferencesObject(preferencesInput, studentsInput, gradeNameInput),
]).then((results) => {
    console.log('Done updating ' + gradeNameInput);
});

/**
 * Creates new user record objects based on legacy data and writes them to
 * the database.
 *
 * @param {Object} oldStudents The legacy student objects.
 * @param {string} gradeName The current grade name.
 * @return {Promise} A promise that resolves when writing has been completed.
 */
function getNewUserRecords(oldStudents, gradeName) {
    let promises = [];

    for (let i = 0; i < oldStudents.length; i++) {
        let student = oldStudents[i];
        let username = getUsernameForEmail(student.email);

        promises.push(
            db.collection('grades').doc(gradeName).set({
                students: {
                    [username]: student.name,
                }
            }, { merge: true }),
        );

        promises.push(
            db.collection('user-records').doc(username).set({
                grade: gradeName,
                isMale: student.gender === 'M',
            }),
        );
    }

    return Promise.all(promises);
}

/**
 * Creates a new preferences object based on legacy data and writes it to
 * the database.
 *
 * @param {Object} oldPreferences The legacy database object.
 * @param {Object} oldStudents The legacy students object.
 * @param {string} gradeName The name of the current grade.
 * @return {Promise} A promise that resolves when writing has been completed.
 */
function getNewPreferencesObject(oldPreferences, oldStudents, gradeName) {
    let newPreferences = {};

    for (let i = 0; i < oldPreferences.length; i++) {
        let preference = oldPreferences[i];

        let student = getStudentWithID(preference.student_id, oldStudents);
        let friend = getStudentWithID(preference.preference_id, oldStudents);

        let studentUsername = getUsernameForEmail(student.email);
        let friendUsername = getUsernameForEmail(friend.email);

        if (newPreferences[studentUsername]) {
            newPreferences[studentUsername].push(friendUsername);
        } else {
            newPreferences[studentUsername] = [friendUsername];
        }
    }

    return db.collection('preferences').doc(gradeName).set(newPreferences);
}

/**
 * Returns a legacy student object given a legacy student ID.
 *
 * @param {number} id The ID of the user in the legacy database.
 * @param {Object} oldStudents The legacy student objects.
 * @return {Object} The legacy student object.
 */
function getStudentWithID(id, oldStudents) {
    return oldStudents.filter((student) => {
        return student.id === id;
    })[0];
}

/**
 * Returns the username for a user given their email address.
 *
 * @param {string} email The user's email address.
 * @return {string} The user's username.
 */
function getUsernameForEmail(email) {
    return email.substring(0, email.indexOf("@"));
}
