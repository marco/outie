import * as React from 'react';
import * as ReactDOM from 'react-dom'
import * as firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';
import '../style/admin.scss';
import { Grade, UserRecords } from './Types'

interface State {
    isAdding: boolean;
    newUsername1Value: string;
    newUsername2Value: string;
    isRemoving: boolean;
    removingAntiPreference: string;
}

interface Props {
    gradeID: string;
    grade: Grade;
    userRecords: UserRecords;
}

export default class AdminAntiPreferencesTableComponent extends React.Component<Props, State> {
    public constructor(props: Props) {
        super(props);

        this.state = {
            isAdding: false,
            newUsername1Value: '',
            newUsername2Value: '',
            isRemoving: false,
            removingAntiPreference: '',
        };
    }

    public render(): JSX.Element {
        return (
            <div>
                <h3>
                    Anti-preferences
                    {this.renderAddButton()}
                </h3>
                {this.renderAddAlert()}
                {this.renderTable()}
            </div>
        );
    }

    private renderAddButton(): JSX.Element | void {
        if (!this.state.isAdding) {
            return (
                <button type="button" className="btn btn-primary btn-sm ml-2 mb-1"  onClick={() => this.onClickStartAdd()}>
                    Add an Anti-preference
                </button>
            );
        }
    }

    private renderAddConfirmButton(): JSX.Element {
        let username1 = this.state.newUsername1Value;
        let username2 = this.state.newUsername2Value;

        if (
            username1
            && username2
            && username1 !== username2
            && this.props.grade.students[username1]
            && this.props.grade.students[username2]
            && !this.props.grade.antiPreferences.includes(this.getAntiPreference(username1, username2))
        ) {
            return (
                <button className="btn btn-primary mr-2" onClick={() => this.onClickConfirmAdd()}>Add Anti-preference</button>
            )
        }

        return <button className="btn btn-primary mr-2" disabled>Add Anti-preference</button>
    }

    private onChangeAddValue(event: React.ChangeEvent): void {
        let target = event.target as HTMLInputElement;

        switch (target.name) {
            case 'username1':
                this.setState({
                    newUsername1Value: target.value,
                });
                break;
            case 'username2':
                this.setState({
                    newUsername2Value: target.value,
                })
                break;
        }
    }


    private renderTable(): JSX.Element {
        let contents = [];
        let antiPreferences = this.props.grade.antiPreferences;

        for (let i = 0; i < antiPreferences.length; i++) {
            let antiPreferenceString = antiPreferences[i];
            let usernames = this.getUsernamesForAntiPreference(antiPreferenceString);
            let name1 = this.props.grade.students[usernames[0]]
            let name2 = this.props.grade.students[usernames[1]]

            contents.push(
                <tr>
                    <td>{name1}</td>
                    <td>{name2}</td>
                    <td><a className='fas fa-trash-alt text-danger' onClick={() => this.onClickStartRemove(antiPreferenceString)}></a></td>
                </tr>
            );

            if (this.state.removingAntiPreference === antiPreferenceString) {
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
                                <button className="btn btn-danger mr-2" onClick={() => this.onClickConfirmRemove()}>Delete</button>
                                <button className="btn btn-light" onClick={() => this.onClickCancelRemove()}>Cancel</button>
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

    private renderAddAlert(): JSX.Element | void {
        if (this.state.isAdding) {
            return (
                <div className="alert alert-primary">
                    <p><strong>Add a New Anti Preference</strong></p>
                    <label htmlFor="usernameInput1">Username 1</label>
                    <div className="input-group mb-3">
                        <input type="email" className="form-control" id="usernameInput1" name="username1" value={this.state.newUsername1Value} onChange={(event) => this.onChangeAddValue(event)}/>
                        <div className="input-group-append">
                            <span className="input-group-text">@chadwickschool.org</span>
                        </div>
                    </div>
                    <label htmlFor="usernameInput2">Username 2</label>
                    <div className="input-group mb-3">
                        <input type="email" className="form-control" id="usernameInput2" name="username2" value={this.state.newUsername2Value} onChange={(event) => this.onChangeAddValue(event)}/>
                        <div className="input-group-append">
                            <span className="input-group-text">@chadwickschool.org</span>
                        </div>
                    </div>

                    {this.renderAddConfirmButton()}
                    <button className="btn btn-light" onClick={() => this.onClickCancelAdd()}>Cancel</button>
                </div>
            )
        }
    }

    private onClickStartAdd(): void {
        this.setState({
            isAdding: true,
            newUsername1Value: '',
            newUsername2Value: '',
        });
    }

    private onClickCancelAdd(): void {
        this.setState({
            isAdding: false,
            newUsername1Value: '',
            newUsername2Value: '',
        });
    }

    private onClickConfirmAdd(): void {
        let username1 = this.state.newUsername1Value;
        let username2 = this.state.newUsername2Value;
        let antiPreferenceString = this.getAntiPreference(username1, username2);

        firebase.firestore().collection('grades').doc(this.props.gradeID).set({
            antiPreferences: firebase.firestore.FieldValue.arrayUnion(antiPreferenceString),
        }, { merge: true }).then(() => {
            this.onClickCancelAdd();
        });
    }

    private onClickStartRemove(antiPreference: string): void {
        this.setState({
            isRemoving: true,
            removingAntiPreference: antiPreference,
        });
    }

    private onClickCancelRemove(): void {
        this.setState({
            isRemoving: false,
            removingAntiPreference: '',
        });
    }

    private onClickConfirmRemove(): void {
        let antiPreference = this.state.removingAntiPreference;

        firebase.firestore().collection('grades').doc(this.props.gradeID).set({
            antiPreferences: firebase.firestore.FieldValue.arrayRemove(antiPreference),
        }, { merge: true }).then(() => {
            this.onClickCancelRemove();
        });
    }

    private getUsernamesForAntiPreference(antiPreference: string): [string, string] {
        let usernames = antiPreference.split('-');
        return [usernames[0], usernames[1]];
    }

    private getAntiPreference(username1: string, username2: string): string {
        return [username1, username2].sort().join('-');
    }
}
