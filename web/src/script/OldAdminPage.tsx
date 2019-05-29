import * as React from 'react';
import * as ReactDOM from 'react-dom'
import * as firebaseConfig from '../config/firebase.json';
import * as firebase from 'firebase/app';
import * as _ from 'lodash';
import 'firebase/firestore';
import 'firebase/auth';
import '../style/admin.scss';
import { Grade, Grades, UserRecord, UserRecords } from './Types'

interface AdminPageState {
    hasLoaded: boolean;
    currentGradeID: string | undefined;
    grades: Grades | undefined;
    userRecords: UserRecords | undefined;
    usernameToConfirmDeletion: string | undefined;
    isAddingNewUser: boolean;
    addNewUserNameValue: string;
    addNewUserUsernameValue: string;
    addNewUserGenderValue: number;
    isAddingAntiPreference: boolean;
    addAntiPreferenceUsername1Value: string;
    addAntiPreferenceUsername2Value: string;
    antiPreferenceToConfirmDeletion: string | undefined;
}

class AdminPage extends React.Component<{}, AdminPageState> {
    public constructor(props: {}) {
        super(props);

        this.state = {
            hasLoaded: false,
            currentGradeID: 'grade2019',
            grades: undefined,
            userRecords: undefined,
            usernameToConfirmDeletion: undefined,
            isAddingNewUser: false,
            addNewUserNameValue: '',
            addNewUserUsernameValue: '',
            addNewUserGenderValue: -1,
            isAddingAntiPreference: false,
            addAntiPreferenceUsername1Value: '',
            addAntiPreferenceUsername2Value: '',
            antiPreferenceToConfirmDeletion: '',
        };
    }

    public render(): JSX.Element {
        return (
            <div className="inner-root">
                {this.renderMainDiv()}
            </div>
        );
    }

    public componentDidMount(): void {
        firebase.initializeApp(firebaseConfig);
        this.fetchData();
    }

    private renderMainDiv(): JSX.Element {
        if (!this.state.hasLoaded) {
            return <div><p>Loading…</p></div>
        }

        return (
            <div className="container my-5">
                <div className="mb-5">
                    <h1 className="d-inline-block">
                        Outie Admin
                    </h1>
                    <select value={this.state.currentGradeID!} className="form-control d-inline-block w-auto ml-3 align-text-bottom" onChange={(event) => this.onChangeGrade(event)}>
                        {this.getGradeOptions()}
                    </select>
                </div>
                <h3>
                    Students
                    {this.renderAddUserButton()}
                </h3>
                {this.renderAddUserAlert()}
                {this.renderUserRecordsTable()}
                <h3>
                    Anti-preferences
                    {this.renderAddAntiPreferenceButton()}
                </h3>
                {this.renderAddAntiPreferenceAlert()}
                {this.renderAntiPreferencesTable()}
            </div>
        )
    }

    private onChangeGrade(event: React.ChangeEvent): void {
        let target = event.target as HTMLInputElement;

        this.setState({
            currentGradeID: target.value
        });
    }

    private renderAddUserButton(): JSX.Element | void {
        if (!this.state.isAddingNewUser) {
            return (
                <button type="button" className="btn btn-primary btn-sm ml-2 mb-1"  onClick={() => this.onClickStartAddingUser()}>
                    Add a Student
                </button>
            );
        }
    }

    private renderAddAntiPreferenceButton(): JSX.Element | void {
        if (!this.state.isAddingAntiPreference) {
            return (
                <button type="button" className="btn btn-primary btn-sm ml-2 mb-1"  onClick={() => this.onClickStartAddingAntiPreference()}>
                    Add an Anti-preference
                </button>
            );
        }
    }

    private renderAddUserDoneButton(): JSX.Element {
        if (
            this.state.addNewUserNameValue
            && this.state.addNewUserUsernameValue
            && this.state.addNewUserGenderValue !== -1
            && !this.state.userRecords![this.state.addNewUserUsernameValue]
            && !this.getCurrentGrade().students[this.state.addNewUserUsernameValue]
        ) {
            return (
                <button className="btn btn-primary mr-2" onClick={() => this.onClickConfirmAddUser()}>Add User</button>
            )
        }

        return <button className="btn btn-primary mr-2" disabled>Add User</button>
    }

    private renderAddAntiPreferenceDoneButton(): JSX.Element {
        let username1 = this.state.addAntiPreferenceUsername1Value;
        let username2 = this.state.addAntiPreferenceUsername2Value;
        let grade = this.getCurrentGrade();

        if (
            username1
            && username2
            && username1 !== username2
            && grade.students[username1]
            && grade.students[username2]
            && !grade.antiPreferences.includes(this.getAntiPreference(username1, username2))
        ) {
            return (
                <button className="btn btn-primary mr-2" onClick={() => this.onClickConfirmAddAntiPreference()}>Add Anti-preference</button>
            )
        }

        return <button className="btn btn-primary mr-2" disabled>Add Anti-preference</button>
    }

