const e = React.createElement;

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

// ======== Helper ========
function formatChillNumber(num) {
  const s = num.toString().padStart(9,"0");
  return `+67 ${s.slice(1,4)} ${s.slice(4,7)} ${s.slice(7)}`;
}

function generateChatId(num1, num2){
  return num1 < num2 ? `${num1}-${num2}` : `${num2}-${num1}`;
}

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
  const [activeTab, setActiveTab] = React.useState("chat");
  const [loadingUser, setLoadingUser] = React.useState(true);

  // ----- Auth e Chill Number -----
  React.useEffect(() => {
    auth.onAuthStateChanged(async u => {
      if(u){
        setUser(u);
        let docRef = db.collection("users").doc(u.uid);
        let docSnap = await docRef.get();
        if(!docSnap.exists){
          const counterRef = db.collection("counters").doc("chillNumber");
          const counterSnap = await counterRef.get();
          let nextNumber = 6700000000;
          if(counterSnap.exists) nextNumber = counterSnap.data().lastNumber + 1;

          await docRef.set({ chillNumber: nextNumber, email: u.email, contacts: [] });
          await counterRef.set({ lastNumber: nextNumber });
          docSnap = await docRef.get();
        }
        setChillNumber(docSnap.data().chillNumber);
        setContacts(docSnap.data().contacts || []);
      } else {
        setUser(null); setChillNumber(null); setContacts([]);
      }
      setLoadingUser(false);
    });
  }, []);

  // ----- Chat real-time -----
  React.useEffect(()=>{
    if(!selectedChat || !chillNumber) return;
    const chatId = generateChatId(chillNumber, selectedChat);
    const unsubscribe = db.collection("messages")
      .where("chatId","==",chatId)
      .orderBy("timestamp")
      .onSnapshot(snap=>{
        const msgs = snap.docs.map(d=>d.data());
        setMessages(msgs);
        const chatBox = document.getElementById("chat-box");
        if(chatBox) chatBox.scrollTop = chatBox.scrollHeight;
      });
    return ()=>unsubscribe();
  },[selectedChat, chillNumber]);

  // ----- Funzioni -----
  const handleAuth = async ()=>{
    try{
      await auth.signInWithEmailAndPassword(email,password);
    }catch{
      await auth.createUserWithEmailAndPassword(email,password);
    }
  }

  const logout = ()=> auth.signOut();

  const sendMessage = async ()=>{
    if(!newMessage.trim() || !selectedChat || !chillNumber) return;
    const chatId = generateChatId(chillNumber, selectedChat);
    await db.collection("messages").add({
      chatId,
      sender: chillNumber,
      text: newMessage,
      timestamp: Date.now()
    });
    setNewMessage("");
  }

  const addContact = async ()=>{
    const chillNum = parseInt(addContactInput);
    if(!chillNum || chillNum===chillNumber || contacts.includes(chillNum)) return alert("Numero non valido o già in contatti");
    const usersSnap = await db.collection("users").where("chillNumber","==",chillNum).get();
    if(usersSnap.empty) return alert("Utente non trovato");
    const updatedContacts = [...contacts, chillNum];
    await db.collection("users").doc(user.uid).update({contacts:updatedContacts});
    setContacts(updatedContacts);
    setAddContactInput("");
    setActiveTab("chat"); // torna alla chat dopo aggiunta
  }

  // ----- Render -----
  if(loadingUser) return e("div", null,"Caricamento...");

  if(!user){
    return e("div", {style:{padding:"20px"}},
      e("h1", null,"Chill Chat"),
      e("input",{placeholder:"Email",value:email,onChange:e=>setEmail(e.target.value)}),
      e("input",{placeholder:"Password",type:"password",value:password,onChange:e=>setPassword(e.target.value)}),
      e("button",{onClick:handleAuth},"Login / Signup")
    );
  }

  return e("div",{style:{display:"flex",flexDirection:"column",height:"100%"}},
    // Contenuto schede
    e("div",{className:"tab-content", style:{flex:1, display:"flex", flexDirection:"column"}},
      activeTab==="chat" &&
        (contacts.length===0
          ? e("div",{style:{textAlign:"center",marginTop:"50%",color:"#666"}},
              e("h2", null,"Benvenuto su Chill Chat!"),
              e("p", null,'Aggiungi i tuoi amici e "chilla" con loro')
            )
          : e("div",{className:"chat-section", style:{display:"flex", flexDirection:"column", height:"100%"}},
              selectedChat ?
                e("div",{style:{display:"flex", flexDirection:"column", height:"100%"}},
                  e("div",{className:"chat-header"},`Chat con ${selectedChat}`),
                  e("div",{id:"chat-box",className:"chat-box"},
                    messages.map((m,i)=>e("div",{key:i,className:"message "+(m.sender===chillNumber?"sent":"received")},m.text))
                  ),
                  e("input",{
                    placeholder:"Scrivi un messaggio",
                    value:newMessage,
                    onChange:e=>setNewMessage(e.target.value),
                    onKeyDown:(e)=>{if(e.key==="Enter")sendMessage();}
                  }),
                  e("button",{onClick:sendMessage},"Invia")
                )
                : e("div",{style:{textAlign:"center",marginTop:"50%"}}, "Seleziona un contatto per chattare")
            )
        ),
      activeTab==="aggiungi" &&
        e("div",{style:{padding:"20px", display:"flex", flexDirection:"column"}},
          e("h2", null,"Aggiungi un amico"),
          e("input",{placeholder:"Chill Number", value:addContactInput,onChange:e=>setAddContactInput(e.target.value)}),
          e("button",{onClick:addContact},"Aggiungi")
        )
    ),

    // Tabs in basso
    e("div",{className:"tabs"},
      e("button",{onClick:()=>setActiveTab("chat"), className:activeTab==="chat"?"active":""},"Chat"),
      e("button",{onClick:()=>setActiveTab("aggiungi"), className:activeTab==="aggiungi"?"active":""},"Aggiungi")
    )
  );
}

// ======== Mount React ========
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(e(App));

