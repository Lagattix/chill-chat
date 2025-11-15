// Configurazione Firebase
const firebaseConfig = {
  apiKey: "LA_TUA_API_KEY",
  authDomain: "chill-chat-c2102.firebaseapp.com",
  projectId: "chill-chat-c2102",
  storageBucket: "chill-chat-c2102.appspot.com",
  messagingSenderId: "422354667072",
  appId: "1:422354667072:web:d2fab09ccdb0cbc61001a5"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const e = React.createElement;

function App() {
  const [user, setUser] = React.useState(null);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [chillNumber, setChillNumber] = React.useState(null);
  const [message, setMessage] = React.useState("");
  const [messages, setMessages] = React.useState([]);

  // Aggiorna lo stato dell'utente
  React.useEffect(() => {
    auth.onAuthStateChanged(async u => {
      if(u){
        setUser(u);
        // Prendi chill number
        const docRef = db.collection("users").doc(u.uid);
        const docSnap = await docRef.get();
        if(docSnap.exists){
          setChillNumber(docSnap.data().chillNumber);
        }
      } else {
        setUser(null);
        setChillNumber(null);
      }
    });

    // Ascolta messaggi in tempo reale
    const unsubscribe = db.collection("messages").orderBy("timestamp")
      .onSnapshot(snapshot => {
        const msgs = snapshot.docs.map(d => d.data());
        setMessages(msgs);
      });

    return () => unsubscribe();
  }, []);

  // Signup
  const signup = async () => {
    const userCredential = await auth.createUserWithEmailAndPassword(email,password);
    const uid = userCredential.user.uid;

    // Genera Chill Number
    const counterRef = db.collection("counters").doc("chillNumber");
    const counterSnap = await counterRef.get();
    let nextNumber = 6700000000;
    if(counterSnap.exists){
      nextNumber = counterSnap.data().lastNumber + 1;
    }

    await db.collection("users").doc(uid).set({ chillNumber: nextNumber, email });
    await counterRef.set({ lastNumber: nextNumber });

    setChillNumber(nextNumber);
  };

  // Login
  const login = async () => {
    const userCredential = await auth.signInWithEmailAndPassword(email,password);
    const uid = userCredential.user.uid;
    const docSnap = await db.collection("users").doc(uid).get();
    setChillNumber(docSnap.data().chillNumber);
  };

  // Logout
  const logout = () => auth.signOut();

  // Invia messaggio
  const sendMessage = async () => {
    if(message.trim()==="") return;
    await db.collection("messages").add({
      text: message,
      sender: chillNumber,
      timestamp: Date.now()
    });
    setMessage("");
  };

  if(!user){
    return e("div", null,
      e("h1", null, "Chill Chat Signup/Login"),
      e("input", {placeholder:"Email", value:email, onChange:e=>setEmail(e.target.value)}),
      e("input", {placeholder:"Password", type:"password", value:password, onChange:e=>setPassword(e.target.value)}),
      e("div", null,
        e("button",{onClick:signup},"Signup"),
        e("button",{onClick:login},"Login")
      )
    );
  }

  return e("div", null,
    e("h2", null, `Benvenuto! Il tuo Chill Number: ${chillNumber}`),
    e("button",{onClick:logout},"Logout"),
    e("h3", null, "Chat"),
    e("div",{className:"chat-box"},
      messages.map((m,i) => e("div",{key:i}, `[${m.sender}]: ${m.text}`))
    ),
    e("input",{placeholder:"Scrivi un messaggio", value:message, onChange:e=>setMessage(e.target.value)}),
    e("button",{onClick:sendMessage},"Invia")
  );
}

ReactDOM.render(e(App), document.getElementById("root"));