    private onChangeAddUser(event: React.ChangeEvent): void {
        let target = event.target as HTMLInputElement;

        switch (target.name) {
            case 'addUserName':
                this.setState({
                    addNewUserNameValue: target.value,
                });
                break;
            case 'addUserUsername':
                this.setState({
                    addNewUserUsernameValue: target.value,
                })
                break;
            case 'addUserGender':
                this.setState({
                    addNewUserGenderValue: target.value === 'isMale' ? 1 : 0,
                })
                break;
        }
    }

    private onChangeAddAntiPreference(event: React.ChangeEvent): void {
        let target = event.target as HTMLInputElement;

        switch (target.name) {
            case 'addAntiPreferenceUsername1':
                this.setState({
                    addAntiPreferenceUsername1Value: target.value,
                });
                break;
            case 'addAntiPreferenceUsername2':
                this.setState({
                    addAntiPreferenceUsername2Value: target.value,
                })
                break;
        }
    }

    private renderAddUserAlert(): JSX.Element | void {
        if (this.state.isAddingNewUser) {
            return (
                <div className="alert alert-primary">
                    <p><strong>Add a New Student</strong></p>
                    <div className="form-group">
                        <label htmlFor="nameInput">Name</label>
                        <input type="text" className="form-control" id="nameInput" name="addUserName" value={this.state.addNewUserNameValue} onChange={(event) => this.onChangeAddUser(event)}/>
                    </div>
                    <label htmlFor="usernameInput">Username</label>
                    <div className="input-group">
                        <input type="email" className="form-control" id="usernameInput" name="addUserUsername" value={this.state.addNewUserUsernameValue} onChange={(event) => this.onChangeAddUser(event)}/>
                        <div className="input-group-append">
                            <span className="input-group-text">@chadwickschool.org</span>
                        </div>
                    </div>
                    <label className="mt-3">Gender</label>
                    <div className="form-check">
                        <input className="form-check-input" type="radio" id="maleRadioInput" name="addUserGender" value="isMale" checked={this.state.addNewUserGenderValue === 1} onChange={(event) => this.onChangeAddUser(event)}/>
                        <label className="form-check-label" htmlFor="maleRadioInput">Male</label>
                    </div>
                    <div className="form-check mb-4">
                        <input className="form-check-input" type="radio" id="femaleRadioInput" name="addUserGender" value="isFemale" checked={this.state.addNewUserGenderValue === 0} onChange={(event) => this.onChangeAddUser(event)}/>
                        <label className="form-check-label" htmlFor="femaleRadioInput">Female</label>
                    </div>

                    {this.renderAddUserDoneButton()}
                    <button className="btn btn-light" onClick={() => this.onClickCancelAddUser()}>Cancel</button>
                </div>
            )
        }
    }

    private fetchData(): Promise<void> {
        return Promise.all([this.fetchGrades(), this.fetchUserRecords()]).then((results) => {
            this.setState({
                grades: results[0],
                userRecords: results[1],
                hasLoaded: true,
            });
        });
    }

    private onClickStartAddingUser(): void {
        this.setState({
            isAddingNewUser: true,
            addNewUserNameValue: '',
            addNewUserUsernameValue: '',
            addNewUserGenderValue: -1,
        });
    }

    private onClickCancelAddUser(): void {
        this.setState({
            isAddingNewUser: false,
            addNewUserNameValue: '',
            addNewUserUsernameValue: '',
            addNewUserGenderValue: -1,
        });
    }

    private onClickConfirmAddUser(): void {
        let newUserName = this.state.addNewUserNameValue;
        let newUserUsername = this.state.addNewUserUsernameValue;
        let newUserIsMale = this.state.addNewUserGenderValue === 1;

        Promise.all([
            firebase.firestore().collection('grades').doc(this.state.currentGradeID!).set({
                students: {
                    [newUserUsername]: newUserName
                },
            }, { merge: true }),
            firebase.firestore().collection('user-records').doc(newUserUsername).set({
                grade: this.state.currentGradeID!,
                isMale: newUserIsMale,
            }),
        ]).then(() => {
            return this.fetchData();
        }).then(() => {
            this.onClickCancelAddUser();
        });
    }

