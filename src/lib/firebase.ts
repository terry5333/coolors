import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!
  };
}

export function getFirebaseApp() {
  if (_app) return _app;
  _app = getApps().length ? getApps()[0]! : initializeApp(getFirebaseConfig());
  return _app;
}

/** SSR/build 階段不要碰 auth/db（會引爆 window 問題） */
export function getFirebaseAuth() {
  if (typeof window === "undefined") return null;
  if (_auth) return _auth;
  _auth = getAuth(getFirebaseApp());
  return _auth;
}

export function getFirebaseDb() {
  if (typeof window === "undefined") return null;
  if (_db) return _db;
  _db = getFirestore(getFirebaseApp());
  return _db;
}
