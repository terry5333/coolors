import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";

export type SavedPalette = {
  id: string;
  name: string;
  colors: string[];
  createdAt?: any;
};

function mustDb() {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore is not available on server side.");
  return db;
}

export async function savePalette(uid: string, name: string, colors: string[]) {
  const db = mustDb();
  const colRef = collection(db, "users", uid, "palettes");
  await addDoc(colRef, {
    name,
    colors,
    createdAt: serverTimestamp()
  });
}

export async function listPalettes(uid: string): Promise<SavedPalette[]> {
  const db = mustDb();
  const colRef = collection(db, "users", uid, "palettes");
  const q = query(colRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any)
  })) as SavedPalette[];
}

export async function removePalette(uid: string, paletteId: string) {
  const db = mustDb();
  await deleteDoc(doc(db, "users", uid, "palettes", paletteId));
}
