import firebase from '../js/database.js';

export function checkUsernameAvailable(gradeID, newUsername) {
    let db = firebase.firestore();

    return db.collection('user-records').doc(newUsername).get().then((snapshot) => {
        if (snapshot.exists) {
            return false;
        }

        return db.collection('grades').doc(gradeID).get();
    }).then((snapshot) => {
        if (snapshot.exists && snapshot.data()[newUsername]) {
            return false;
        }

        return true;
    });
}

export function addUser(gradeID, newUsername, newName, newIsMale) {
    let db = firebase.firestore();

    return checkUsernameAvailable(gradeID, newUsername).then((available) => {
        if (!available) {
            throw new Error('The username ' + newUsername + ' is not available.');
        }

        return db.collection('grades').doc(gradeID).set({
            students: {
                [newUsername]: newName,
            },
        }, { merge: true });
    }).then(() => {
        return db.collection('user-records').doc(newUsername).set({
            isMale: newIsMale,
            grade: gradeID,
        });
    });
}

export function updateUser(gradeID, oldUsername, newUsername, newName, newIsMale) {
    let db = firebase.firestore();

    if (oldUsername === newUsername) {
        let gradePromise = db.collection('grades').doc(gradeID).set({
            students: {
                [oldUsername]: newName,
            },
        }, { merge: true });

        let userPromise = db.collection('user-records').doc(oldUsername).set({
            isMale: newIsMale,
        }, { merge: true });

        return Promise.all([gradePromise, userPromise]);
    }

    let oldUserRecord;

    return checkUsernameAvailable(gradeID, newUsername).then((available) => {
        if (!available) {
            throw new Error('The username ' + newUsername + ' is not available.');
        }

        return db.collection('user-records').doc(oldUsername).get();
    }).then((snapshot) => {
        oldUserRecord = snapshot.data();

        return deleteUser(gradeID, oldUsername);
    }).then(() => {
        return db.collection('grades').doc(gradeID).set({
            students: {
                [newUsername]: newName,
            },
        }, { merge: true });
    }).then(() => {
        return db.collection('user-records').doc(newUsername).set(oldUserRecord);
    });
}

export function deleteUser(gradeID, username) {
    let db = firebase.firestore();

    let gradePromise = db.collection('grades').doc(gradeID).set({
        students: {
            [username]: firebase.firestore.FieldValue.delete(),
        },
    }, { merge: true });

    let userPromise = db.collection('user-records').doc(username).delete();

    return Promise.all([gradePromise, userPromise]);
}
