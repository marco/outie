import * as firebaseConfig from '../config/firebase.json';
import * as firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';
import * as React from 'react';
import * as ReactDOM from 'react-dom'
import * as _ from 'lodash';
import '../style/index.scss';
import * as GoogleIcon from '../res/google-icon.png';

const FRIEND_CHOICES = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];
const PLACEHOLDER_NAME = 'Select';

class IndexPage extends React.Component<{}, Record<string, any>> {
    public constructor(props: {}) {
        super(props);

        this.state = {
            userDetails: undefined,
            gradeDetails: undefined,
            preferences: [],
            signinError: '',
            authState: 0,
            hasSaved: undefined,
        };
    }

    public render(): JSX.Element {
        return (
            <div className="inner-root">
                <h1>Outie</h1>
                <h2>Chadwick&apos;s OE Matchmaker</h2>
                {this.renderMainView()}
            </div>
        );
    }

    public componentDidMount(): void {
        firebase.initializeApp(firebaseConfig);

        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                this.fetchDetails(user.email!);
            } else {
                this.setState({ authState: 1 });
            }
        });
    }

    private renderMainView(): JSX.Element {
        if (this.state.authState === 0) {
            return <div><p>Loading...</p></div>;
        }

        if (this.state.authState === 1) {
            return (
                <div>
                    <button type="button" className="main-button" onClick={() => { this.onClickSignIn() }}>
                        <img src={GoogleIcon} className="sign-in-icon" />
                        Sign In
                    </button>
                    {this.state.signinError ? <p className="error-display">{this.state.signinError}</p> : ''}
                </div>
            );
        }

        if (!this.state.gradeDetails.nextTrip) {
            return <div><p>There are no upcoming trips. Please check back later.</p></div>;
        }

        if (this.state.hasSaved) {
            return (
                <div>
                    <p>Next trip: {this.state.gradeDetails.nextTrip}</p>
                    <p>Your preferences have been saved.</p>
                    <button type="button" onClick={() => { this.onClickChange() }}>Change your Preferences</button>
                </div>
            )
        }

        return (
            <div>
                <p>Next trip: {this.state.gradeDetails.nextTrip}</p>
                <h3>Pick your friends!</h3>
                <p>Note, the order of your selections does not matter.</p>
                <div className="selections">
                    {this.renderAllFriendOptions()}
                </div>
                {this.renderSubmitButton()}
            </div>
        );
    }

    private renderFriendOptions(id: number): JSX.Element {
        let studentOptions = _.map(this.state.gradeDetails.students, (student, key) => {
            return <option value={key}>{student}</option>;
        });

        studentOptions.unshift(<option disabled value={PLACEHOLDER_NAME}>{PLACEHOLDER_NAME}</option>);

        let value = this.state.preferences[id] || PLACEHOLDER_NAME;
        return <select value={value} onChange={(event) => { this.onUpdateSelection(event, id); }}>{studentOptions}</select>;
    }

    private renderAllFriendOptions(): JSX.Element[] {
        let selections = [];

        for (let i = 0; i < FRIEND_CHOICES.length; i++) {
            selections.push(
                <div className="input-group">
                    <label>{FRIEND_CHOICES[i]} Choice</label>
                    {this.renderFriendOptions(i)}
                </div>
            );
        }

        return selections;
    }

    private renderSubmitButton(): JSX.Element | void {
        let selections = this.state.preferences;

        for (let i = 0; i < FRIEND_CHOICES.length; i++) {
            if (!selections[i] || selections[i] === PLACEHOLDER_NAME) {
                return undefined;
            }
        }

        if (_.uniq(selections).length !== selections.length) {
            return undefined;
        }

        return <button type="button" onClick={() => { this.onClickSubmit() }}>Submit</button>
    }

    private onClickSignIn(): void {
        let provider = new firebase.auth.GoogleAuthProvider();

        provider.setCustomParameters({
            'hd': 'chadwickschool.org',
        });

        firebase.auth().signInWithPopup(provider).then((result) => {
            if (!result.user) {
                throw new Error('Sorry, you could not be signed in.');
            }

            let email = result.user.email!;
            return this.fetchDetails(email);
        });
    }

    private onClickSubmit(): void {
        let db = firebase.firestore();
        let username = this.getUsername(firebase.auth().currentUser!.email!);

        db.collection('preferences').doc(this.state.userDetails.grade).set({
            [username]: this.state.preferences,
        }, { merge: true }).then(() => {
            this.setState({
                hasSaved: true,
            });
        });
    }

    private onClickChange(): void {
        this.setState({
            hasSaved: false,
        });
    }

    private onUpdateSelection(event: React.ChangeEvent, id: number): void {
        let newPreferences = this.state.preferences.slice();
        newPreferences[id] = (event.target as HTMLInputElement).value;

        this.setState({
            preferences: newPreferences,
        });
    }

    private fetchDetails(email: string): Promise<void> {
        let username = this.getUsername(email);
        let userDetails: Record<string, any>;
        let gradeDetails: Record<string, any>;

        return this.getUserDetails(username).then((user) => {
            if (user.isAdmin) {
                window.location.href = '/admin';
            }

            userDetails = user;
            return this.getGradeDetails(user.grade);
        }).then((grade) => {
            gradeDetails = grade;
            return this.getPreferencesDetails(userDetails.grade, username);
        }).then((preferences) => {
            this.setState({
                gradeDetails,
                userDetails,
                preferences,
                hasSaved: preferences.length !== 0,
                authState: 2,
            });
        }).catch((error) => {
            this.setState({
                signinError: error.message,
                gradeDetails: undefined,
                userDetails: undefined,
                preferences: undefined,
                authState: 1,
            });
        });
    }

    private getGradeDetails(grade: string): Promise<Record<string, any>> {
        let db = firebase.firestore();

        return db.collection("grades").doc(grade).get().then((snapshot) => {
            if (!snapshot.exists) {
                throw new Error('An unexpected error occurred. Please try again later.');
            }

            return snapshot.data() || {};
        });
    }

    private getUserDetails(username: string): Promise<Record<string, any>> {
        let db = firebase.firestore();

        return db.collection("user-records").doc(username).get().then((snapshot) => {
            if (!snapshot.exists) {
                throw new Error('Sorry, you aren\'t a current student. Please try again later.');
            }

            return snapshot.data() || {};
        });
    }

    private getPreferencesDetails(grade: string, username: string): Promise<string[]> {
        let db = firebase.firestore();

        return db.collection("preferences").doc(grade).get().then((snapshot) => {
            if (!snapshot.exists) {
                return [];
            }

            return snapshot.data()![username];
        });
    }

    private getUsername(email: string): string {
        return email.substring(0, email.indexOf("@"));
    }
}

ReactDOM.render(<IndexPage />, document.getElementById('root'));
