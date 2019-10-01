"use strict";
var fs = require('fs');
var database = require('./database.js').get();
var studentsFilename = process.argv[2];
var preferencesFilename = process.argv[3];
var gradeNameInput = process.argv[4];
var studentsInput = JSON.parse(fs.readFileSync(studentsFilename, 'utf-8')).student;
var preferencesInput = JSON.parse(fs.readFileSync(preferencesFilename, 'utf-8')).preference;
var db = database.firestore();
Promise.all([
    getNewUserRecords(studentsInput, gradeNameInput),
    getNewPreferencesObject(preferencesInput, studentsInput, gradeNameInput),
]).then(function (results) {
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
    var _a;
    var promises = [];
    for (var i = 0; i < oldStudents.length; i++) {
        var student = oldStudents[i];
        var username = getUsernameForEmail(student.email);
        promises.push(db.collection('grades').doc(gradeName).set({
            students: (_a = {},
                _a[username] = student.name,
                _a)
        }, { merge: true }));
        promises.push(db.collection('user-records').doc(username).set({
            grade: gradeName,
            isMale: student.gender === 'M'
        }));
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
    var newPreferences = {};
    for (var i = 0; i < oldPreferences.length; i++) {
        var preference = oldPreferences[i];
        var student = getStudentWithID(preference.student_id, oldStudents);
        var friend = getStudentWithID(preference.preference_id, oldStudents);
        var studentUsername = getUsernameForEmail(student.email);
        var friendUsername = getUsernameForEmail(friend.email);
        if (newPreferences[studentUsername]) {
            newPreferences[studentUsername].push(friendUsername);
        }
        else {
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
    return oldStudents.filter(function (student) {
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
