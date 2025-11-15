const e = React.createElement;

// Config Firebase (usa il tuo)
const firebaseConfig = {
  apiKey: "AIzaSyA25PyertpC4XpRQj9vY84yTYf_uaep0m4",
  authDomain: "chill-chat-c2102.firebaseapp.com",
  projectId: "chill-chat-c2102",
  storageBucket: "chill-chat-c2102.appspot.com",
  messagingSenderId: "422354667072",
  appId: "1:422354667072:web:d2fab09ccdb0cbc61001a5"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// App minimale per test
function App() {
  const [user, setUser] = React.useState(null);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  React.useEffect(() => {
    auth.onAuthStateChanged(u => setUser(u));
  }, []);

  if (!user) {
    return e("div", null,
      e("h1", null, "Chill Chat"),
      e("input", { placeholder: "Email", value: email, onChange: e => setEmail(e.target.value) }),
      e("input", { placeholder: "Password", type: "password", value: password, onChange: e => setPassword(e.target.value) }),
      e("button", { onClick: async () => {
        try { await auth.signInWithEmailAndPassword(email, password); }
        catch { await auth.createUserWithEmailAndPassword(email, password); }
      }}, "Login / Signup")
    );
  }

  return e("div", null,
    e("h2", null, `Benvenuto! Chill #: TBD`),
    e("button", { onClick: () => auth.signOut() }, "Logout")
  );
}

// Mount React
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(e(App));
