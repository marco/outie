import * as firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

let firebaseConfig = {
    apiKey: 'AIzaSyADbgSuyESi3ivnJbvmkVYJ8KMeYpxEerw',
    authDomain: 'outie-adfe8.firebaseapp.com',
    databaseURL: 'https://outie-adfe8.firebaseio.com',
    projectId: 'outie-adfe8',
    storageBucket: 'outie-adfe8.appspot.com',
    messagingSenderId: '991943556695',
    appId: '1:991943556695:web:880bb7b1aed15ef34a6d12'
}

firebase.initializeApp(firebaseConfig);

export default firebase;
