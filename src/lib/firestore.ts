import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export type SavedPalette = {
  id: string;
  name: string;
  colors: string[];
  createdAt?: any;
};

export async function savePalette(uid: string, name: string, colors: string[]) {
  const colRef = collection(db, "users", uid, "palettes");
  await addDoc(colRef, {
    name,
    colors,
    createdAt: serverTimestamp()
  });
}

export async function listPalettes(uid: string): Promise<SavedPalette[]> {
  const colRef = collection(db, "users", uid, "palettes");
  const q = query(colRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any)
  })) as SavedPalette[];
}

export async function removePalette(uid: string, paletteId: string) {
  await deleteDoc(doc(db, "users", uid, "palettes", paletteId));
}
