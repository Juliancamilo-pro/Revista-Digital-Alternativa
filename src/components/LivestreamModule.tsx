import React, { useEffect, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { Calendar, EyeOff, MessageSquare, Radio, Send, Users, Video, VideoOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { db } from '../lib/firebase';
import { formatDateEs, generateId, getEmbedUrl, slugify, toDate } from '../lib/utils';
import { ChatMessage, Livestream, PostStatus } from '../types/editorial';
import { EditorialImage } from './EditorialImage';
import { GoogleCalendarPanel } from './GoogleCalendarPanel';

function useCountdown(targetValue: unknown) {
  const [text, setText] = useState('');
  useEffect(() => {
    const target = toDate(targetValue).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setText('Iniciando transmisión...');
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setText(`${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetValue]);
  return text;
}

export const LivestreamModule: React.FC<{ streamId?: string }> = ({ streamId }) => {
  const { livestreams, siteConfig, navigate, setAuthModalOpen } = useSite();
  const { firebaseUser, userAccount, isAdmin } = useAuth();

  const selectedStream: Livestream | null = streamId
    ? livestreams.find((s) => s.id === streamId) || null
    : livestreams.find((s) => s.status === 'live') || livestreams[0] || null;

  const countdown = useCountdown(selectedStream?.scheduledFor);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [guestName, setGuestName] = useState('');
  const [chatError, setChatError] = useState('');

  // WebRTC direct camera broadcasting state
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [webrtcError, setWebrtcError] = useState('');
  const [broadcastFeedback, setBroadcastFeedback] = useState('');

  const isHost = Boolean(
    selectedStream && firebaseUser && (isAdmin || selectedStream.hostId === firebaseUser.uid)
  );

  // Subscribe to real-time chat
  useEffect(() => {
    if (!selectedStream) return;
    const q = query(
      collection(db, 'livestreams', selectedStream.id, 'chat'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setChatMessages(snap.docs.map((d) => d.data() as ChatMessage));
      },
      (err) => console.warn('Chat listener:', err)
    );
    return () => unsub();
  }, [selectedStream?.id]);

  // Viewer count tracking when stream is live
  useEffect(() => {
    if (!selectedStream || selectedStream.status !== 'live') return;
    const nextCount = (selectedStream.viewerCount || 0) + 1;
    const nextPeak = Math.max(selectedStream.peakViewers || 0, nextCount);
    updateDoc(doc(db, 'livestreams', selectedStream.id), {
      viewerCount: nextCount,
      peakViewers: nextPeak,
    }).catch(() => undefined);

    return () => {
      updateDoc(doc(db, 'livestreams', selectedStream.id), {
        viewerCount: Math.max(0, nextCount - 1),
        peakViewers: nextPeak,
      }).catch(() => undefined);
    };
  }, [selectedStream?.id, selectedStream?.status]);

  // WebRTC Viewer listener when sourceType === 'webrtc' and stream is live (and current user is viewer)
  useEffect(() => {
    if (!selectedStream || selectedStream.sourceType !== 'webrtc' || selectedStream.status !== 'live' || cameraActive) {
      return;
    }
    const viewerId = generateId('viewer');
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const sigId = generateId('ice');
        setDoc(doc(db, 'livestreams', selectedStream.id, 'signals', sigId), {
          id: sigId,
          type: 'candidate',
          senderId: viewerId,
          targetId: 'host',
          payload: JSON.stringify(e.candidate),
          createdAt: serverTimestamp(),
        }).catch(() => undefined);
      }
    };

    // Listen for host offers targeted to this viewer or broadcast
    const unsub = onSnapshot(
      collection(db, 'livestreams', selectedStream.id, 'signals'),
      async (snap) => {
        for (const d of snap.docs) {
          const sig = d.data();
          if (sig.type === 'offer' && (sig.targetId === viewerId || sig.targetId === 'all') && !pc.currentRemoteDescription) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sig.payload)));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              const ansId = generateId('ans');
              await setDoc(doc(db, 'livestreams', selectedStream.id, 'signals', ansId), {
                id: ansId,
                type: 'answer',
                senderId: viewerId,
                targetId: 'host',
                payload: JSON.stringify(answer),
                createdAt: serverTimestamp(),
              });
            } catch {
              // ignore race
            }
          } else if (sig.type === 'candidate' && sig.senderId === 'host') {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(sig.payload)));
            } catch {
              // ignore
            }
          }
        }
      },
      (err) => console.warn('Signals listener:', err)
    );

    return () => {
      unsub();
      pc.close();
    };
  }, [selectedStream?.id, selectedStream?.sourceType, selectedStream?.status, cameraActive]);

  const startWebRtcBroadcast = async () => {
    if (!selectedStream) return;
    setWebrtcError('');
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = media;
      setCameraActive(true);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = media;
      }
      await updateDoc(doc(db, 'livestreams', selectedStream.id), {
        status: 'live',
        sourceType: 'webrtc',
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      peerConnectionsRef.current.set('broadcast', pc);
      media.getTracks().forEach((track) => pc.addTrack(track, media));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          const cid = generateId('ice');
          setDoc(doc(db, 'livestreams', selectedStream.id, 'signals', cid), {
            id: cid,
            type: 'candidate',
            senderId: 'host',
            targetId: 'all',
            payload: JSON.stringify(e.candidate),
            createdAt: serverTimestamp(),
          }).catch(() => undefined);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const oid = generateId('off');
      await setDoc(doc(db, 'livestreams', selectedStream.id, 'signals', oid), {
        id: oid,
        type: 'offer',
        senderId: 'host',
        targetId: 'all',
        payload: JSON.stringify(offer),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      setWebrtcError(
        err instanceof Error
          ? `No se pudo acceder a la cámara/micrófono: ${err.message}`
          : 'No se pudo iniciar la cámara del navegador.'
      );
    }
  };

  const stopWebRtcBroadcast = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    setCameraActive(false);
  };

  const handleGoLive = async () => {
    if (!selectedStream) return;
    setBroadcastFeedback('');
    try {
      await updateDoc(doc(db, 'livestreams', selectedStream.id), {
        status: 'live',
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch {
      setBroadcastFeedback('No se pudo activar el estado EN VIVO. Verifica tus permisos.');
    }
  };

  const handleEndAndArchiveVod = async () => {
    if (!selectedStream) return;
    setBroadcastFeedback('');
    stopWebRtcBroadcast();
    try {
      const postId = generateId('vod');
      const vodStatus: PostStatus = isAdmin || siteConfig.autoPublishCollaborators ? 'published' : 'in_review';
      const rawAuthor = (selectedStream.hostName || 'Redacción').trim().slice(0, 120);
      const safeAuthor = rawAuthor.length >= 2 ? rawAuthor : 'Redacción';
      const rawTitle = (selectedStream.title || 'Transmisión en vivo').trim().slice(0, 220);
      const safeTitle = rawTitle.length >= 3 ? rawTitle : 'Transmisión en vivo';

      await setDoc(doc(db, 'posts', postId), {
        id: postId,
        title: safeTitle,
        slug: `${slugify(safeTitle)}-${postId.slice(-4)}`.slice(0, 240),
        subtitle: (selectedStream.description || 'Transmisión en vivo archivada bajo demanda.').slice(0, 500),
        type: 'livestream',
        status: vodStatus,
        featured: false,
        breaking: false,
        isSample: false,
        categoryId: 'cat_envivo',
        categoryName: 'En Vivo',
        categorySlug: 'en-vivo',
        tags: ['en vivo', 'archivo'],
        authorId: selectedStream.hostId,
        authorName: safeAuthor,
        ...(selectedStream.announcementImage
          ? { coverImage: selectedStream.announcementImage.slice(0, 400000) }
          : {}),
        ...(selectedStream.sourceUrl ? { mediaUrl: selectedStream.sourceUrl.slice(0, 400000) } : {}),
        mediaSourceType: selectedStream.sourceType,
        blocks: [
          {
            id: generateId('blk'),
            type: 'paragraph',
            text: selectedStream.description || 'Transmisión especial archivada en nuestra videoteca.',
          },
        ],
        readTimeMinutes: 2,
        viewCount: selectedStream.peakViewers || 1,
        commentCount: 0,
        ...(vodStatus === 'published' ? { publishedAt: serverTimestamp() } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'livestreams', selectedStream.id), {
        status: 'ended',
        endedAt: serverTimestamp(),
        archivedPostId: postId,
        viewerCount: 0,
        updatedAt: serverTimestamp(),
      });
    } catch {
      setBroadcastFeedback('No se pudo finalizar y archivar la transmisión en este momento.');
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setChatError('');
    if (!selectedStream) return;
    if (!firebaseUser && !siteConfig.allowAnonymousComments) {
      setAuthModalOpen(true);
      return;
    }
    const clean = chatText.trim();
    if (!clean) return;
    const authorName = firebaseUser
      ? userAccount?.displayName || firebaseUser.displayName || 'Lector'
      : guestName.trim() || 'Invitado';

    try {
      const id = generateId('msg');
      await setDoc(doc(db, 'livestreams', selectedStream.id, 'chat', id), {
        id,
        streamId: selectedStream.id,
        ...(firebaseUser ? { authorId: firebaseUser.uid } : {}),
        authorName: authorName.slice(0, 80),
        authorRole: isAdmin ? 'admin' : isHost ? 'anfitrión' : 'lector',
        text: clean.slice(0, 400),
        status: 'visible',
        createdAt: serverTimestamp(),
      });
      setChatText('');
    } catch {
      setChatError('No se pudo enviar el mensaje al chat.');
    }
  };

  const embed = selectedStream?.sourceUrl ? getEmbedUrl(selectedStream.sourceUrl) : null;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      <div className="border-b-2 border-[#111111] dark:border-neutral-700 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
            Señal abierta e independiente
          </p>
          <h1 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight">
            Transmisiones en vivo
          </h1>
        </div>
        <div className="flex items-center gap-3 text-xs font-display uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
          <span>{livestreams.filter((s) => s.status === 'live').length} activas</span>
          <span>·</span>
          <span>{livestreams.filter((s) => s.status === 'scheduled').length} programadas</span>
        </div>
      </div>

      {!selectedStream ? (
        <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-12 text-center space-y-6">
          <p className="text-base text-neutral-600 dark:text-neutral-400">
            No hay transmisiones activas o programadas por el momento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Player & Controls */}
          <div className="lg:col-span-8 space-y-5">
            <div className="rounded-2xl bg-[#111111] text-white border border-neutral-800 overflow-hidden shadow-lg">
              {/* Top status strip */}
              <div className="px-4 py-3 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-display font-bold uppercase tracking-widest">
                  {selectedStream.status === 'live' ? (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-pulse" aria-hidden="true" />
                      <span className="text-[#FCA5A5]">EN VIVO</span>
                    </>
                  ) : selectedStream.status === 'scheduled' ? (
                    <>
                      <Calendar className="w-4 h-4 text-amber-400" aria-hidden="true" />
                      <span className="text-amber-300">Programada · {formatDateEs(selectedStream.scheduledFor, true)}</span>
                    </>
                  ) : (
                    <span className="text-neutral-400">Transmisión finalizada (archivada)</span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs font-tabular text-neutral-300">
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" aria-hidden="true" />
                    {selectedStream.viewerCount || 0} viendo ahora
                  </span>
                  <span>Pico: {selectedStream.peakViewers || 0}</span>
                </div>
              </div>

              {/* Video viewport */}
              <div className="aspect-video bg-black relative flex items-center justify-center">
                {selectedStream.sourceType === 'webrtc' && cameraActive ? (
                  <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                ) : selectedStream.sourceType === 'webrtc' && selectedStream.status === 'live' ? (
                  <video ref={remoteVideoRef} autoPlay playsInline controls className="w-full h-full object-cover" />
                ) : selectedStream.status === 'scheduled' ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    {selectedStream.announcementImage && (
                      <EditorialImage
                        src={selectedStream.announcementImage}
                        alt={selectedStream.title}
                        className="absolute inset-0 w-full h-full object-cover opacity-40"
                      />
                    )}
                    <div className="relative z-10 text-center p-6 rounded-2xl bg-black/75 border border-neutral-700 max-w-md mx-4">
                      <p className="font-display text-xs uppercase tracking-widest text-[#FCA5A5] font-bold">
                        Cuenta regresiva para el inicio
                      </p>
                      <p className="mt-2 font-tabular text-3xl sm:text-4xl font-bold text-white">
                        {countdown}
                      </p>
                      <p className="mt-2 text-xs text-neutral-300">
                        {formatDateEs(selectedStream.scheduledFor, true)}
                      </p>
                    </div>
                  </div>
                ) : embed && embed.kind === 'iframe' ? (
                  <iframe
                    src={embed.src}
                    title={selectedStream.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : embed && embed.kind === 'video' ? (
                  <video src={embed.src} controls autoPlay className="w-full h-full" />
                ) : (
                  <div className="text-center p-6 space-y-2">
                    <Radio className="w-10 h-10 text-[var(--editorial-primary)] mx-auto" />
                    <p className="text-sm text-neutral-300">Señal en espera de enlace o cámara.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Host / Admin Broadcast Controls */}
            {isHost && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5 space-y-3">
                  <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                    Controles de emisión (Anfitrión / Admin)
                  </p>
                  {webrtcError && <p role="alert" className="text-xs text-red-600">{webrtcError}</p>}
                  {broadcastFeedback && <p role="alert" className="text-xs text-red-600">{broadcastFeedback}</p>}
                  <div className="flex flex-wrap gap-2">
                    {selectedStream.status !== 'live' && (
                      <button
                        type="button"
                        onClick={handleGoLive}
                        className="px-4 py-2 rounded-full bg-[var(--editorial-primary)] text-white font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Activar estado EN VIVO
                      </button>
                    )}

                    {!cameraActive ? (
                      <button
                        type="button"
                        onClick={startWebRtcBroadcast}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#111111] dark:border-neutral-600 font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Transmitir con cámara (WebRTC)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopWebRtcBroadcast}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-neutral-800 text-white font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
                      >
                        <VideoOff className="w-3.5 h-3.5" />
                        <span>Detener cámara</span>
                      </button>
                    )}

                    {selectedStream.status !== 'ended' && (
                      <button
                        type="button"
                        onClick={handleEndAndArchiveVod}
                        className="px-4 py-2 rounded-full border border-red-600 text-red-600 hover:bg-red-600 hover:text-white font-display text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
                      >
                        Finalizar y archivar como VOD
                      </button>
                    )}

                    {selectedStream.archivedPostId && (
                      <button
                        type="button"
                        onClick={() => navigate(`/articulo/${selectedStream.archivedPostId}`)}
                        className="px-4 py-2 rounded-full bg-emerald-700 text-white font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Ver archivo VOD publicado
                      </button>
                    )}
                  </div>
                </div>

                <GoogleCalendarPanel
                  compact
                  defaultTitle={selectedStream.title}
                  defaultDescription={selectedStream.description || ''}
                />
              </div>
            )}

            <div className="space-y-2">
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold">{selectedStream.title}</h2>
              <p className="text-sm font-display uppercase tracking-wider text-neutral-500">
                Conduce: {selectedStream.hostName}
              </p>
              {selectedStream.description && (
                <p className="text-base text-neutral-700 dark:text-neutral-300 leading-relaxed pt-2">
                  {selectedStream.description}
                </p>
              )}
            </div>
          </div>

          {/* Live Chat Panel */}
          <aside className="lg:col-span-4 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] flex flex-col h-[540px] overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-neutral-300 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="font-display text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[var(--editorial-primary)]" />
                <span>Chat en directo</span>
              </h3>
              <span className="text-xs font-tabular text-neutral-500">{chatMessages.filter((m) => m.status === 'visible').length}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages
                .filter((m) => m.status === 'visible' || isHost)
                .map((m) => (
                  <div
                    key={m.id}
                    className={`text-sm pb-2 border-b border-neutral-200 dark:border-neutral-800 ${m.status === 'hidden' ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-xs font-bold uppercase tracking-wider text-[var(--editorial-primary)]">
                        {m.authorName}
                      </span>
                      {isHost && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, 'livestreams', selectedStream.id, 'chat', m.id), {
                                  status: m.status === 'visible' ? 'hidden' : 'visible',
                                });
                              } catch {
                                setChatError('No se pudo actualizar la visibilidad del mensaje.');
                              }
                            }}
                            aria-label="Ocultar mensaje"
                            className="p-1 text-neutral-500 hover:text-black dark:hover:text-white cursor-pointer"
                          >
                            <EyeOff className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-neutral-800 dark:text-neutral-200 mt-0.5 break-words">{m.text}</p>
                  </div>
                ))}
              {chatMessages.length === 0 && (
                <p className="text-xs text-neutral-500 text-center pt-10">
                  Aún no hay mensajes en esta sala. Participa en el diálogo.
                </p>
              )}
            </div>

            <form onSubmit={handleSendChat} className="p-3 border-t border-neutral-300 dark:border-neutral-800 space-y-2">
              {!firebaseUser && siteConfig.allowAnonymousComments && (
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Tu nombre visible"
                  className="w-full px-3 py-1.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                />
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  maxLength={400}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 px-3.5 py-2 rounded-full bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
                />
                <button
                  type="submit"
                  aria-label="Enviar mensaje"
                  className="px-4 py-2 rounded-full bg-[var(--editorial-primary)] text-white cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              {chatError && <p className="text-xs text-red-600">{chatError}</p>}
            </form>
          </aside>
        </div>
      )}

      {/* Calendar of all broadcasts */}
      {livestreams.length > 1 && (
        <section className="pt-6 border-t border-neutral-300 dark:border-neutral-800 space-y-4">
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight">
            Agenda y archivo de transmisiones
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {livestreams.map((s) => (
              <div
                key={s.id}
                onClick={() => navigate(`/en-vivo/${s.id}`)}
                className={`cursor-pointer rounded-2xl border p-5 space-y-2 transition-all hover:shadow-md ${
                  selectedStream?.id === s.id
                    ? 'border-[var(--editorial-primary)] bg-white dark:bg-[#161616]'
                    : 'border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414]'
                }`}
              >
                <p className="font-display text-xs font-bold uppercase tracking-wider text-[var(--editorial-primary)]">
                  {s.status === 'live' ? 'EN VIVO' : s.status === 'scheduled' ? 'Programada' : 'Finalizada'} · {formatDateEs(s.scheduledFor || s.createdAt, true)}
                </p>
                <h3 className="font-display text-xl font-bold leading-snug">{s.title}</h3>
                <p className="text-xs text-neutral-500">{s.hostName}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
};
