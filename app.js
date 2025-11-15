// ======== Config Firebase ========
const firebaseConfig = {
  apiKey: "AIzaSyA25PyertpC4XpRQj9vY84yTYf_uaep0m4",
  authDomain: "chill-chat-c2102.firebaseapp.com",
  databaseURL: "https://chill-chat-c2102-default-rtdb.firebaseio.com",
  projectId: "chill-chat-c2102",
  storageBucket: "chill-chat-c2102.appspot.com",
  messagingSenderId: "422354667072",
  appId: "1:422354667072:web:d2fab09ccdb0cbc61001a5"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// ======== React App ========

function App() {
  const [user, setUser] = React.useState(null);
  const [loginMode, setLoginMode] = React.useState(true); // true=accedi, false=registrati
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [chillNumber, setChillNumber] = React.useState(null);

  const [activeTab, setActiveTab] = React.useState("chat"); // chat, aggiungi, profilo
  const [contacts, setContacts] = React.useState([]);
  const [activeContact, setActiveContact] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [messageText, setMessageText] = React.useState("");

  // ======== Auth State Listener ========
  React.useEffect(() => {
    auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);
        // Carica dati utente dal Realtime Database
        const snapshot = await db.ref("users/" + u.uid).once("value");
        const data = snapshot.val();
        setUsername(data.username);
        setChillNumber(data.chillNumber);
        // Carica contatti
        const contactsSnap = await db.ref("contacts/" + u.uid).once("value");
        setContacts(contactsSnap.val() ? Object.values(contactsSnap.val()) : []);
      } else {
        setUser(null);
      }
    });
  }, []);

  // ======== Registrazione ========
  const handleRegister = async () => {
    if (!email || !password || !username) return alert("Completa tutti i campi");
    try {
      const u = await auth.createUserWithEmailAndPassword(email, password);
      // Genera Chill Number casuale
      const chill = "+67 " + Math.floor(100000000 + Math.random() * 900000000);
      setChillNumber(chill);
      // Salva utente su Realtime Database
      await db.ref("users/" + u.user.uid).set({
        username,
        email,
        chillNumber: chill
      });
    } catch (err) {
      alert(err.message);
    }
  };

  // ======== Login ========
  const handleLogin = async () => {
    if (!email || !password) return alert("Inserisci email e password");
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      alert(err.message);
    }
  };

  // ======== Logout ========
  const handleLogout = async () => {
    await auth.signOut();
    setActiveContact(null);
    setContacts([]);
    setMessages([]);
  };

  // ======== Aggiungi Contatto ========
  const addContact = async (chillNum) => {
    if (!chillNum) return;
    // Cerca utente per chillNumber
    const snapshot = await db.ref("users").orderByChild("chillNumber").equalTo(chillNum).once("value");
    if (!snapshot.exists()) return alert("Utente non trovato!");
    const data = snapshot.val();
    const contactId = Object.keys(data)[0];
    const contactData = data[contactId];
    // Aggiungi nei contatti
    await db.ref("contacts/" + user.uid + "/" + contactId).set(contactData);
    setContacts(prev => [...prev, contactData]);
    alert("Contatto aggiunto!");
  };

  // ======== Chat real-time ========
  React.useEffect(() => {
    if (!activeContact) return;
    const chatId = [user.uid, activeContact.id].sort().join("_");
    const messagesRef = db.ref("messages/" + chatId);
    messagesRef.on("value", (snap) => {
      const data = snap.val() || {};
      const msgs = Object.values(data).sort((a,b) => a.timestamp - b.timestamp);
      setMessages(msgs);
    });
    return () => messagesRef.off();
  }, [activeContact]);

  const sendMessage = () => {
    if (!messageText || !activeContact) return;
    const chatId = [user.uid, activeContact.id].sort().join("_");
    db.ref("messages/" + chatId).push({
      from: user.uid,
      to: activeContact.id,
      text: messageText,
      timestamp: Date.now()
    });
    setMessageText("");
  };

  // ======== Render ========
  if (!user) {
    return React.createElement("div", { style:{padding:'20px', maxWidth:'400px', margin:'50px auto'} },
      React.createElement("h2", null, loginMode ? "Accedi" : "Registrati"),
      !loginMode && React.createElement("input", { placeholder:"Username", value:username, onChange:e=>setUsername(e.target.value) }),
      React.createElement("input", { placeholder:"Email", value:email, onChange:e=>setEmail(e.target.value) }),
      React.createElement("input", { type:"password", placeholder:"Password", value:password, onChange:e=>setPassword(e.target.value) }),
      React.createElement("button", { onClick: loginMode ? handleLogin : handleRegister }, loginMode ? "Accedi" : "Registrati"),
      React.createElement("button", { onClick: ()=>setLoginMode(!loginMode), style:{marginTop:'10px'} }, loginMode ? "Vai a Registrati" : "Vai a Accedi")
    );
  }

  // ======== Interfaccia principale ========
  return React.createElement("div", { style:{display:'flex', height:'90vh', maxWidth:'900px', margin:'20px auto', border:'1px solid #ccc', borderRadius:'10px', overflow:'hidden'} },
    // Sidebar Tab
    React.createElement("div", { style:{width:'200px', borderRight:'1px solid #ccc', display:'flex', flexDirection:'column'} },
      React.createElement("button", { onClick:()=>setActiveTab('chat') }, "Chat"),
      React.createElement("button", { onClick:()=>setActiveTab('aggiungi') }, "Aggiungi"),
      React.createElement("button", { onClick:()=>setActiveTab('profilo') }, "Profilo")
    ),
    // Contenuto
    React.createElement("div", { style:{flex:1, padding:'10px', display:'flex', flexDirection:'column'} },
      // Chat Tab
      activeTab === 'chat' && React.createElement("div", { style:{flex:1, display:'flex'} },
        // Lista contatti
        React.createElement("div", { style:{width:'150px', borderRight:'1px solid #ccc', overflowY:'auto'} },
          contacts.map((c,i) =>
            React.createElement("div", { key:i, style:{padding:'5px', cursor:'pointer'}, onClick:()=>setActiveContact(c) },
              c.username + " (" + c.chillNumber + ")"
            )
          )
        ),
        // Chat Box
        React.createElement("div", { style:{flex:1, display:'flex', flexDirection:'column', marginLeft:'10px'} },
          activeContact ? React.createElement("h3", null, "Chat con "+activeContact.username) : React.createElement("h3", null, "Seleziona un contatto"),
          React.createElement("div", { style:{flex:1, border:'1px solid #ddd', padding:'10px', overflowY:'auto', marginBottom:'10px'} },
            messages.map((m,i) => React.createElement("div", { key:i, style:{
              alignSelf: m.from===user.uid ? 'flex-end' : 'flex-start',
              background: m.from===user.uid ? '#dcf8c6':'#fff',
              padding:'5px 10px',
              borderRadius:'10px',
              marginBottom:'5px',
              maxWidth:'70%'
            }}, m.text))
          ),
          activeContact && React.createElement("div", { style:{display:'flex'} },
            React.createElement("input", { type:'text', value:messageText, onChange:e=>setMessageText(e.target.value), style:{flex:1, marginRight:'5px'} }),
            React.createElement("button", { onClick:sendMessage }, "Invia")
          )
        )
      ),
      // Aggiungi Tab
      activeTab === 'aggiungi' && React.createElement("div", null,
        React.createElement("h3", null, "Aggiungi un contatto"),
        React.createElement("input", { placeholder:"Chill Number", id:"addContactInput" }),
        React.createElement("button", { onClick:()=>addContact(document.getElementById("addContactInput").value) }, "Aggiungi")
      ),
      // Profilo Tab
      activeTab === 'profilo' && React.createElement("div", null,
        React.createElement("h3", null, "Profilo"),
        React.createElement("p", null, "Username: " + username),
        React.createElement("p", null, "Chill #: " + chillNumber),
        React.createElement("button", { onClick:handleLogout, style:{background:'#f44336', color:'white'} }, "Logout")
      )
    )
  );
}

// ======== MOUNT ========
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