    private renderUserRecordsTable(): JSX.Element {
        let contents = [];

        for (let username in this.state.userRecords!) {
            let userRecord = this.state.userRecords![username];

            if (userRecord.grade !== this.state.currentGradeID) {
                continue;
            }

            let name = this.getCurrentGrade().students[username];

            contents.push(
                <tr>
                    <td>{name}</td>
                    <td>{username}</td>
                    <td>{userRecord.isMale ? 'Male' : 'Female'}</td>
                    <td><a className='fas fa-trash-alt text-danger' onClick={() => this.onClickTryDeleteUser(username)}></a></td>
                </tr>
            );

            if (this.state.usernameToConfirmDeletion === username) {
                let possessivePronoun = userRecord.isMale ? 'he ' : 'she ';
                let objectivePronoun = userRecord.isMale ? 'him ' : 'her ';

                contents.push(
                    <tr className='bg-white'>
                        <td colSpan={4}>
                            <div className="alert alert-danger">
                                <p><strong>Are you sure you want to remove {name}?</strong></p>
                                <p>
                                    Removing {name} will mean that {possessivePronoun}
                                    won&apos;t be able to pick any preferences. {_.capitalize(possessivePronoun)} also won&apos;t be an option for other
                                    students&apos; preferences.
                                </p>
                                <p>
                                    You can add {objectivePronoun} back to the list in the future.
                                </p>
                                <button className="btn btn-danger mr-2" onClick={() => this.onClickConfirmDeleteUser()}>Delete</button>
                                <button className="btn btn-light" onClick={() => this.onClickCancelDeleteUser()}>Cancel</button>
                            </div>
                        </td>
                    </tr>
                )
            }
        }

        return (
            <table className='w-100 table table-striped'>
                <thead>
                    <tr>
                        <th scope='col'>Name</th>
                        <th scope='col'>Username</th>
                        <th scope='col'>Gender</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {contents}
                </tbody>
            </table>
        );
    }

    private renderAntiPreferencesTable(): JSX.Element {
        let contents = [];
        let grade = this.getCurrentGrade()
        let antiPreferences = grade.antiPreferences;

        for (let i = 0; i < antiPreferences.length; i++) {
            let antiPreferenceString = antiPreferences[i];
            let usernames = this.getUsernamesForAntiPreference(antiPreferenceString);
            let name1 = grade.students[usernames[0]]
            let name2 = grade.students[usernames[1]]

            contents.push(
                <tr>
                    <td>{name1}</td>
                    <td>{name2}</td>
                    <td><a className='fas fa-trash-alt text-danger' onClick={() => this.onClickTryDeleteAntiPreference(antiPreferenceString)}></a></td>
                </tr>
            );

            if (this.state.antiPreferenceToConfirmDeletion === antiPreferenceString) {
                contents.push(
                    <tr className='bg-white'>
                        <td colSpan={4}>
                            <div className="alert alert-danger">
                                <p><strong>
                                    Are you sure you want to remove the anti-preference
                                    between {name1} and {name2}?
                                </strong></p>
                                <p>
                                    Removing this anti-preference will mean
                                    that {name1} and {name2} can be grouped together.
                                </p>
                                <p>
                                    You can add this anti-preference back to
                                    the list in the future.
                                </p>
                                <button className="btn btn-danger mr-2" onClick={() => this.onClickConfirmDeleteAntiPreference()}>Delete</button>
                                <button className="btn btn-light" onClick={() => this.onClickCancelDeleteAntiPreference()}>Cancel</button>
                            </div>
                        </td>
                    </tr>
                );
            }
        }

        return (
            <table className='w-100 table table-striped'>
                <thead>
                    <tr>
                        <th scope='col'>First Student</th>
                        <th scope='col'>Second Student</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {contents}
                </tbody>
            </table>
        );
    }

    private renderAddAntiPreferenceAlert(): JSX.Element | void {
        if (this.state.isAddingAntiPreference) {
            return (
                <div className="alert alert-primary">
                    <p><strong>Add a New Anti Preference</strong></p>
                    <label htmlFor="usernameInput1">Username 1</label>
                    <div className="input-group mb-3">
                        <input type="email" className="form-control" id="usernameInput1" name="addAntiPreferenceUsername1" value={this.state.addAntiPreferenceUsername1Value} onChange={(event) => this.onChangeAddAntiPreference(event)}/>
                        <div className="input-group-append">
                            <span className="input-group-text">@chadwickschool.org</span>
                        </div>
                    </div>
                    <label htmlFor="usernameInput2">Username 2</label>
                    <div className="input-group mb-3">
                        <input type="email" className="form-control" id="usernameInput2" name="addAntiPreferenceUsername2" value={this.state.addAntiPreferenceUsername2Value} onChange={(event) => this.onChangeAddAntiPreference(event)}/>
                        <div className="input-group-append">
                            <span className="input-group-text">@chadwickschool.org</span>
                        </div>
                    </div>

                    {this.renderAddAntiPreferenceDoneButton()}
                    <button className="btn btn-light" onClick={() => this.onClickCancelAddAntiPreference()}>Cancel</button>
                </div>
            )
        }
    }

