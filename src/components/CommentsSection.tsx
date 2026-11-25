import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Check, EyeOff, Flag, MessageSquare, Reply, ShieldAlert, ThumbsUp, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { checkActionCooldown, generateSpamChallenge, markActionCooldown } from '../lib/appCheck';
import { db } from '../lib/firebase';
import { formatDateEs, generateId } from '../lib/utils';
import { CommentItem, Post } from '../types/editorial';
import { EditorialButton, EditorialNotice, editorialInputClass } from './ui/EditorialPrimitives';
import { VerifiedBadge } from './VerifiedBadge';

interface CommentsSectionProps {
  post: Post;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({ post }) => {
  const { firebaseUser, userAccount, isAdmin } = useAuth();
  const { siteConfig, setAuthModalOpen, isAuthorVerified } = useSite();

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [text, setText] = useState('');
  const [guestName, setGuestName] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [challengeSeed, setChallengeSeed] = useState(0);
  const challenge = useMemo(() => generateSpamChallenge(), [challengeSeed]);
  const [challengeAnswer, setChallengeAnswer] = useState('');
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [lastSubmitMs, setLastSubmitMs] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isPostAuthor = Boolean(firebaseUser && post.authorId === firebaseUser.uid);
  const canModerate = isAdmin || isPostAuthor;
  const commentsAllowed = post.commentsEnabled !== false;

  useEffect(() => {
    const q = canModerate
      ? query(collection(db, 'comments'), where('postId', '==', post.id))
      : query(collection(db, 'comments'), where('postId', '==', post.id), where('status', '==', 'approved'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as CommentItem)
          .sort((a, b) => {
            const ta =
              a.createdAt && typeof (a.createdAt as { toMillis?: () => number }).toMillis === 'function'
                ? (a.createdAt as { toMillis: () => number }).toMillis()
                : 0;
            const tb =
              b.createdAt && typeof (b.createdAt as { toMillis?: () => number }).toMillis === 'function'
                ? (b.createdAt as { toMillis: () => number }).toMillis()
                : 0;
            return tb - ta;
          });
        setComments(list);
      },
      (err) => console.warn('Comments listener:', err)
    );
    return () => unsub();
  }, [post.id, canModerate]);

  const topLevelComments = useMemo(() => comments.filter((c) => !c.parentId), [comments]);

