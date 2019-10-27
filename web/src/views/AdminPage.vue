<template>
    <div>
        <nav class="navbar navbar-expand-lg navbar-light bg-light">
            <a class="navbar-brand" href="#">Outie Admin</a>
        </nav>
        <div v-if="hasLoaded" class="content-container container mt-4 overflow-hidden">
            <div>
                Grade
                <select v-model="selectedGradeID">
                    <option disabled value="undefined">Choose a Grade</option>
                    <option v-for="gradeID in sortedGradeIDs" v-bind:value="gradeID" v-bind:key="gradeID">{{ gradeNames[gradeID] }}</option>
                </select>
            </div>
            <template v-if="selectedGradeID">
                <div>
                    <h3 class="mt-5">
                        Students
                        <button class="btn btn-success" v-on:click="startAddingNewStudent()">Add</button>
                        <button class="btn btn-info ml-2" v-on:click="startUploadingCSV()">Upload</button>
                    </h3>
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Name</th>
                                <th>Gender</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <editing-user-row
                                v-if="isAddingUser"
                                v-bind:username="editingStudentNewUsername"
                                v-bind:name="editingStudentNewName"
                                v-bind:isMale="editingStudentNewIsMale"
                                v-on:input-username="editingStudentNewUsername = $event"
                                v-on:input-name="editingStudentNewName = $event"
                                v-on:input-is-male="editingStudentNewIsMale = $event"
                                v-on:click-save="saveNewStudent()"
                            />
                            <template v-for="username in selectedGradeStudentUsernames">
                                <editing-user-row
                                    v-if="username === editingStudentUsername"
                                    v-bind:key="username"

                                    v-bind:username="editingStudentNewUsername"
                                    v-bind:name="editingStudentNewName"
                                    v-bind:isMale="editingStudentNewIsMale"
                                    v-on:input-username="editingStudentNewUsername = $event"
                                    v-on:input-name="editingStudentNewName = $event"
                                    v-on:input-is-male="editingStudentNewIsMale = $event"
                                    v-on:click-save="saveEditedStudent()"
                                />
                                <tr v-else v-bind:key="username">
                                    <td>{{username}}</td>
                                    <td>{{grades[selectedGradeID].students[username]}}</td>
                                    <td>{{
                                        userRecords[username].isMale === undefined ? ''
                                            : userRecords[username].isMale === true ? 'Male'
                                            : 'Female'
                                    }}</td>
                                    <td>
                                        <button class="btn fas fa-pencil-alt text-primary" v-on:click="startEditingStudent(username)"></button>
                                        <button class="btn fas fa-trash-alt text-danger" v-on:click="deleteStudent(username)"></button>
                                    </td>
                                </tr>
                            </template>
                        </tbody>
                    </table>
                </div>
                <div class="mb-3">
                    <h3 class="mt-5">Disallowed Pairings <button class="btn btn-success" v-on:click="startAddingAntiPreference()">Add</button></h3>
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Username 1</th>
                                <th>Username 2</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <editing-anti-preference-row
                                v-if="isAddingAntiPreference"
                                v-bind:usernameA="editingAntiPreferenceNewUsernameA"
                                v-bind:usernameB="editingAntiPreferenceNewUsernameB"
                                v-on:input-username-a="editingAntiPreferenceNewUsernameA = $event"
                                v-on:input-username-b="editingAntiPreferenceNewUsernameB = $event"
                                v-on:click-save="saveNewAntiPreference()"
                            />
                            <template v-for="antiPreferenceString in selectedGradeAntiPreferenceStrings">
                                <editing-anti-preference-row
                                    v-if="antiPreferenceString === editingAntiPreferenceString"
                                    v-bind:key="antiPreferenceString"

                                    v-bind:usernameA="editingAntiPreferenceNewUsernameA"
                                    v-bind:usernameB="editingAntiPreferenceNewUsernameB"
                                    v-on:input-username-a="editingAntiPreferenceNewUsernameA = $event"
                                    v-on:input-username-b="editingAntiPreferenceNewUsernameB = $event"
                                    v-on:click-save="saveEditedAntiPreference()"
                                />
                                <tr v-else v-bind:key="antiPreferenceString">
                                    <td>{{antiPreferenceString.split('__')[0]}}</td>
                                    <td>{{antiPreferenceString.split('__')[1]}}</td>
                                    <td>
                                        <button class="btn fas fa-pencil-alt text-primary" v-on:click="startEditingAntiPreference(antiPreferenceString)"></button>
                                        <button class="btn fas fa-trash-alt text-danger" v-on:click="deleteAntiPreference(antiPreferenceString)"></button>
                                    </td>
                                </tr>
                            </template>
                        </tbody>
                    </table>
                </div>
                <modal name="upload-students-modal" classes="" pivotY="0.3" width="100%" height="auto" v-bind:clickToClose="!isProcessingUpload">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Upload a File</h5>
                                <button v-if="!isProcessingUpload" class="close fas fa-times" v-on:click="stopUploadingCSV()"></button>
                            </div>
                            <div class="modal-body">
                                <template v-if="isProcessingUpload">
                                    <p>Loading…</p>
                                </template>
                                <template v-else>
                                    <p>
                                        Instead of manually entering all of the students
                                        in a grade, you can upload an entire CSV file to be
                                        parsed automatically. This CSV file must be in the
                                        format "username, full name, gender".
                                    </p>
                                    <p>
                                        To export a CSV file from Excel, please see
                                        <a href="https://support.office.com/en-us/article/import-or-export-text-txt-or-csv-files-5250ac4c-663c-47ce-937b-339e391393ba" target="_blank">here</a>.
                                    </p>
                                    <p>
                                        Instead of making your own spreadsheet, you can also
                                        download a template
                                        <a href="/csv-template" target="_blank" download>here</a>.
                                        When using the template, make sure to replace the first line with
                                        your a student, instead of adding after the first line.
                                    </p>
                                </template>
                            </div>
                            <div class="modal-footer" v-if="!isProcessingUpload">
                                <label class="btn btn-primary my-0">
                                    Upload
                                    <input type="file" class="d-none" v-on:change="uploadCSVFile($event.target.files[0])">
                                </label>
                            </div>
                        </div>
                    </div>
                </modal>
            </template>
        </div>
        <div v-else class="container mt-5">
            Loading…
        </div>
    </div>