    private onClickStartAddingAntiPreference(): void {
        this.setState({
            isAddingAntiPreference: true,
            addAntiPreferenceUsername1Value: '',
            addAntiPreferenceUsername2Value: '',
        });
    }

    private onClickCancelAddAntiPreference(): void {
        this.setState({
            isAddingAntiPreference: false,
            addAntiPreferenceUsername1Value: '',
            addAntiPreferenceUsername2Value: '',
        });
    }

    private onClickConfirmAddAntiPreference(): void {
        let username1 = this.state.addAntiPreferenceUsername1Value;
        let username2 = this.state.addAntiPreferenceUsername2Value;
        let antiPreferenceString = this.getAntiPreference(username1, username2);

        firebase.firestore().collection('grades').doc(this.state.currentGradeID!).set({
            antiPreferences: firebase.firestore.FieldValue.arrayUnion(antiPreferenceString),
        }, { merge: true }).then(() => {
            return this.fetchData();
        }).then(() => {
            this.onClickCancelAddAntiPreference();
        });
    }

    private onClickTryDeleteUser(username: string): void {
        this.setState({
            usernameToConfirmDeletion: username,
        });
    }

    private onClickTryDeleteAntiPreference(antiPreference: string): void {
        this.setState({
            antiPreferenceToConfirmDeletion: antiPreference,
        });
    }

    private onClickCancelDeleteUser(): void {
        this.setState({
            usernameToConfirmDeletion: undefined,
        });
    }

    private onClickCancelDeleteAntiPreference(): void {
        this.setState({
            antiPreferenceToConfirmDeletion: undefined,
        });
    }

    private onClickConfirmDeleteUser(): void {
        let usernameToDelete = this.state.usernameToConfirmDeletion!;

        Promise.all([
            firebase.firestore().collection('grades').doc(this.state.currentGradeID!).set({
                students: {
                    [usernameToDelete]: firebase.firestore.FieldValue.delete(),
                },
            }, { merge: true }),
            firebase.firestore().collection('user-records').doc(usernameToDelete).delete(),
        ]).then(() => {
            return this.fetchData();
        }).then(() => {
            this.onClickCancelDeleteUser();
        });
    }

    private onClickConfirmDeleteAntiPreference(): void {
        let antiPreferenceToDelete = this.state.antiPreferenceToConfirmDeletion!;

        firebase.firestore().collection('grades').doc(this.state.currentGradeID!).set({
            antiPreferences: firebase.firestore.FieldValue.arrayRemove(antiPreferenceToDelete),
        }, { merge: true }).then(() => {
            return this.fetchData();
        }).then(() => {
            this.onClickCancelDeleteAntiPreference();
        });
    }

    private getGradeOptions(): JSX.Element[] {
        let gradeOptions = [];

        for (let gradeID in this.state.grades!) {
            gradeOptions.push(
                <option value={gradeID}>
                    {this.getGradeName(gradeID)}
                </option>
            );
        }

        return gradeOptions;
    }

    private getGradeName(id: string): string {
        let year = parseInt(id.slice(-4));
        return 'Class of ' + year;
    }

    private fetchGrades(): Promise<Grades> {
        return firebase.firestore().collection('grades').get().then((snapshot) => {
            let grades: Grades = {};

            snapshot.forEach((doc) => {
                let grade = doc.data();

                if (!grade.students) {
                    grade.students = [];
                }

                if (!grade.antiPreferences) {
                    grade.antiPreferences = [];
                }

                grades[doc.id] = grade as Grade;
            });

            return grades;
        });
    }

    private fetchUserRecords(): Promise<{ [username: string]: UserRecord }> {
        return firebase.firestore().collection('user-records').get().then((snapshot) => {
            let userRecords: { [username: string]: UserRecord } = {};

            snapshot.forEach((doc) => {
                userRecords[doc.id] = doc.data() as UserRecord;
            });

            return userRecords;
        });
    }

    private getUsernamesForAntiPreference(antiPreference: string): [string, string] {
        let usernames = antiPreference.split('-');
        return [usernames[0], usernames[1]];
    }

    private getAntiPreference(username1: string, username2: string): string {
        return [username1, username2].sort().join('-');
    }

    private getCurrentGrade(): Grade {
        return this.state.grades![this.state.currentGradeID!];
    }
}

ReactDOM.render(<AdminPage />, document.getElementById('root'));
