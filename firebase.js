// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js";

// Config completa del tuo progetto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD-yF6Zvohnm2BcesiISP3csoTDXnfE3tY",
  authDomain: "chill-chat-d558b.firebaseapp.com",
  databaseURL: "https://chill-chat-d558b-default-rtdb.firebaseio.com", // <-- fondamentale
  projectId: "chill-chat-d558b",
  storageBucket: "chill-chat-d558b.appspot.com",
  messagingSenderId: "297427107896",
  appId: "1:297427107896:web:8795a135d68002446866cd"
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);

// Esporta il database per usarlo in app.js
export const db = getDatabase(app);