</template>

<script>
import firebase from '../js/database.js';
import Vue from 'vue';
import * as csvParse from 'csv-parse/lib/sync';
import VModal from 'vue-js-modal'

import EditingUserRow from '../components/EditingUserRow.vue';
import EditingAntiPreferenceRow from '../components/EditingAntiPreferenceRow.vue';

import * as users from '../js/admin-users';
import * as auth from '../js/auth';
import * as antiPreferences from '../js/admin-anti-preferences';

Vue.use(VModal)

export default {
    name: 'AdminPage',
    data: () => ({
        hasLoaded: false,
        grades: undefined,
        userRecords: undefined,
        selectedGradeID: undefined,

        isAddingUser: false,
        editingStudentUsername: undefined,
        editingStudentNewUsername: undefined,
        editingStudentNewName: undefined,
        editingStudentNewIsMale: undefined,

        isAddingAntiPreference: false,
        editingAntiPreferenceString: undefined,
        editingAntiPreferenceNewUsernameA: undefined,
        editingAntiPreferenceNewUsernameB: undefined,

        isProcessingUpload: false,
    }),
    computed: {
        sortedGradeIDs: function () {
            return Object.keys(this.grades).sort();
        },
        gradeNames: function () {
            let gradeIDs = Object.keys(this.grades);
            let gradeNames = {};

            for (let i = 0; i < gradeIDs.length; i++) {
                let gradeID = gradeIDs[i];
                let number = gradeID.slice(5, 9);
                let gradeName = 'Class of ' + number + ' (Grade ' + convertYearToGrade(parseInt(number)) + ')';

                if (gradeID.endsWith('f')) {
                    gradeName += ' Girls';
                }

                if (gradeID.endsWith('m')) {
                    gradeName += ' Boys';
                }

                gradeNames[gradeID] = gradeName;
            }

            return gradeNames;
        },
        selectedGradeStudentUsernames: function () {
            if (!this.selectedGradeID) {
                return [];
            }



            return Object.keys(this.grades[this.selectedGradeID].students || {}).filter((username) => username && this.userRecords[username]);
        },
        selectedGradeAntiPreferenceStrings: function () {
             if (!this.selectedGradeID) {
                return [];
            }

            return this.grades[this.selectedGradeID].antiPreferences || [];
        },
    },
    methods: {
        startAddingNewStudent: function () {
            this.resetEditingUser();
            this.isAddingUser = true;
        },
        startEditingStudent: function (username) {
            this.isAddingUser = false;
            this.editingStudentUsername = username;
            this.editingStudentNewUsername = username;
            this.editingStudentNewName = this.grades[this.selectedGradeID].students[username];
            this.editingStudentNewIsMale = this.userRecords[username].isMale;
        },
        saveNewStudent: function () {
            users.addUser(
                this.selectedGradeID,
                this.editingStudentNewUsername,
                this.editingStudentNewName,
                this.editingStudentNewIsMale === "true",
            ).then(() => {
                return this.fetchData();
            }).then(() => {
                this.resetEditingUser();
            }).catch((error) => {
                console.log(error)
                // TODO: Handle it.
            });
        },
        saveEditedStudent: function () {
            users.updateUser(
                this.selectedGradeID,
                this.editingStudentUsername,
                this.editingStudentNewUsername,
                this.editingStudentNewName,
                this.editingStudentNewIsMale === "true",
            ).then(() => {
                return this.fetchData();
            }).then(() => {
                this.resetEditingUser();
            }).catch((error) => {
                console.log(error)
                // TODO: Handle it.
            });
        },
        deleteStudent: function (username) {
            users.deleteUser(this.selectedGradeID, username).then(() => {
                return this.fetchData();
            }).catch((error) => {
                console.log(error)
                // TODO: Handle it.
            });
        },
        startAddingAntiPreference: function () {
            this.resetEditingAntiPreference();
            this.isAddingAntiPreference = true;
        },
        startEditingAntiPreference: function (antiPreferenceString) {
            this.isAddingAntiPreference = false;
            this.editingAntiPreferenceString = antiPreferenceString;
            this.editingAntiPreferenceNewUsernameA = antiPreferenceString.split('__')[0];
            this.editingAntiPreferenceNewUsernameB = antiPreferenceString.split('__')[1];
        },
        saveNewAntiPreference: function () {
            antiPreferences.addAntiPreference(
                this.selectedGradeID,
                this.editingAntiPreferenceNewUsernameA,
                this.editingAntiPreferenceNewUsernameB
            ).then(() => {
                return this.fetchData();
            }).then(() => {
                this.resetEditingAntiPreference();
            }).catch((error) => {
                console.log(error)
                // TODO: Handle it.
            });
        },
        saveEditedAntiPreference: function () {
            antiPreferences.updateAntiPreference(
                this.selectedGradeID,
                this.editingAntiPreferenceString,
                this.editingAntiPreferenceNewUsernameA,
                this.editingAntiPreferenceNewUsernameB
            ).then(() => {
                return this.fetchData();
            }).then(() => {
                this.resetEditingAntiPreference();
            }).catch((error) => {
                console.log(error)
                // TODO: Handle it.
            });
        },
        deleteAntiPreference: function (antiPreferenceString) {
            antiPreferences.deleteAntiPreferenceString(this.selectedGradeID, antiPreferenceString).then(() => {
                return this.fetchData();
            }).catch((error) => {
                console.log(error)
                // TODO: Handle it.
            });
        },
        startUploadingCSV: function () {
            this.$modal.show('upload-students-modal');
        },
        stopUploadingCSV: function () {
            this.$modal.hide('upload-students-modal');
        },
        uploadCSVFile: function (file) {
            let reader = new FileReader();
            this.isProcessingUpload = true;

            reader.addEventListener('loadend', () => {
                let records = csvParse(reader.result);
                let promises = [];

                for (let i = 0; i < records.length; i++) {
                    promises.push(
                        users.addUser(
                            this.selectedGradeID,
                            records[i][0],
                            records[i][1],
                            records[i][2].toLowerCase() === "male",
                        ),
                    );
                }

                Promise.all(promises).then(() => {
                    return this.fetchData();
                }).then(() => {
                    this.stopUploadingCSV();
                    this.isProcessingUpload = false;
                }).catch((error) => {
                    console.log(error)
                    // TODO: Handle it.
                });
            })

            reader.readAsText(file);
        },
        fetchData: function () {
            return Promise.all([fetchGrades(), fetchUsers()]).then((results) => {
                this.grades = results[0];
                this.userRecords = results[1];
                this.hasLoaded = true;
            }).catch((error) => {
                console.log(error)
                // TODO: Handle it.
            });
        },
        resetEditingUser: function () {
            this.isAddingUser = false;
            this.editingStudentUsername = undefined;
            this.editingStudentNewUsername = '';
            this.editingStudentNewName = '';
            this.editingStudentNewIsMale = "true";
        },
        resetEditingAntiPreference: function () {
            this.isAddingAntiPreference = false;
            this.editingAntiPreferenceString = undefined;
            this.editingAntiPreferenceNewUsernameA = '';
            this.editingAntiPreferenceNewUsernameB = '';
        }
    },
    mounted: function () {
        auth.tryQuickAuth().then((status) => {
            if (!status || status.status === 0 || status.status === 1) {
                return this.$router.push('/');
            }

            return this.fetchData();
        }).catch((error) => {
            console.log(error)
            // TODO: Handle it.
        });
    },
    components: {
        'editing-user-row': EditingUserRow,
        'editing-anti-preference-row': EditingAntiPreferenceRow,
    },
};

function convertYearToGrade(year) {
    if (!year || isNaN(year)) {
        return 'Unknown';
    }

    if (new Date().getMonth() < 8) {
        return 12 - (year - new Date().getFullYear() - 1);
    } else {
        return 12 - (year - new Date().getFullYear());
    }
}

function fetchGrades() {
    let db = firebase.firestore();

    return db.collection('grades').get().then((querySnapshot) => {
        let grades = {};

        querySnapshot.forEach((snapshot) => {
            if (!snapshot.exists) {
                return;
            }

            grades[snapshot.id] = snapshot.data() || {};
        });

        return grades;
    }).catch((error) => {
        console.log(error)
        // TODO: Handle it.
    });
}

function fetchUsers() {
    let db = firebase.firestore();

    return db.collection('user-records').get().then((querySnapshot) => {
        let users = {};

        querySnapshot.forEach((snapshot) => {
            if (!snapshot.exists) {
                return;
            }

            users[snapshot.id] = snapshot.data() || {};
        });

        return users;
    }).catch((error) => {
        console.log(error)
        // TODO: Handle it.
    });
}
</script>