  const repliesByParent = useMemo(() => {
    const map = new Map<string, CommentItem[]>();
    for (const c of comments) {
      if (c.parentId) {
        const arr = map.get(c.parentId) || [];
        arr.push(c);
        map.set(c.parentId, arr);
      }
    }
    return map;
  }, [comments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    if (!commentsAllowed && !canModerate) {
      setNotice({ ok: false, text: 'Los comentarios están deshabilitados en esta publicación.' });
      return;
    }

    if (honeypot.trim()) {
      setText('');
      setNotice({ ok: true, text: 'Comentario registrado.' });
      return;
    }

    if (!firebaseUser && !siteConfig.allowAnonymousComments) {
      setAuthModalOpen(true);
      return;
    }

    const cd = checkActionCooldown(`cmt_${post.id}`, 8000);
    const now = Date.now();
    if (!cd.allowed || now - lastSubmitMs < 6000) {
      setNotice({ ok: false, text: 'Espera unos segundos antes de enviar otro comentario.' });
      return;
    }

    if (!firebaseUser && Number(challengeAnswer.trim()) !== challenge.expectedAnswer) {
      setNotice({ ok: false, text: 'Verifica la respuesta de control antispam.' });
      return;
    }

    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setNotice({ ok: false, text: 'Escribe un comentario más detallado.' });
      return;
    }

    const blocked = (siteConfig.blockedWords || []).filter(Boolean);
    const lower = trimmed.toLowerCase();
    const hit = blocked.find((w) => lower.includes(w.toLowerCase()));
    if (hit) {
      setNotice({ ok: false, text: `Tu comentario contiene una palabra restringida ("${hit}").` });
      return;
    }

    const displayName = firebaseUser
      ? userAccount?.displayName || firebaseUser.displayName || 'Lector registrado'
      : guestName.trim();

    if (!firebaseUser && displayName.length < 2) {
      setNotice({ ok: false, text: 'Ingresa un nombre visible para comentar.' });
      return;
    }

    setSubmitting(true);
    try {
      const id = generateId('cmt');
      const initialStatus = siteConfig.commentModerationMode === 'pre' && !canModerate ? 'pending' : 'approved';
      await setDoc(doc(db, 'comments', id), {
        id,
        postId: post.id,
        postTitle: post.title.slice(0, 220),
        postAuthorId: post.authorId,
        ...(replyTo ? { parentId: replyTo.id } : {}),
        ...(firebaseUser ? { authorId: firebaseUser.uid } : {}),
        authorName: displayName.slice(0, 80),
        authorIsAnonymous: !firebaseUser,
        ...(isAdmin ? { authorIsAdmin: true, authorProfileId: 'owner' } : {}),
        text: trimmed.slice(0, 2000),
        status: initialStatus,
        likesCount: 0,
        reportCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (initialStatus === 'approved') {
        await updateDoc(doc(db, 'posts', post.id), {
          commentCount: increment(1),
        }).catch(() => undefined);
      }

      markActionCooldown(`cmt_${post.id}`);
      setLastSubmitMs(now);
      setText('');
      setChallengeAnswer('');
      setChallengeSeed((n) => n + 1);
      setReplyTo(null);
      setNotice({
        ok: true,
        text:
          initialStatus === 'pending'
            ? 'Comentario enviado a moderación previa. Se mostrará una vez aprobado.'
            : 'Comentario publicado.',
      });
    } catch {
      setNotice({ ok: false, text: 'No se pudo publicar tu comentario en este momento.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (c: CommentItem) => {
    if (c.status !== 'approved' || likedIds.includes(c.id)) return;
    setLikedIds((prev) => [...prev, c.id]);
    try {
      await updateDoc(doc(db, 'comments', c.id), {
        likesCount: (c.likesCount || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    } catch {
      setLikedIds((prev) => prev.filter((id) => id !== c.id));
    }
  };

  const handleReport = async (c: CommentItem) => {
    if (c.status !== 'approved') return;
    try {
      await updateDoc(doc(db, 'comments', c.id), {
        reportCount: (c.reportCount || 0) + 1,
        updatedAt: serverTimestamp(),
      });
      setNotice({ ok: true, text: 'Comentario reportado para revisión editorial.' });
    } catch {
      setNotice({ ok: false, text: 'No se pudo enviar el reporte en este momento.' });
    }
  };

  const handleModStatus = async (c: CommentItem, status: CommentItem['status']) => {
    try {
      await updateDoc(doc(db, 'comments', c.id), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch {
      setNotice({ ok: false, text: 'No se pudo actualizar el estado del comentario.' });
    }
  };

  const handleDelete = async (c: CommentItem) => {
    try {
      await deleteDoc(doc(db, 'comments', c.id));
    } catch {
      setNotice({ ok: false, text: 'No se pudo eliminar el comentario.' });
    }
  };

  const renderComment = (c: CommentItem, depth = 0) => {
    const replies = repliesByParent.get(c.id) || [];
    const canDelete = canModerate || (firebaseUser && c.authorId === firebaseUser.uid);
    const verifiedCommenter =
      !c.authorIsAnonymous && (Boolean(c.authorIsAdmin) || isAuthorVerified(c.authorId));

    return (
      <div
        key={c.id}
        className={`${
          depth > 0
            ? 'ml-5 sm:ml-9 pl-4 border-l border-[var(--editorial-border)]'
            : 'border-b border-[var(--editorial-border)]'
        } py-4`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-display font-bold uppercase tracking-wide text-sm text-[var(--editorial-ink)] inline-flex items-center gap-1.5">
              <span>{c.authorName}</span>
              {verifiedCommenter && <VerifiedBadge size="xs" />}
            </span>
            <span className="text-[var(--editorial-muted)]">
              {c.authorIsAnonymous ? 'Lector invitado' : c.authorIsAdmin ? 'Redacción' : 'Cuenta verificada'} ·{' '}
              {formatDateEs(c.createdAt, true)}
            </span>
            {c.status !== 'approved' && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-[11px] font-display font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                {c.status === 'pending' ? 'Pendiente' : c.status === 'spam' ? 'Spam' : 'Oculto'}
              </span>
            )}
          </div>

          {canModerate && (
            <div className="flex items-center gap-1.5 text-xs">
              {c.status !== 'approved' && (
                <button
                  type="button"
                  onClick={() => handleModStatus(c, 'approved')}
                  className="px-2.5 py-1 rounded-full border border-emerald-600/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white cursor-pointer flex items-center gap-1 transition-colors"
                >
                  <Check className="w-3 h-3" /> Aprobar
                </button>
              )}
              {c.status !== 'hidden' && (
                <button
                  type="button"
                  onClick={() => handleModStatus(c, 'hidden')}
                  className="px-2.5 py-1 rounded-full border border-[var(--editorial-border)] hover:bg-[var(--editorial-surface-subtle)] cursor-pointer flex items-center gap-1 transition-colors"
                >
                  <EyeOff className="w-3 h-3" /> Ocultar
                </button>
              )}
              <button
                type="button"
                onClick={() => handleModStatus(c, 'spam')}
                className="px-2.5 py-1 rounded-full border border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-600 hover:text-white cursor-pointer flex items-center gap-1 transition-colors"
              >
                <ShieldAlert className="w-3 h-3" /> Spam
              </button>
            </div>
          )}
        </div>

        <p className="mt-2 text-base text-[var(--editorial-ink)]/90 leading-relaxed whitespace-pre-wrap">
          {c.text}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[var(--editorial-muted)]">
          <button
            type="button"
            onClick={() => handleLike(c)}
            className={`inline-flex items-center gap-1 cursor-pointer transition-colors ${
              likedIds.includes(c.id)
                ? 'text-[var(--editorial-primary)] font-bold'
                : 'hover:text-[var(--editorial-ink)]'
            }`}
          >
            <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="font-tabular">{c.likesCount || 0}</span>
          </button>

          {depth === 0 && (commentsAllowed || canModerate) && (
            <button
              type="button"
              onClick={() => {
                setReplyTo(c);
                textareaRef.current?.focus();
              }}
              className="inline-flex items-center gap-1 hover:text-[var(--editorial-ink)] cursor-pointer transition-colors"
            >
              <Reply className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Responder</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleReport(c)}
            className="inline-flex items-center gap-1 hover:text-red-600 cursor-pointer transition-colors"
          >
            <Flag className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reportar</span>
          </button>

          {canDelete && (
            <button
              type="button"
              onClick={() => handleDelete(c)}
              className="inline-flex items-center gap-1 text-red-600 hover:underline cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Eliminar</span>
            </button>
          )}
        </div>

        {replies.length > 0 && <div className="mt-2">{replies.map((r) => renderComment(r, depth + 1))}</div>}
      </div>
    );
  };

  return (
    <section id="comentarios" className="mt-14 pt-10 border-t-2 border-[var(--editorial-ink)]/80">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight flex items-center gap-2 text-[var(--editorial-ink)]">
          <MessageSquare className="w-5 h-5 text-[var(--editorial-primary)]" aria-hidden="true" />
          <span>Debate y comentarios ({comments.filter((c) => c.status === 'approved').length})</span>
        </h2>
        <span className="text-xs font-display uppercase tracking-wider text-[var(--editorial-muted)]">
          {!commentsAllowed
            ? 'Comentarios cerrados'
            : siteConfig.commentModerationMode === 'pre'
            ? 'Moderación previa activa'
            : 'Publicación directa con moderación'}
        </span>
      </div>

      {!commentsAllowed && !canModerate ? (
        <EditorialNotice>
          Los comentarios se encuentran deshabilitados en esta publicación por decisión editorial.
        </EditorialNotice>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-5 sm:p-6 space-y-4 shadow-xs"
        >
          <input
            type="text"
            name="website_hp"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className="hidden"
            aria-hidden="true"
          />

          {replyTo && (
            <div className="flex items-center justify-between rounded-xl bg-[var(--editorial-surface-subtle)] border border-[var(--editorial-border)] px-3.5 py-2 text-xs">
              <span>
                Respondiendo a <strong>{replyTo.authorName}</strong>
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-[var(--editorial-primary)] hover:underline cursor-pointer font-semibold"
              >
                Cancelar
              </button>
            </div>
          )}

          {!firebaseUser && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--editorial-border)]">
              {siteConfig.allowAnonymousComments ? (
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-display text-xs uppercase tracking-wider font-semibold mb-1 text-[var(--editorial-ink)]">
                      Tu nombre visible (sin registro)
                    </label>
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Ej. Lector de Ibagué"
                      className={editorialInputClass}
                    />
                  </div>
                  <div>
                    <label className="block font-display text-xs uppercase tracking-wider font-semibold mb-1 text-[var(--editorial-ink)]">
                      Verificación antispam: {challenge.question}
                    </label>
                    <input
                      type="number"
                      required
                      inputMode="numeric"
                      value={challengeAnswer}
                      onChange={(e) => setChallengeAnswer(e.target.value)}
                      placeholder="Respuesta numérica"
                      className={editorialInputClass}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--editorial-muted)]">
                  Inicia sesión con tu correo o Google para participar en el debate.
                </p>
              )}

              <EditorialButton
                variant="secondary"
                size="md"
                onClick={() => setAuthModalOpen(true)}
                className="self-start sm:self-end shrink-0"
              >
                Ingresar con correo o Google
              </EditorialButton>
            </div>
          )}

          <div>
            <label className="block font-display text-xs uppercase tracking-wider font-semibold mb-1.5 text-[var(--editorial-ink)]">
              {firebaseUser
                ? `Comentar como ${userAccount?.displayName || firebaseUser.displayName || firebaseUser.email}`
                : 'Escribe tu comentario'}
            </label>
            <textarea
              ref={textareaRef}
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              placeholder="Aporta un análisis respetuoso y argumentado..."
              className={editorialInputClass}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[var(--editorial-muted)] font-tabular">
              {text.length}/2000 caracteres
            </span>
            <EditorialButton type="submit" disabled={submitting} size="md">
              {submitting ? 'Enviando...' : replyTo ? 'Publicar respuesta' : 'Publicar comentario'}
            </EditorialButton>
          </div>

          {notice && <EditorialNotice tone={notice.ok ? 'success' : 'error'}>{notice.text}</EditorialNotice>}
        </form>
      )}

      <div className="mt-6">
        {topLevelComments.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--editorial-muted)]">
            {commentsAllowed
              ? 'Aún no hay comentarios en esta publicación. Sé la primera persona en abrir el debate.'
              : 'No se registraron comentarios en esta publicación.'}
          </p>
        ) : (
          topLevelComments.map((c) => renderComment(c))
        )}
      </div>
    </section>
  );
};
