import firebase from '../js/database.js';

export function nameForUser(user) {
    return user.displayName.split(' ')[0];
}

export function usernameForUser(user) {
    let email = user.email;
    return email.substr(0, email.indexOf('@'));
}

export function getAuthStatus() {
    let db = firebase.firestore();

    return new Promise((resolve, reject) => {
        firebase.auth().onAuthStateChanged((user) => {
            if (!user) {
                resolve(undefined);
            }

            let username = usernameForUser(user);
            let name = nameForUser(user);

            return db.collection('user-records').doc(username).get().then((snapshot) => {
                if (!snapshot.exists) {
                    resolve(undefined);
                }

                if (snapshot.data().isAdmin) {
                    resolve({ status: 2, name, username });
                }

                resolve({ status: 1, name, username });
            });
        });
    })
}

export function tryQuickAuth() {
    return getAuthStatus().then((authStatus) => {
        if (!authStatus) {
            return undefined;
        }

        return authStatus;
    });
}

export function tryLongAuth() {
    let provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({
        'prompt': 'select_account',
        'hd': 'chadwickschool.org',
    });

    return getAuthStatus().then((authStatus) => {
        if (!authStatus || authStatus.status === 0) {
            return firebase.auth().signInWithPopup(provider).then((result) => {
                if (!result.user) {
                    return undefined;
                }

                return tryLongAuth();
            });
        }

        return authStatus;
    });
}
