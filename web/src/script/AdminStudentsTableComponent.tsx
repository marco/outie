import * as React from 'react';
import * as firebase from 'firebase/app';
import * as _ from 'lodash';
import 'firebase/firestore';
import 'firebase/auth';
import { Grade, UserRecords } from './Types';

enum NewGenderValue { Undefined, Male, Female }

interface Props {
    gradeID: string;
    grade: Grade;
    userRecords: UserRecords;
}

interface State {
    isAdding: boolean;
    newNameValue: string;
    newUsernameValue: string;
    newGenderValue: NewGenderValue;
    isRemoving: boolean;
    removingUsername: string;
}

export default class AdminStudentsTableComponent extends React.Component<Props, State> {
    public constructor(props: Props) {
        super(props);

        this.state = {
            isAdding: false,
            newNameValue: '',
            newUsernameValue: '',
            newGenderValue: NewGenderValue.Undefined,
            isRemoving: false,
            removingUsername: '',
        }
    }

    public render(): JSX.Element {
        return (
            <div>
                <h3>
                    Students
                    {this.renderStartAddButton()}
                </h3>
                {this.renderAddAlert()}
                {this.renderTable()}
            </div>
        )
    }

    private renderStartAddButton(): JSX.Element | undefined {
        if (!this.state.isAdding) {
            return (
                <button type="button" className="btn btn-primary btn-sm ml-2 mb-1"  onClick={() => this.onClickStartAdd()}>
                    Add a Student
                </button>
            );
        }
    }

    private onClickStartAdd(): void {
        this.setState({
            isAdding: true,
            newNameValue: '',
            newUsernameValue: '',
            newGenderValue: NewGenderValue.Undefined,
        });
    }

    private renderAddAlert(): JSX.Element | undefined {
        if (this.state.isAdding) {
            return (
                <div className="alert alert-primary">
                    <p><strong>Add a New Student</strong></p>
                    <div className="form-group">
                        <label htmlFor="nameInput">Name</label>
                        <input type="text" className="form-control" id="nameInput" name="newName" value={this.state.newNameValue} onChange={(event) => this.onChangeNewValue(event)}/>
                    </div>
                    <label htmlFor="usernameInput">Username</label>
                    <div className="input-group">
                        <input type="email" className="form-control" id="usernameInput" name="newUsername" value={this.state.newUsernameValue} onChange={(event) => this.onChangeNewValue(event)}/>
                        <div className="input-group-append">
                            <span className="input-group-text">@chadwickschool.org</span>
                        </div>
                    </div>
                    <label className="mt-3">Gender</label>
                    <div className="form-check">
                        <input className="form-check-input" type="radio" id="maleRadioInput" name="newGender" value="male" checked={this.state.newGenderValue === 1} onChange={(event) => this.onChangeNewValue(event)}/>
                        <label className="form-check-label" htmlFor="maleRadioInput">Male</label>
                    </div>
                    <div className="form-check mb-4">
                        <input className="form-check-input" type="radio" id="femaleRadioInput" name="newGender" value="female" checked={this.state.newGenderValue === 0} onChange={(event) => this.onChangeNewValue(event)}/>
                        <label className="form-check-label" htmlFor="femaleRadioInput">Female</label>
                    </div>

                    {this.renderAddConfirmButton()}
                    <button className="btn btn-light" onClick={() => this.onClickCancelAdd()}>Cancel</button>
                </div>
            )
        }
    }

    private onChangeNewValue(event: React.ChangeEvent): void {
        let target = event.target as HTMLInputElement;

        switch (target.name) {
            case 'newName':
                this.setState({
                    newNameValue: target.value,
                });
                break;
            case 'newUsername':
                this.setState({
                    newUsernameValue: target.value,
                })
                break;
            case 'newGender':
                this.setState({
                    newGenderValue: target.value === 'male' ? NewGenderValue.Male : NewGenderValue.Female,
                })
                break;
        }
    }

    private onClickCancelRemove(): void {
        this.setState({
            isRemoving: false,
            removingUsername: '',
        });
    }

    private onClickCancelAdd(): void {
        this.setState({
            isAdding: false,
            newNameValue: '',
            newUsernameValue: '',
            newGenderValue: NewGenderValue.Undefined,
        });
    }

    private onClickConfirmRemove(): void {
        Promise.all([
            firebase.firestore().collection('grades').doc(this.props.gradeID).set({
                students: {
                    [this.state.removingUsername]: firebase.firestore.FieldValue.delete(),
                },
            }, { merge: true }),
            firebase.firestore().collection('user-records').doc(this.state.removingUsername).delete(),
        ]).then(() => {
            this.onClickCancelRemove();
        });
    }

    private onClickConfirmAdd(): void {
        let newUserName = this.state.newNameValue;
        let newUserUsername = this.state.newUsernameValue;
        let newUserIsMale = this.state.newGenderValue === NewGenderValue.Male;

        Promise.all([
            firebase.firestore().collection('grades').doc(this.props.gradeID).set({
                students: {
                    [newUserUsername]: newUserName
                },
            }, { merge: true }),
            firebase.firestore().collection('user-records').doc(newUserUsername).set({
                grade: this.props.gradeID,
                isMale: newUserIsMale,
            }),
        ]).then(() => {
            this.onClickCancelAdd();
        });
    }

    private onClickStartDelete(username: string): void {
        this.setState({
            isRemoving: true,
            removingUsername: username,
        });
    }

    private renderAddConfirmButton(): JSX.Element {
        if (
            this.state.newNameValue
            && this.state.newUsernameValue
            && this.state.newGenderValue !== NewGenderValue.Undefined
            && this.props.userRecords[this.state.newUsernameValue]
            && !this.props.grade.students[this.state.newUsernameValue]
        ) {
            return (
                <button className="btn btn-primary mr-2" onClick={() => this.onClickConfirmAdd()}>Add User</button>
            )
        }

        return <button className="btn btn-primary mr-2" disabled>Add User</button>
    }

    private renderTable(): JSX.Element {
        let contents = [];

        for (let username in this.props.grade.students) {
            let userRecord = this.props.userRecords[username];
            let name = this.props.grade.students[username];

            contents.push(
                <tr>
                    <td>{name}</td>
                    <td>{username}</td>
                    <td>{userRecord.isMale ? 'Male' : 'Female'}</td>
                    <td><a className='fas fa-trash-alt text-danger' onClick={() => this.onClickStartDelete(username)}></a></td>
                </tr>
            );

            if (this.state.removingUsername === username) {
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
                                <button className="btn btn-danger mr-2" onClick={() => this.onClickConfirmRemove()}>Delete</button>
                                <button className="btn btn-light" onClick={() => this.onClickCancelRemove()}>Cancel</button>
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
}
