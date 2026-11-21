import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { generateId } from './utils';

export async function logAdminActivity(
  actorUid: string,
  actorName: string,
  action: string,
  detail: string
): Promise<void> {
  if (!actorUid) return;
  const id = generateId('log');
  try {
    await setDoc(doc(db, 'admin_activity_logs', id), {
      id,
      actorUid,
      actorName: (actorName || 'Administrador').trim().slice(0, 120),
      action: action.trim().slice(0, 120),
      detail: detail.trim().slice(0, 1000),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('No se pudo registrar actividad administrativa:', err);
  }
}
