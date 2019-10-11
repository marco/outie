<template>
    <div class="content-container" v-bind:class="{ 'logged-out': !username, 'container mt-5 logged-in': username }">
        <template v-if="username">
            <template v-if="learnMore">
                <h2>How it Works</h2>
                <p>
                    After everyone's chosen their friends, Outie uses a special
                    algorithm to make the groups.
                </p>

                <p>
                    The way this algorithm works is complicated, but the simplest
                    explanation is that you are more likely to be grouped with your
                    friends if they list you in return. In other words, if you list
                    five friends, but none of them chose you as <em>their</em> friend,
                    it's less likely that you will be in their group; conversely,
                    if all of the people you listed also chose you, you're much more
                    likely to be in their group.
                </p>

                <p>
                    The most import thing to know is that you <em>will not</em>
                    be placed with your friends if you don't fill out the preferences
                    survey! So make sure that you choose your friends before the deadline.
                </p>

                <a v-on:click="onClickHideLearnMore();" href="#">Close</a>
            </template>
            <template v-else-if="hasLoaded">
                <h1 class="display-4">
                    Hi, {{ name || "Student" }}!
                </h1>
                <p>
                    Pick your friends below so you can be paired with them
                    when the groups are made. Note, the order of your
                    preferences doesn't matter. If you want to learn more about
                    how the groups are made, see <a v-on:click="onClickLearnMore();" href="#">here</a>.
                </p>
                <p>
                    <span v-for="(number, i) in PREFERENCE_NUMBERS" class="d-block"  v-bind:key="i">
                        <strong class="preference-label d-inline-block">{{ number }} Preference</strong>
                        <select v-model="currentChosenPreferences[i]">
                            <option disabled value="undefined">
                                Pick a Friend
                            </option>
                            <option
                                v-for="username in sortedPreferenceChoiceUsernames"
                                v-bind:key="username"
                                v-bind:value="username"
                            >
                                {{otherStudents[username]}}
                            </option>
                        </select>
                    </span>
                </p>
                <template v-if="hasMadeChanges">
                    <p v-if="savingError">
                        {{ savingError }}
                    </p>
                    <p v-else-if="hasSavedPreferences">
                        Your preferences have been saved. 😃
                    </p>
                    <p v-else>
                        Saving…
                    </p>
                </template>
            </template>
            <template v-else>
                Loading…
            </template>
        </template>
        <div v-else class="intro-div">
            <h1>
                Outie
            </h1>
            <h2>
                Chadwick's Outdoor Ed group maker
            </h2>
            <img src="../assets/sign-in-with-google.png"  v-on:click="onClickSignIn();"/>
        </div>
    </div>
</template>

<script>
import firebase from '../js/database.js'
import * as auth from '../js/auth.js';

export default {
    name: 'IndexPage',
    data: () => ({
        hasLoaded: false,
        hasMadeChanges: false,
        learnMore: false,
        name: undefined,
        username: undefined,
        otherStudents: undefined,
        currentChosenPreferences: undefined,
        hasSavedPreferences: true,
        savingError: undefined,
        PREFERENCE_NUMBERS: ['First', 'Second', 'Third', 'Fourth', 'Fifth'],
    }),
    computed: {
        sortedPreferenceChoiceUsernames: function () {
            if (!this.otherStudents) {
                return undefined;
            }

            return Object.keys(this.otherStudents).sort((usernameA, usernameB) => {
                let nameA = getLastNameFirst(this.otherStudents[usernameA]);
                let nameB = getLastNameFirst(this.otherStudents[usernameB]);

                if (nameA < nameB) {
                    return -1;
                }

                if (nameA > nameB) {
                    return 1;
                }

                return 0;
            });
        }
    },
    watch: {
        currentChosenPreferences: function (newChosenPreferences, oldChosenPreferences) {
            if (oldChosenPreferences == undefined) {
                return;
            }

            let filteredPreferences = newChosenPreferences.filter((preference) => preference);
            this.hasMadeChanges = true;

            if (filteredPreferences.length < this.PREFERENCE_NUMBERS.length) {
                this.savingError = "Please fill out all of your preferences.";
                return;
            }

            if ((new Set(filteredPreferences)).size !== filteredPreferences.length) {
                this.savingError = "Duplicates are not allowed in your preferences. Please ensure you have a different friend for each option.";
                return;
            }

            this.savingError = undefined;
            this.hasSavedPreferences = false;
            this.savePreferences();
        },
    },
    methods: {
        onClickSignIn: function () {
            return auth.tryLongAuth().then(this.handleAuthStatus);
        },
        handleAuthStatus: function (status) {
            if (!status || status.status === 0) {
                return;
            }

            if (status.status === 1) {
                this.name = status.name;
                this.username = status.username;
                return this.fetchData();
            }

            this.$router.push('admin');
        },
        fetchData: function () {
            return fetchUserRecord(this.username).then((userRecord) => {
                this.currentChosenPreferences = userRecord.preferences || [];
                return fetchStudents(userRecord.grade);
            }).then((students) => {
                delete students[this.username];
                this.otherStudents = students;
                this.hasLoaded = true;
            }).catch(function(error) {
                console.log(error)
                // TODO: Handle it.
            });
        },

        savePreferences: function () {
            let db = firebase.firestore();

            db.collection('user-records').doc(this.username).set({
                preferences: this.currentChosenPreferences.filter((preference) => preference),
            }, { merge: true }).then(() => {
                this.hasSavedPreferences = true;
            });
        },

        onClickLearnMore: function () {
            this.learnMore = true;
        },

        onClickHideLearnMore: function () {
            this.learnMore = false;
        }
    },
    mounted: function () {
        auth.tryQuickAuth().then(this.handleAuthStatus);
    },
}

function usernameForUser(user) {
    let email = user.email;
    return email.substr(0, email.indexOf('@'));
}

function fetchUserRecord(username) {
    let db = firebase.firestore();

    return db.collection('user-records').doc(username).get().then((snapshot) => {
        if (!snapshot.exists) {
            throw new Error('Sorry, you aren\'t registered as a current student. Please try again later.');
        }

        return snapshot.data() || {};
    });
}

function fetchStudents(grade) {
    if (!grade) {
        throw new Error('Sorry, that grade doesn\'t exist.');
    }

    let db = firebase.firestore();

    return db.collection('grades').doc(grade).get().then((snapshot) => {
        if (!snapshot.exists) {
            throw new Error('Sorry, that grade doesn\'t exist.');
        }

        let data = snapshot.data() || {};
        return data.students || {};
    });
}

function getLastNameFirst(name) {
    let words = name.split(' ');
    let lastName = words.splice(-1);
    return lastName + ' ' + words.join(' ');
}
</script>
