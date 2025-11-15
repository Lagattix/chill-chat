// ======== Config Firebase ========
const firebaseConfig = {
  apiKey: "AIzaSyA25PyertpC4XpRQj9vY84yTYf_uaep0m4",
  authDomain: "chill-chat-c2102.firebaseapp.com",
  projectId: "chill-chat-c2102",
  storageBucket: "chill-chat-c2102.firebasestorage.app",
  messagingSenderId: "422354667072",
  appId: "1:422354667072:web:d2fab09ccdb0cbc61001a5"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ======== React App ========

function App() {
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    auth.onAuthStateChanged(u => setUser(u));
  }, []);

  if (!user) {
    return (
      React.createElement("div", null,
        React.createElement("h1", null, "Chill Chat"),
        React.createElement("input", { id: "email", placeholder: "Email" }),
        React.createElement("input", { id: "password", type: "password", placeholder: "Password" }),
        React.createElement("button", {
          onClick: () => {
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            auth.signInWithEmailAndPassword(email, password)
              .catch(() => auth.createUserWithEmailAndPassword(email, password));
          }
        }, "Login / Signup")
      )
    );
  }

  return React.createElement("h1", null, "Benvenuto in Chill Chat!");
}

// ======== MOUNT REACT ========

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));

