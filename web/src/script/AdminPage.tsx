import * as React from 'react';
import * as ReactDOM from 'react-dom'
import * as firebaseConfig from '../config/firebase.json';
import * as firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';
import '../style/admin.scss';
import { Grade, Grades, UserRecord, UserRecords } from './Types'
import AdminStudentsTableComponent from './AdminStudentsTableComponent'
import AdminAntiPreferencesTableComponent from './AdminAntiPreferencesTableComponent'

interface AdminPageState {
    hasLoadedGrades: boolean;
    hasLoadedUserRecords: boolean;
    currentGradeID: string | undefined;
    isAddingGrade: boolean;
    newGradeYearValue: string;
    grades: Grades | undefined;
    userRecords: UserRecords | undefined;
}

class AdminPage extends React.Component<{}, AdminPageState> {
    public constructor(props: {}) {
        super(props);

        this.state = {
            hasLoadedGrades: false,
            hasLoadedUserRecords: false,
            currentGradeID: undefined,
            grades: undefined,
            isAddingGrade: false,
            newGradeYearValue: "",
            userRecords: undefined,
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

        firebase.firestore().collection("user-records").onSnapshot((snapshot) => {
            let currentUserRecords: UserRecords = {};

            snapshot.forEach((doc) => {
                currentUserRecords[doc.id] = doc.data() as UserRecord;
            });

            this.setState({
                userRecords: currentUserRecords,
                hasLoadedUserRecords: true,
            });
        });

        firebase.firestore().collection("grades").onSnapshot((snapshot) => {
            let currentGrades: Grades = {};

            snapshot.forEach((doc) => {
                currentGrades[doc.id] = doc.data() as Grade;
            });

            this.setState({
                grades: currentGrades,
                currentGradeID: Object.keys(currentGrades)[0],
                hasLoadedGrades: true,
            });
        });
    }

    private renderMainDiv(): JSX.Element {
        if (!this.state.hasLoadedGrades || !this.state.hasLoadedUserRecords) {
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
                    {this.renderStartAddGradeButton()}
                    {this.renderAddGradeAlert()}
                </div>
                <AdminStudentsTableComponent
                    grade={this.state.grades![this.state.currentGradeID!]}
                    gradeID={this.state.currentGradeID!}
                    userRecords={this.state.userRecords!}
                />
                <AdminAntiPreferencesTableComponent
                    grade={this.state.grades![this.state.currentGradeID!]}
                    gradeID={this.state.currentGradeID!}
                    userRecords={this.state.userRecords!}
                />
            </div>
        )
    }

    private onChangeGrade(event: React.ChangeEvent): void {
        let target = event.target as HTMLInputElement;

        this.setState({
            currentGradeID: target.value
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

    private renderAddGradeAlert(): JSX.Element | undefined {
        if (this.state.isAddingGrade) {
            return (
                <div className="alert alert-primary">
                    <p><strong>Add a New Grade</strong></p>
                    <label htmlFor="gradeInput">Graduation Year</label>
                    <div className="input-group mb-3">
                        <div className="input-group-prepend">
                            <span className="input-group-text">Class of</span>
                        </div>
                        <input type="number" className="form-control" id="gradeInput" name="newGradeYear" value={this.state.newGradeYearValue} onChange={(event) => this.onChangeNewGradeValue(event)}/>
                    </div>

                    {this.renderAddGradeConfirmButton()}
                    <button className="btn btn-light" onClick={() => this.onClickCancelAddGrade()}>Cancel</button>
                </div>
            )
        }
    }

    private renderStartAddGradeButton(): JSX.Element | undefined {
        if (!this.state.isAddingGrade) {
            return (
                <button type="button" className="btn btn-primary btn-sm ml-2 mb-4"  onClick={() => this.onClickStartAddGrade()}>
                    Add a Grade
                </button>
            );
        }
    }

    private onClickStartAddGrade(): void {
        this.setState({
            newGradeYearValue: '',
            isAddingGrade: true,
        });
    }

    private onChangeNewGradeValue(event: React.ChangeEvent): void {
        let target = event.target as HTMLInputElement;

        switch (target.name) {
            case 'newGradeYear':
                this.setState({
                    newGradeYearValue: target.value
                });
                break;
        }
    }

    private renderAddGradeConfirmButton(): JSX.Element {
        if (this.state.newGradeYearValue && !this.state.grades!['grade' + this.state.newGradeYearValue]) {
            return (
                <button className="btn btn-primary mr-2" onClick={() => this.onClickConfirmAddGrade()}>Add Grade</button>
            )
        }

        return <button className="btn btn-primary mr-2" disabled>Add Grade</button>
    }

    private onClickCancelAddGrade(): void {
        this.setState({
            newGradeYearValue: '',
            isAddingGrade: false,
        });
    }

    private onClickConfirmAddGrade(): void {
        let newGradeID = 'grade' + this.state.newGradeYearValue;
        firebase.firestore().collection('grades').doc(newGradeID).set({
            students: [],
            antiPreferences: [],
        }).then(() => {
            this.setState({
                newGradeYearValue: '',
                isAddingGrade: false,
                currentGradeID: newGradeID,
            });
        });
    }
}

ReactDOM.render(<AdminPage />, document.getElementById('root'));
