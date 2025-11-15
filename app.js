// ======== Config Firebase ========
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

// ======== React App ========
const e = React.createElement;

function App() {
  const [user, setUser] = React.useState(null);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [chillNumber, setChillNumber] = React.useState(null);
  const [message, setMessage] = React.useState("");
  const [messages, setMessages] = React.useState([]);

  // Aggiorna lo stato utente
  React.useEffect(() => {
    auth.onAuthStateChanged(async (u) => {
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
    const unsubscribe = db.collection("messages")
      .orderBy("timestamp")
      .onSnapshot(snapshot => {
        const msgs = snapshot.docs.map(d => d.data());
        setMessages(msgs);
      });

    return () => unsubscribe();
  }, []);

  // Signup / Login
  const handleAuth = async () => {
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const uid = userCredential.user.uid;
      const docSnap = await db.collection("users").doc(uid).get();
      setChillNumber(docSnap.data().chillNumber);
    } catch (err) {
      // Se login fallisce, crea utente
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const uid = userCredential.user.uid;

      // Genera Chill Number unico
      const counterRef = db.collection("counters").doc("chillNumber");
      const counterSnap = await counterRef.get();
      let nextNumber = 6700000000;
      if(counterSnap.exists){
        nextNumber = counterSnap.data().lastNumber + 1;
      }

      await db.collection("users").doc(uid).set({ chillNumber: nextNumber, email });
      await counterRef.set({ lastNumber: nextNumber });

      setChillNumber(nextNumber);
    }
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

  // ---------- RENDER ----------
  if(!user){
    return e("div", null,
      e("h1", null, "Chill Chat"),
      e("input", {placeholder:"Email", value:email, onChange:e=>setEmail(e.target.value)}),
      e("input", {placeholder:"Password", type:"password", value:password, onChange:e=>setPassword(e.target.value)}),
      e("button",{onClick:handleAuth},"Login / Signup")
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

// ======== MOUNT REACT ========
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(e(App));


