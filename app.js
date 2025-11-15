// ======== CONFIG FIREBASE ========
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

// ======== UTILITY ========
function generateChillNumber() {
  let num = Math.floor(Math.random() * 900000000) + 100000000;
  return "+67 " + String(num).replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
}

// ======== APP ========
function App() {
  const [user, setUser] = React.useState(null);
  const [contacts, setContacts] = React.useState([]);
  const [activeContact, setActiveContact] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [tab, setTab] = React.useState("chat"); // chat / add / profile
  const [welcomeVisible, setWelcomeVisible] = React.useState(true);

  // ======== LOGIN / REG ========
  React.useEffect(() => {
    auth.onAuthStateChanged(async (u) => {
      if (u) {
        const userRef = db.ref("users/" + u.uid);
        const snapshot = await userRef.get();
        if (!snapshot.exists()) {
          const chillNumber = generateChillNumber();
          userRef.set({ email: u.email, username: "", chillNumber });
        }
        setUser(u);
      } else {
        setUser(null);
      }
    });
  }, []);

  function handleRegister() {
    const email = document.getElementById("email").value;
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    auth.createUserWithEmailAndPassword(email, password)
      .then((cred) => {
        const chillNumber = generateChillNumber();
        db.ref("users/" + cred.user.uid).set({ email, username, chillNumber });
      })
      .catch((err) => alert(err.message));
  }

  function handleLogin() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    auth.signInWithEmailAndPassword(email, password)
      .catch((err) => alert(err.message));
  }

  function handleLogout() {
    auth.signOut();
  }

  // ======== CARICA CONTATTI ========
  React.useEffect(() => {
    if (!user) return;
    const contactsRef = db.ref("contacts/" + user.uid);
    contactsRef.on("value", (snap) => {
      const data = snap.val() || {};
      setContacts(Object.values(data));
      if (Object.keys(data).length > 0) setWelcomeVisible(false);
    });
    return () => contactsRef.off();
  }, [user]);

  // ======== CARICA MESSAGGI ========
  React.useEffect(() => {
    if (!user || !activeContact) return;
    const chatId = [user.uid, activeContact.uid].sort().join("_");
    const messagesRef = db.ref("messages/" + chatId);
    messagesRef.on("value", (snap) => {
      const data = snap.val() || {};
      setMessages(Object.values(data));
    });
    return () => db.ref("messages/" + chatId).off();
  }, [user, activeContact]);

  function sendMessage() {
    const input = document.getElementById("messageInput");
    if (!input.value || !activeContact) return;
    const chatId = [user.uid, activeContact.uid].sort().join("_");
    const msgRef = db.ref("messages/" + chatId).push();
    msgRef.set({ from: user.uid, to: activeContact.uid, text: input.value, timestamp: Date.now() });
    input.value = "";
  }

  function addContact() {
    const num = document.getElementById("addNumber").value;
    db.ref("users").orderByChild("chillNumber").equalTo(num).once("value").then(snap => {
      if (!snap.exists()) { alert("Utente non trovato"); return; }
      const friendData = Object.values(snap.val())[0];
      const friendUid = Object.keys(snap.val())[0];
      db.ref("contacts/" + user.uid + "/" + friendUid).set(friendData);
      setTab("chat");
    });
  }

  if (!user) {
    return React.createElement("div", { style:{padding:"20px"}},
      React.createElement("h2", null, "Login / Registrati"),
      React.createElement("input", { id:"email", placeholder:"Email", type:"email" }),
      React.createElement("input", { id:"username", placeholder:"Username" }),
      React.createElement("input", { id:"password", placeholder:"Password", type:"password" }),
      React.createElement("button", { onClick:handleRegister }, "Registrati"),
      React.createElement("button", { onClick:handleLogin, style:{marginTop:"5px"} }, "Accedi")
    );
  }

  return React.createElement("div", { style:{display:"flex", flex:1, height:"100%"}},
    // ===== SIDEBAR =====
    React.createElement("div", { className:"sidebar" },
      React.createElement("button", { onClick:()=>setTab("chat") }, "Chat"),
      React.createElement("button", { onClick:()=>setTab("add") }, "Aggiungi"),
      React.createElement("button", { onClick:()=>setTab("profile") }, "Profilo")
    ),
    // ===== CONTENT =====
    React.createElement("div", { className:"content" },
      // ===== CHAT =====
      tab === "chat" && React.createElement("div", { className:"chat-container" },
        React.createElement("div", { className:"contacts-list" },
          contacts.map((c, idx) =>
            React.createElement("div", { key:idx, className: activeContact && activeContact.uid===c.uid ? "active": "", onClick:()=>setActiveContact(c) }, c.username + " (" + c.chillNumber + ")")
          )
        ),
        React.createElement("div", { className:"chat-box" },
          welcomeVisible && React.createElement("div", { className:"welcome" }, "Benvenuto su Chill Chat! Aggiungi i tuoi amici e chilla con loro."),
          React.createElement("div", { className:"messages" },
            messages.map((m, idx)=>
              React.createElement("div", { key:idx, className:m.from===user.uid?"sent":"received" }, m.text)
            )
          ),
          activeContact && React.createElement("div", { className:"message-input" },
            React.createElement("input", { id:"messageInput", placeholder:"Scrivi un messaggio" }),
            React.createElement("button", { onClick:sendMessage }, "Invia")
          )
        )
      ),
      // ===== ADD CONTACT =====
      tab === "add" && React.createElement("div", { className:"add-contact-section" },
        React.createElement("h3", null, "Aggiungi il divertimento!"),
        React.createElement("input", { id:"addNumber", placeholder:"Chill Number dell'amico (+67 XXX XXX XXX)" }),
        React.createElement("button", { onClick:addContact }, "Aggiungi")
      ),
      // ===== PROFILE =====
      tab === "profile" && React.createElement("div", { className:"profile-section" },
        React.createElement("h3", null, "Profilo"),
        React.createElement("p", null, "Chill #: " + (user.uid ? contacts.find(c=>c.uid===user.uid)?.chillNumber || "???":"???")),
        React.createElement("p", null, "Username: " + (user.uid ? contacts.find(c=>c.uid===user.uid)?.username || "???":"???")),
        React.createElement("button", { onClick:handleLogout }, "Logout")
      )
    )
  );
}

// ======== MOUNT APP ========
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
