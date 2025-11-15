// ====== Config Firebase ======
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

// ====== React App ======
function App() {
  const [user, setUser] = React.useState(null);
  const [chillNumber, setChillNumber] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState('chat'); // chat / add
  const [contacts, setContacts] = React.useState([]);
  const [selectedContact, setSelectedContact] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [newMessage, setNewMessage] = React.useState('');
  const [showWelcome, setShowWelcome] = React.useState(true);
  const [loginMode, setLoginMode] = React.useState(true); // true=accedi, false=registrati
  const [username, setUsername] = React.useState('');

  // Controllo auth state
  React.useEffect(() => {
    auth.onAuthStateChanged(u => {
      setUser(u);
      if(u && !chillNumber){
        // Genera Chill Number casuale
        const num = '+67 ' + Math.floor(100000000 + Math.random()*900000000)
                    .toString()
                    .replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
        setChillNumber(num);

        // Salva utente su Firestore se nuovo
        db.collection('users').doc(u.uid).get().then(doc=>{
          if(!doc.exists){
            db.collection('users').doc(u.uid).set({
              email: u.email,
              username: username || u.email.split('@')[0],
              chillNumber: num
            });
          } else {
            const data = doc.data();
            setUsername(data.username || u.email.split('@')[0]);
          }
        });
      }
    });
  }, []);

  // Aggiorna messaggi real-time
  React.useEffect(()=>{
    if(selectedContact && user){
      const unsub = db.collection('messages')
        .doc(user.uid)
        .collection(selectedContact.uid)
        .orderBy('timestamp')
        .onSnapshot(snapshot=>{
          const msgs = snapshot.docs.map(doc=>doc.data());
          setMessages(msgs);
        });
      return ()=>unsub();
    }
  }, [selectedContact, user]);

  // Login / Registrazione
  const handleAuth = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const uname = document.getElementById('username')?.value || '';
    if(!email || !password || (!loginMode && !uname)){
      alert('Compila tutti i campi');
      return;
    }
    try{
      if(loginMode){ // Accedi
        await auth.signInWithEmailAndPassword(email,password);
      } else { // Registrati
        const userCred = await auth.createUserWithEmailAndPassword(email,password);
        setUsername(uname);
      }
    }catch(err){
      alert('Errore: '+err.message);
    }
  }

  // Aggiungi contatto
  const addContact = async (chill) => {
    if(!chill) return;
    try{
      const q = await db.collection('users').where('chillNumber','==',chill).get();
      if(!q.empty){
        const u = q.docs[0].data();
        u.uid = q.docs[0].id;
        setContacts([...contacts,u]);
        setActiveTab('chat');
        setSelectedContact(u);
        setShowWelcome(false);
      } else alert('Utente non trovato');
    } catch(err){ console.error(err); }
  }

  // Invia messaggio
  const sendMessage = async () => {
    if(!newMessage || !selectedContact) return;
    const msgObj = {
      text: newMessage,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      from: user.uid
    };
    await db.collection('messages').doc(user.uid)
      .collection(selectedContact.uid).add(msgObj);
    await db.collection('messages').doc(selectedContact.uid)
      .collection(user.uid).add(msgObj);
    setNewMessage('');
  }

  // Se non loggato
  if(!user){
    return React.createElement('div',{style:{padding:'20px'}},
      React.createElement('h1', null, loginMode?'Accedi':'Registrati'),
      !loginMode && React.createElement('input',{id:'username', placeholder:'Username'}),
      React.createElement('input',{id:'email', type:'email', placeholder:'Email'}),
      React.createElement('input',{id:'password', type:'password', placeholder:'Password'}),
      React.createElement('button',{onClick:handleAuth}, loginMode?'Accedi':'Registrati'),
      React.createElement('p', {style:{cursor:'pointer', color:'#007bff'}, onClick:()=>setLoginMode(!loginMode)},
        loginMode?'Non hai un account? Registrati':'Hai già un account? Accedi'
      )
    );
  }

  return React.createElement('div',{id:'app', style:{height:'100%', display:'flex', flexDirection:'column'}},
    // Tabs
    React.createElement('div',{className:'tabs'},
      React.createElement('button',{className:activeTab==='chat'?'active':'', onClick:()=>setActiveTab('chat')},'Chat'),
      React.createElement('button',{className:activeTab==='add'?'active':'', onClick:()=>setActiveTab('add')},'Aggiungi')
    ),
    // Contenuto tab
    React.createElement('div',{className:'tab-content'},
      // Chat Tab
      activeTab==='chat' && (
        React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100%'}},
          showWelcome && !contacts.length && React.createElement('div',{className:'welcome'}, 
            'Benvenuto su Chill Chat! Aggiungi i tuoi amici e "chilla" con loro.'
          ),
          React.createElement('div',{className:'chat-box'},
            messages.map((m,i)=>React.createElement('div',{key:i,className:'message '+(m.from===user.uid?'sent':'received')}, m.text))
          ),
          selectedContact && React.createElement('div',null,
            React.createElement('input',{type:'text', value:newMessage, onChange:e=>setNewMessage(e.target.value), placeholder:'Scrivi un messaggio'}),
            React.createElement('button',{onClick:sendMessage},'Invia')
          )
        )
      ),
      // Add Contact Tab
      activeTab==='add' && (
        React.createElement('div',null,
          React.createElement('input',{type:'text', placeholder:'Inserisci Chill Number', id:'addChill'}),
          React.createElement('button',{onClick:()=>addContact(document.getElementById('addChill').value)},'Aggiungi')
        )
      )
    ),
    React.createElement('div', {style:{textAlign:'center', marginTop:'auto'}},
      React.createElement('div', null, 'Benvenuto! Chill #: '+chillNumber+' ('+username+')'),
      React.createElement('button',{className:'logout-btn', onClick:()=>auth.signOut()}, 'Logout')
    )
  );
}

// ====== Mount React ======
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
