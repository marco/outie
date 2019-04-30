const FRIEND_CHOICES = 3;
const PLACEHOLDER_NAME = 'Select';

class IndexPage extends React.Component {
    constructor(props) {
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

    render() {
        return (
            <div className="inner-root">
                <h1>Outie</h1>
                <h2>Chadwick's OE Matchmaker</h2>
                {this.renderMainView()}
            </div>
        );
    }

    componentDidMount() {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                this.fetchDetails(firebase.auth().currentUser.email);
            } else {
                this.setState({ authState: 1 });
            }
        });
    }

    renderMainView() {
        if (this.state.authState === 0) {
            return <div><p>Loading...</p></div>;
        }

        if (this.state.authState === 1) {
            return (
                <div>
                    <button type="button" className="main-button" onClick={() => { this.onClickSignIn() }}>
                        <img src="/static/res/google-icon.png" className="sign-in-icon" />
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
                    <div className="input-group">
                        <label>First Choice</label>
                        {this.renderFriendOptions(0)}
                    </div>
                    <div className="input-group">
                        <label>Second Choice</label>
                        {this.renderFriendOptions(1)}
                    </div>
                    <div className="input-group">
                        <label>Third Choice</label>
                        {this.renderFriendOptions(2)}
                    </div>
                </div>
                {this.renderSubmitButton()}
            </div>
        );
    }

    renderFriendOptions(id) {
        let studentOptions = _.map(this.state.gradeDetails.students, (student, key) => {
            return <option value={key}>{student}</option>;
        });

        studentOptions.unshift(<option disabled value={PLACEHOLDER_NAME}>{PLACEHOLDER_NAME}</option>);

        let value = this.state.preferences[id] || PLACEHOLDER_NAME;
        return <select value={value} data-select-id={id} onChange={(event) => { this.onUpdateSelection(event); }}>{studentOptions}</select>;
    }

    renderSubmitButton() {
        let selections = this.state.preferences;

        for (let i = 0; i < FRIEND_CHOICES; i++) {
            if (!selections[i] || selections[i] === PLACEHOLDER_NAME) {
                return undefined;
            }
        }

        if (_.uniq(selections).length !== selections.length) {
            return undefined;
        }

        return <button type="button" onClick={() => { this.onClickSubmit() }}>Submit</button>
    }

    onClickSignIn() {
        let provider = new firebase.auth.GoogleAuthProvider();

        provider.setCustomParameters({
            'hd': 'chadwickschool.org',
        });

        firebase.auth().signInWithPopup(provider).then((result) => {
            let email = result.user.email;
            return this.fetchDetails(email);
        });
    }

    onClickSubmit() {
        let db = firebase.firestore();
        let username = this.getUsername(firebase.auth().currentUser.email);

        return db.collection('preferences').doc(this.state.userDetails.grade).set({
            [username]: this.state.preferences,
        }, { merge: true }).then(() => {
            this.setState({
                hasSaved: true,
            });
        });
    }

    onClickChange() {
        this.setState({
            hasSaved: false,
        });
    }

    onUpdateSelection(event) {
        let newPreferences = this.state.preferences.slice();
        newPreferences[parseInt(event.target.dataset.selectId)] = event.target.value;

        this.setState({
            preferences: newPreferences,
        });
    }

    fetchDetails(email) {
        let username = this.getUsername(email);
        let userDetails;
        let gradeDetails;

        return this.getUserDetails(username).then((user) => {
            userDetails = user;
            return this.getGradeDetails(user.grade);
        }).then((grade) => {
            gradeDetails = grade;
            console.log(gradeDetails);
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

    getGradeDetails(grade) {
        let db = firebase.firestore();

        return db.collection("grades").doc(grade).get().then((snapshot) => {
            return snapshot.data();
        });
    };

    getUserDetails(username) {
        let db = firebase.firestore();

        return db.collection("user-records").doc(username).get().then((snapshot) => {
            if (snapshot.data() === undefined) {
                throw new Error('You are not a current student.');
            }

            return snapshot.data();
        });
    };

    getPreferencesDetails(grade, username) {
        let db = firebase.firestore();

        return db.collection("preferences").doc(grade).get().then((snapshot) => {
            if (!snapshot.data()) {
                return [];
            }

            return snapshot.data()[username] || [];
        });
    };

    getUsername(email) {
        return email.substring(0, email.indexOf("@"));
    }
}

ReactDOM.render(<IndexPage />, document.getElementById('root'));
