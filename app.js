const e = React.createElement;

// ======== Firebase Config ========
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

// ======== App ========
function App() {
  const [user, setUser] = React.useState(null);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [chillNumber, setChillNumber] = React.useState(null);
  const [contacts, setContacts] = React.useState([]);
  const [selectedChat, setSelectedChat] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [newMessage, setNewMessage] = React.useState("");
  const [addContactInput, setAddContactInput] = React.useState("");
  const [loadingUser, setLoadingUser] = React.useState(true);

  // ----- Utente e contatti -----
  React.useEffect(() => {
    auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);
        const docSnap = await db.collection("users").doc(u.uid).get();
        if (docSnap.exists) {
          const data = docSnap.data();
          setChillNumber(data.chillNumber);
          setContacts(data.contacts || []);
        }
      } else {
        setUser(null);
        setChillNumber(null);
        setContacts([]);
      }
      setLoadingUser(false);
    });
  }, []);

  // ----- Chat real-time -----
  React.useEffect(() => {
    if (!selectedChat || !chillNumber) return;
    const chatId = generateChatId(chillNumber, selectedChat);
    const unsubscribe = db.collection("messages")
      .where("chatId", "==", chatId)
      .orderBy("timestamp")
      .onSnapshot(snapshot => {
        const msgs = snapshot.docs.map(d => d.data());
        setMessages(msgs);
        // Scroll automatico in basso
        const chatBox = document.getElementById("chat-box");
        if(chatBox) chatBox.scrollTop = chatBox.scrollHeight;
      });
    return () => unsubscribe();
  }, [selectedChat, chillNumber]);

  // ----- Funzioni -----
  const handleAuth = async () => {
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const uid = userCredential.user.uid;
      const docSnap = await db.collection("users").doc(uid).get();
      setChillNumber(docSnap.data().chillNumber);
      setContacts(docSnap.data().contacts || []);
    } catch (err) {
      // Se login fallisce, crea utente
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const uid = userCredential.user.uid;

      const counterRef = db.collection("counters").doc("chillNumber");
      const counterSnap = await counterRef.get();
      let nextNumber = 6700000000;
      if (counterSnap.exists) nextNumber = counterSnap.data().lastNumber + 1;

      await db.collection("users").doc(uid).set({
        chillNumber: nextNumber,
        email,
        contacts: []
      });
      await counterRef.set({ lastNumber: nextNumber });

      setChillNumber(nextNumber);
      setContacts([]);
    }
  };

  const logout = () => auth.signOut();

  const generateChatId = (num1, num2) => num1 < num2 ? `${num1}-${num2}` : `${num2}-${num1}`;

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !chillNumber) return;
    const chatId = generateChatId(chillNumber, selectedChat);
    await db.collection("messages").add({
      chatId,
      sender: chillNumber,
      text: newMessage,
      timestamp: Date.now()
    });
    setNewMessage("");
  };

  const addContact = async () => {
    const chillNum = parseInt(addContactInput);
    if (!chillNum || chillNum === chillNumber || contacts.includes(chillNum)) return alert("Numero non valido o già in contatti");

    const usersSnap = await db.collection("users").where("chillNumber", "==", chillNum).get();
    if (usersSnap.empty) return alert("Utente non trovato");

    const updatedContacts = [...contacts, chillNum];
    await db.collection("users").doc(user.uid).update({ contacts: updatedContacts });
    setContacts(updatedContacts);
    setAddContactInput("");
  };

  // ----- Render -----
  if (loadingUser) return e("div", null, "Caricamento...");

  if (!user) {
    return e("div", { style: { padding: "20px" } },
      e("h1", null, "Chill Chat"),
      e("input", { placeholder: "Email", value: email, onChange: e => setEmail(e.target.value) }),
      e("input", { placeholder: "Password", type: "password", value: password, onChange: e => setPassword(e.target.value) }),
      e("button", { onClick: handleAuth }, "Login / Signup")
    );
  }

  // Home stile WhatsApp
  return e("div", { style: { display: "flex", height: "100%" } },
    // Sidebar
    e("div", { className: "sidebar" },
      e("h3", null, `Benvenuto! Chill #: ${chillNumber}`),
      e("div", { className: "contacts" },
        contacts.map(c =>
          e("div", {
            key: c,
            className: selectedChat === c ? "active" : "",
            onClick: () => setSelectedChat(c)
          }, c)
        )
      ),
      e("div", { className: "add-contact-section" },
        e("input", {
          placeholder: "Aggiungi Chill Number",
          value: addContactInput,
          onChange: e => setAddContactInput(e.target.value)
        }),
        e("button", { onClick: addContact }, "Aggiungi")
      ),
      e("button", { onClick: logout, className: "logout-btn" }, "Logout")
    ),

    // Chat section
    e("div", { className: "chat-section" },
      selectedChat ?
        e("div", { style: { display: "flex", flexDirection: "column", height: "100%" } },
          e("div", { className: "chat-header" }, `Chat con ${selectedChat}`),
          e("div", { id: "chat-box", className: "chat-box" },
            messages.map((m, i) => e("div", { key: i, className: "message " + (m.sender === chillNumber ? "sent" : "received") }, m.text))
          ),
          e("input", {
            placeholder: "Scrivi un messaggio",
            value: newMessage,
            onChange: e => setNewMessage(e.target.value),
            onKeyDown: (e) => { if (e.key === "Enter") sendMessage(); }
          }),
          e("button", { onClick: sendMessage }, "Invia")
        )
        : e("div", { style: { textAlign: "center", marginTop: "50%" } }, "Seleziona un contatto per chattare")
    )
  );
}

// ======== Mount React ========
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(e(App));
