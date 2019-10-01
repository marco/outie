import firebase from '../js/database.js';

export function updateAntiPreference(gradeID, oldAntiPreferenceString, newAntiPreferenceUsernameA, newAntiPreferenceUsernameB) {
    let db = firebase.firestore();

    return deleteAntiPreferenceString(gradeID, oldAntiPreferenceString).then(() => {
        let newAntiPreferenceString = newAntiPreferenceUsernameA + '__' + newAntiPreferenceUsernameB;

        return db.collection('grades').doc(gradeID).set({
            antiPreferences: firebase.firestore.FieldValue.arrayUnion(newAntiPreferenceString),
        }, { merge: true });
    });
}

export function addAntiPreference(gradeID, newAntiPreferenceUsernameA, newAntiPreferenceUsernameB) {
    let db = firebase.firestore();
    let newAntiPreferenceString = newAntiPreferenceUsernameA + '__' + newAntiPreferenceUsernameB;

    return db.collection('grades').doc(gradeID).set({
        antiPreferences: firebase.firestore.FieldValue.arrayUnion(newAntiPreferenceString),
    }, { merge: true });
}

export function deleteAntiPreferenceString(gradeID, antiPreferenceString) {
    let db = firebase.firestore();

    return db.collection('grades').doc(gradeID).set({
        antiPreferences: firebase.firestore.FieldValue.arrayRemove(antiPreferenceString),
    }, { merge: true });
}
