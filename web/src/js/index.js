const FRIEND_CHOICES = 3;
const PLACEHOLDER_NAME = 'Select';

class IndexPage extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            currentUserDetails: undefined,
            currentGradeDetails: undefined,
            chooseState: 0,
            signinError: '',
            studentSelection0: PLACEHOLDER_NAME,
            studentSelection1: PLACEHOLDER_NAME,
            studentSelection2: PLACEHOLDER_NAME,
        };
    }

    render() {
        return (
            <div>
                <h1>Outie</h1>
                <h2>Chadwick's OE Matchmaker</h2>
                {this.renderMainView()}
            </div>
        );
    }

    componentDidMount() {
        if (!firebase.auth().currentUser) {
            this.setState({ chooseState: 0 });
        } else {
            this.fetchDetails(firebase.auth().currentUser.email);
        }
    }

    renderMainView() {
        if (this.state.chooseState === 0) {
            return (
                <div>
                    <button type="button" className="btn btn-outline-primary btn-lg" onClick={() => { this.onClickSignIn() }}>Sign In</button>
                    {this.state.signinError ? <p id="error-display">An unexpected error occurred: {this.state.signinError}</p> : ''}
                </div>
            );
        }

        if (this.state.chooseState === 1) {
            return (
                <div>
                    <p>{ 'There are no upcoming trips. '}</p>
                    <h3>Pick your friends!</h3>
                    <p>Note, the order of your selections does not matter.</p>
                    <label>First Choice</label>
                    {this.renderFriendOptions(0)}
                    <label>Second Choice</label>
                    {this.renderFriendOptions(1)}
                    <label>Third Choice</label>
                    {this.renderFriendOptions(2)}
                    {this.renderSubmitButton()}
                </div>
            )
        }
    }

    renderFriendOptions(id) {
        let studentOptions = _.map(this.state.currentGradeDetails.students, (student, key) => {
            return <option value={key}>{student}</option>;
        });

        studentOptions.unshift(<option disabled>{PLACEHOLDER_NAME}</option>);

        let name = 'studentSelection' + id;
        return <select value={this.state[name]} name={name} onChange={(event) => { this.onUpdateSelection(event); }}>{studentOptions}</select>;
    }

    renderSubmitButton() {
        let selections = this.getSelectionArray();

        for (let i = 0; i < selections.length; i++) {
            if (!selections[i] || selections[i] === PLACEHOLDER_NAME) {
                return undefined;
            }
        }

        if (_.uniq(selections).length !== selections.length) {
            return undefined;
        }

        return <button type="button" className="btn btn-outline-primary btn-lg" onClick={() => { this.onClickSubmit() }}>Submit</button>
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

        return db.collection('preferences').doc(this.state.currentUserDetails.grade).set({
            [username]: this.getSelectionArray(),
        }, { merge: true });
    }

    onUpdateSelection(event) {
        this.setState({
            [event.target.name]: event.target.value,
        });
    }

    fetchDetails(email) {
        let username = this.getUsername(email);
        let currentUser;

        return this.getUserDetails(username).then((user) => {
            currentUser = user;
            return this.getGradeDetails(user.grade);
        }).then((grade) => {
            this.setState({
                currentGradeDetails: grade,
                currentUserDetails: currentUser,
                chooseState: currentUser.preferences ? 2 : 1,
            });
        }).catch((error) => {
            this.setState({
                signinError: error.message,
                chooseState: 0,
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
            return snapshot.data();
        });
    };

    getUsername(email) {
        return email.substring(0, email.indexOf("@"));
    }

    getSelectionArray() {
        return [
            this.state.studentSelection0,
            this.state.studentSelection1,
            this.state.studentSelection2,
        ];
    }
}

ReactDOM.render(<IndexPage />, document.getElementById('root'));
