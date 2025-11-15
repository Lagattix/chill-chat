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
  const [showWelcome, setShowWelcome] = React.useState(true);
  const [loginMode, setLoginMode] = React.useState(true); 
  const [username, setUsername] = React.useState('');
  const [activeTab, setActiveTab] = React.useState('chat'); // 'chat', 'add', 'profile'
  const [contacts, setContacts] = React.useState([]);

  React.useEffect(() => {
    auth.onAuthStateChanged(u => {
      setUser(u);
      if(u){
        db.collection('users').doc(u.uid).get().then(doc=>{
          if(doc.exists){
            const data = doc.data();
            setChillNumber(data.chillNumber);
            setUsername(data.username || u.email.split('@')[0]);
            setShowWelcome(!data.hasAddedContact);
          } else {
            const num = '+67 ' + Math.floor(100000000 + Math.random()*900000000)
                        .toString()
                        .replace(/(\d{3})(\d{3})(\d{3})/,'$1 $2 $3');
            setChillNumber(num);
            db.collection('users').doc(u.uid).set({
              email: u.email,
              username: username || u.email.split('@')[0],
              chillNumber: num,
              hasAddedContact: false
            });
          }
        });
      }
    });
  }, []);

  const handleAuth = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const uname = document.getElementById('username')?.value || '';
    if(!email || !password || (!loginMode && !uname)){
      alert('Compila tutti i campi');
      return;
    }
    try{
      if(loginMode){
        await auth.signInWithEmailAndPassword(email,password);
      } else {
        await auth.createUserWithEmailAndPassword(email,password);
        setUsername(uname);
      }
    }catch(err){
      alert('Errore: '+err.message);
    }
  }

  const addContact = (chill) => {
    if(!chill) return alert('Inserisci un Chill Number');
    setContacts([...contacts, chill]);
    setShowWelcome(false);
    db.collection('users').doc(user.uid).update({ hasAddedContact: true });
    document.getElementById('addChill').value = '';
    setActiveTab('chat');
  }

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

  return React.createElement('div',{style:{display:'flex', flexDirection:'column', height:'100%'}},
    React.createElement('div',{className:'tabs'},
      React.createElement('button',{className: activeTab==='chat'?'active':'', onClick:()=>setActiveTab('chat')}, 'Chat'),
      React.createElement('button',{className: activeTab==='add'?'active':'', onClick:()=>setActiveTab('add')}, 'Aggiungi'),
      React.createElement('button',{className: activeTab==='profile'?'active':'', onClick:()=>setActiveTab('profile')}, 'Profilo')
    ),
    React.createElement('div',{className:'tab-content', style:{flex:1}},
      // ----- Chat Tab -----
      activeTab==='chat' && React.createElement('div',{style:{flex:1, display:'flex', flexDirection:'column'}},
        showWelcome && React.createElement('div',{className:'welcome'}, 'Benvenuto su Chill Chat! Aggiungi i tuoi amici e "chilla" con loro.'),
        contacts.length > 0 ? contacts.map(c=>React.createElement('div',{key:c, style:{padding:'5px', borderBottom:'1px solid #ccc'}}, c))
                             : React.createElement('div', {style:{textAlign:'center', marginTop:'20px'}}, 'Non hai ancora contatti.')
      ),
      // ----- Aggiungi Tab -----
      activeTab==='add' && React.createElement('div',{
        style:{
          flex:1,
          display:'flex',
          flexDirection:'column',
          justifyContent:'center',
          alignItems:'center',
          animation:'fadein 0.5s'
        }},
        React.createElement('h2', {style:{marginBottom:'20px', color:'#075E54'}}, 'Aggiungi il divertimento!'),
        React.createElement('input',{
          type:'text',
          placeholder:'Inserisci Chill Number',
          id:'addChill',
          style:{width:'60%', textAlign:'center', marginBottom:'15px'}
        }),
        React.createElement('button',{
          onClick:()=>addContact(document.getElementById('addChill').value),
          style:{width:'30%'}
        },'Aggiungi')
      ),
      // ----- Profilo Tab -----
      activeTab==='profile' && React.createElement('div',{
        style:{
          flex:1,
          display:'flex',
          flexDirection:'column',
          justifyContent:'center',
          alignItems:'center'
        }},
        React.createElement('h3', null, 'Profilo'),
        React.createElement('p', null, 'Chill #: '+chillNumber),
        React.createElement('p', null, 'Username: '+username),
        React.createElement('button',{className:'logout-btn', style:{marginTop:'10px'}, onClick:()=>auth.signOut()}, 'Logout')
      )
    )
  );
}

// ====== Mount React ======
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));

