// firebase-config.js — Shared Firebase Configuration & Utilities for FarmUP
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDzA2m9g4msyGqegq3ENZmpB0NtgRCpflg",
  authDomain: "farmup-56466.firebaseapp.com",
  projectId: "farmup-56466",
  storageBucket: "farmup-56466.firebasestorage.app",
  messagingSenderId: "205866110998",
  appId: "1:205866110998:web:15e1c143536bb62899e537",
  measurementId: "G-72TT51KRE9"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ——— Auth Helpers ———
async function registerUser(email, password, name, role) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  const userData = {
    uid: user.uid,
    name: name,
    email: email,
    role: role,
    avatar: '',
    photoURL: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(db, 'users', user.uid), userData);
  return { uid: user.uid, ...userData };
}

async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (userDoc.exists()) {
    return { uid: user.uid, ...userDoc.data() };
  }
  return { uid: user.uid, email: user.email, name: user.email, role: 'consumer', avatar: '' };
}

async function logoutUser() {
  await signOut(auth);
  localStorage.removeItem('farmup_user');
  localStorage.removeItem('farmup_token');
  localStorage.removeItem('farmup_orders');
}

function getCurrentUser() {
  return auth.currentUser;
}

function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

async function getUserProfile(uid) {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (userDoc.exists()) return userDoc.data();
  return null;
}

async function updateUserProfile(uid, data) {
  data.updatedAt = serverTimestamp();
  await updateDoc(doc(db, 'users', uid), data);
}

// ——— Orders Helpers ———
async function saveOrder(uid, orderData) {
  orderData.uid = uid;
  orderData.createdAt = serverTimestamp();
  orderData.status = orderData.status || 'growing';
  const ref = await addDoc(collection(db, 'orders'), orderData);
  return ref.id;
}

async function getUserOrders(uid) {
  const q = query(collection(db, 'orders'), where('uid', '==', uid), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ——— Farm Lots Helpers ———
async function saveFarmLot(uid, lotData) {
  lotData.farmerUid = uid;
  lotData.createdAt = serverTimestamp();
  lotData.status = lotData.status || 'active';
  const ref = await addDoc(collection(db, 'farmLots'), lotData);
  return ref.id;
}

async function getFarmerLots(uid) {
  const q = query(collection(db, 'farmLots'), where('farmerUid', '==', uid), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function updateFarmLot(lotId, data) {
  data.updatedAt = serverTimestamp();
  await updateDoc(doc(db, 'farmLots', lotId), data);
}

async function deleteFarmLot(lotId) {
  await deleteDoc(doc(db, 'farmLots', lotId));
}

// ——— Community Messages ———
async function postCommunityMessage(uid, name, message, room) {
  const data = {
    uid, name, message, room: room || 'general',
    createdAt: serverTimestamp()
  };
  const ref = await addDoc(collection(db, 'communityMessages'), data);
  return ref.id;
}

async function getCommunityMessages(room, limitCount) {
  const q = query(
    collection(db, 'communityMessages'),
    where('room', '==', room || 'general'),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).slice(0, limitCount || 50);
}

// Export everything
export {
  app, analytics, auth, db,
  registerUser, loginUser, logoutUser,
  getCurrentUser, onAuthChange,
  getUserProfile, updateUserProfile,
  saveOrder, getUserOrders,
  saveFarmLot, getFarmerLots, updateFarmLot, deleteFarmLot,
  postCommunityMessage, getCommunityMessages,
  doc, setDoc, getDoc, updateDoc, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, onSnapshot,
  storage, ref, uploadString, getDownloadURL
};
