"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import YouTube, { YouTubePlayer } from "react-youtube";
import type { Peer, DataConnection } from "peerjs";
import QRCode from "react-qr-code";
import { Song, Command, User } from "@/types/player";
import {
  FaPlay,
  FaPause,
  FaStepForward,
  FaUserAstronaut,
  FaExpand,
  FaCog,
  FaCompactDisc,
  FaLink,
  FaAndroid,
  FaApple,
  FaCrop,
  FaCheck,
  FaCompress,
  FaHandPointer,
  FaVolumeUp,
  FaHeart,
  FaCode,
  FaInfoCircle,
} from "react-icons/fa";
import FunToast from "../components/FunToast";
import Modal from "./Modal";

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};

export default function PlayerScreen() {
  const [peerId, setPeerId] = useState<string>("");
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
  const [masterId, setMasterId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<
    "dashboard" | "settings" | "about"
  >("dashboard");
  const [origin, setOrigin] = useState("");

  const [videoFit, setVideoFit] = useState(false);
  const [requireInteraction, setRequireInteraction] = useState(true);
  const [isIOS, setIsIOS] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // [FIX 1] เพิ่ม Ref เพื่อจำค่าการกดเปิดเสียง (แม่นยำกว่า State)
  const hasInteractedRef = useRef(false);

  const [supportsFullscreen, setSupportsFullscreen] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showNowPlaying, setShowNowPlaying] = useState(false);

  const [isUIIdle, setIsUIIdle] = useState(false);
  const uiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "join" | "add" | "info" | "alert";
  } | null>(null);

  const playerRef = useRef<YouTubePlayer | null>(null);
  const queueRef = useRef<Song[]>([]);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const usersRef = useRef<User[]>([]);
  const masterIdRef = useRef<string | null>(null);
  const currentSongRef = useRef<Song | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    usersRef.current = connectedUsers;
  }, [connectedUsers]);
  useEffect(() => {
    masterIdRef.current = masterId;
    currentSongRef.current = currentSong;
    if (masterId) broadcastState();
  }, [masterId, currentSong]);

  useEffect(() => {
    setOrigin(window.location.origin);

    const userAgent =
      navigator.userAgent || navigator.vendor || (window as any).opera;
    const isIOSCheck =
      /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSCheck);

    setSupportsFullscreen(
      !!(
        document.fullscreenEnabled || (document as any).webkitFullscreenEnabled
      )
    );

    const savedMaster = localStorage.getItem("jukebox_master_id");
    if (savedMaster) setMasterId(savedMaster);

    const savedFit = localStorage.getItem("jukebox_video_fit");
    if (savedFit === "true") setVideoFit(true);

    const savedReqInt = localStorage.getItem("jukebox_require_interaction");
    if (savedReqInt === "false") setRequireInteraction(false);

    const hasSeenWelcome = localStorage.getItem("jukebox_has_seen_welcome");
    if (!hasSeenWelcome) {
      setShowWelcomeModal(true);
    }
  }, []);

  useEffect(() => {
    if (playerRef.current && isPlaying) {
      if (requireInteraction) {
        const isMuted = playerRef.current.isMuted();
        if (isIOS) {
          if (isMuted) setNeedsInteraction(true);
        } else {
          // [FIX 2] เช็คจาก Ref แทน State เพื่อความแม่นยำ
          if (!hasInteractedRef.current && isMuted) setNeedsInteraction(true);
        }
      } else {
        setNeedsInteraction(false);
      }
    }
  }, [requireInteraction, isPlaying, isIOS]); // เอา hasInteracted ออกจาก dependency

  const handleCloseWelcome = () => {
    setShowWelcomeModal(false);
    localStorage.setItem("jukebox_has_seen_welcome", "true");
  };

  const toggleVideoFit = () => {
    const newVal = !videoFit;
    setVideoFit(newVal);
    localStorage.setItem("jukebox_video_fit", String(newVal));
    showToast(newVal ? "โหมดเต็มจอ (ตัดขอบ)" : "โหมดปกติ (เห็นครบ)", "info");
  };

  const toggleRequireInteraction = () => {
    const newVal = !requireInteraction;
    setRequireInteraction(newVal);
    localStorage.setItem("jukebox_require_interaction", String(newVal));
    showToast(
      newVal ? "เปิดระบบตรวจสอบเสียง (Safe)" : "ปิดระบบตรวจสอบ (Free Mode)",
      "info"
    );
  };

  const handleMouseMove = useCallback(() => {
    setIsUIIdle(false);
    if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
    uiTimeoutRef.current = setTimeout(() => {
      if (!isModalOpen && !showWelcomeModal && !needsInteraction) {
        setIsUIIdle(true);
      }
    }, 3000);
  }, [isModalOpen, showWelcomeModal, needsInteraction]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchstart", handleMouseMove);
    handleMouseMove();
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchstart", handleMouseMove);
      if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
    };
  }, [handleMouseMove]);

  useEffect(() => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    progressInterval.current = setInterval(async () => {
      if (playerRef.current && isPlaying) {
        const curr = await playerRef.current.getCurrentTime();
        const dur = await playerRef.current.getDuration();
        setCurrentTime(curr);
        setDuration(dur);
      }
    }, 1000);
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [isPlaying]);

  const showToast = (msg: string, type: "join" | "add" | "info" | "alert") => {
    setToast({ msg, type });
  };

  useEffect(() => {
    let peer: Peer;
    const initPeer = async () => {
      const { default: Peer } = await import("peerjs");
      peer = new Peer();
      peer.on("open", (id) => setPeerId(id));
      peer.on("connection", (conn) => {
        conn.on("open", () => setTimeout(broadcastState, 500));
        conn.on("data", (data: any) => handleCommand(data, conn));
      });
    };
    initPeer();
    return () => peer?.destroy();
  }, []);

  const handleCommand = (cmd: Command, conn: DataConnection) => {
    switch (cmd.type) {
      case "JOIN":
        const newUser = { ...cmd.user };
        if (newUser.id === localStorage.getItem("jukebox_master_id")) {
          newUser.isMaster = true;
          if (masterIdRef.current !== newUser.id) setMasterId(newUser.id);
        }
        setConnectedUsers((prev) => {
          const clean = prev.filter((u) => u.id !== newUser.id);
          return [...clean, newUser];
        });
        connectionsRef.current.set(conn.peer, conn);
        if (!newUser.isMaster)
          showToast(`${newUser.name} เข้าร่วมปาร์ตี้`, "join");
        setTimeout(broadcastState, 200);
        break;
      case "ADD_SONG":
        const videoId = extractVideoID(cmd.url);
        if (videoId) {
          const newSong: Song = {
            id: videoId,
            title: `Song ${videoId}`,
            sender: cmd.user.name,
            thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          };
          fetch(`https://noembed.com/embed?url=${cmd.url}`)
            .then((r) => r.json())
            .then((d) => {
              if (d.title) newSong.title = d.title;
            })
            .catch(() => {})
            .finally(() => {
              setQueue((prev) => {
                const newQueue = [...prev, newSong];
                if (!currentSongRef.current && prev.length === 0) {
                  setTimeout(() => playNext(newQueue), 500);
                }
                return newQueue;
              });
              showToast(`${cmd.user.name} เพิ่มเพลงแล้ว`, "add");
              setTimeout(broadcastState, 100);
            });
        }
        break;
      case "PLAY":
        if (isMaster(cmd.user.id)) playerRef.current?.playVideo();
        break;
      case "PAUSE":
        if (isMaster(cmd.user.id)) playerRef.current?.pauseVideo();
        break;
      case "STOP":
        if (isMaster(cmd.user.id)) handleStop();
        break;
      case "NEXT":
        if (isMaster(cmd.user.id)) playNext();
        break;
      case "GET_STATE":
        broadcastState();
        break;
    }
  };

  const isMaster = (userId?: string) => userId === masterIdRef.current;

  const playNext = (overrideQueue?: Song[]) => {
    const currentQueue = overrideQueue || queueRef.current;
    if (currentQueue.length > 0) {
      const [nextSong, ...remainingQueue] = currentQueue;
      setQueue(remainingQueue);
      setCurrentSong(nextSong);
      setIsPlaying(true);
      setShowNowPlaying(true);
      setTimeout(() => setShowNowPlaying(false), 5000);

      if (playerRef.current) {
        // [FIX 3] โหลดวิดีโอ
        playerRef.current.loadVideoById(nextSong.id);

        if (requireInteraction) {
          if (isIOS) {
            // iOS ต้องรอ User กดเสมอ
            playerRef.current.mute();
          } else {
            // Android/PC: เช็คจาก Ref ถ้าเคยกดแล้ว ให้เล่นเลย
            if (!hasInteractedRef.current) {
              playerRef.current.mute();
            } else {
              // [FIX 4] Force Play สำหรับ Android
              playerRef.current.unMute();
              playerRef.current.setVolume(100);
              // หน่วงเวลานิดนึงเพื่อให้ YouTube API บน Android พร้อม
              setTimeout(() => {
                playerRef.current?.playVideo();
              }, 150);
            }
          }
        } else {
          // Free Mode
          playerRef.current.unMute();
          playerRef.current.setVolume(100);
          setTimeout(() => playerRef.current?.playVideo(), 150);
        }
      }

      broadcastState();
    } else {
      handleStop();
    }
  };

  const handleStop = () => {
    playerRef.current?.stopVideo();
    setCurrentSong(null);
    setQueue([]);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    broadcastState();
  };

  const toggleFullscreen = () => {
    if (
      !document.fullscreenElement &&
      !(document as any).webkitFullscreenElement
    ) {
      const docEl = document.documentElement as any;
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  };

  const onReady = (event: { target: YouTubePlayer }) => {
    playerRef.current = event.target;
    // ปรับให้เริ่มต้น Mute ไว้ก่อนเพื่อความชัวร์ในการโหลด
    event.target.mute();
  };

  const onStateChange = (e: any) => {
    // 1 = Playing, 3 = Buffering
    if (e.data === 1 || e.data === 3) {
      setIsPlaying(true);
      if (requireInteraction) {
        const isMuted = playerRef.current?.isMuted();
        if (isIOS) {
          if (isMuted) setNeedsInteraction(true);
          else setNeedsInteraction(false);
        } else {
          // [FIX 5] ใช้ Ref เช็ค
          if (!hasInteractedRef.current && isMuted) {
            setNeedsInteraction(true);
          } else if (hasInteractedRef.current) {
            setNeedsInteraction(false);
            // ถ้าเคย Interact แล้วแต่เสียงยังปิดอยู่ ให้เปิดเสียงเลย
            if (isMuted) playerRef.current?.unMute();
          }
        }
      } else {
        setNeedsInteraction(false);
      }
    }

    // [FIX 6] Watchdog: ถ้าหยุดเอง (Paused/Cued) แต่เราต้องการให้เล่น และเป็น Android ที่เคย Interact แล้ว -> สั่งเล่นต่อทันที
    if (
      (e.data === 2 || e.data === 5 || e.data === -1) &&
      isPlaying &&
      !isIOS &&
      hasInteractedRef.current
    ) {
      playerRef.current?.playVideo();
    } else if (e.data === 2) {
      // ถ้าหยุดโดย User จริงๆ
      setIsPlaying(false);
    }

    if (e.data === 0) playNext();
  };

  const handleUserInteraction = () => {
    if (playerRef.current) {
      playerRef.current.unMute();
      playerRef.current.setVolume(100);
      playerRef.current.playVideo();
    }
    setNeedsInteraction(false);
    setHasInteracted(true);
    // [FIX 7] อัปเดต Ref ด้วย
    hasInteractedRef.current = true;
  };

  const broadcastState = () => {
    Array.from(connectionsRef.current.values()).forEach((conn) => {
      if (conn.open) {
        conn.send({
          type: "UPDATE_STATE",
          queue: queueRef.current,
          currentId: currentSongRef.current?.id || null,
          users: usersRef.current,
          masterId: masterIdRef.current,
        });
      }
    });
  };

  const extractVideoID = (url: string) => {
    const regExp =
      /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[7].length == 11 ? match[7] : false;
  };

  const remoteUrl = origin && peerId ? `${origin}/remote?host=${peerId}` : "";
  const showQR =
    (!currentSong && queue.length === 0) || connectedUsers.length === 0;

  return (
    <div className="h-dvh w-screen flex flex-col bg-black text-white font-sans overflow-hidden select-none absolute inset-0 z-50">
      {toast && (
        <FunToast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {needsInteraction && currentSong && requireInteraction && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div
            onClick={handleUserInteraction}
            className="bg-black/80 backdrop-blur-md p-8 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center justify-center cursor-pointer pointer-events-auto hover:scale-105 transition-transform animate-in fade-in zoom-in duration-300 mx-6 max-w-sm"
          >
            <div className="bg-pink-500/20 p-4 rounded-full text-pink-500 mb-4 animate-pulse">
              <FaVolumeUp size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {isIOS ? "แตะเพื่อเปิดเสียง" : "แตะเพื่อเริ่มเสียง"}
            </h3>
            <p className="text-gray-400 text-sm text-center">
              ระบบปิดเสียงชั่วคราวเพื่อเล่นวิดีโอต่อเนื่อง
            </p>
          </div>
        </div>
      )}

      <header
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 transition-all duration-500 ease-in-out border-b border-zinc-800 bg-black
            ${
              isUIIdle
                ? "h-12 opacity-20 translate-y-[-10%] hover:opacity-100"
                : "h-16 opacity-100 translate-y-0"
            }`}
      >
        <div
          className="flex items-center gap-3 transition-transform duration-500 origin-left"
          style={{ transform: isUIIdle ? "scale(0.8)" : "scale(1)" }}
        >
          <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-orange-400 rounded-lg flex items-center justify-center shadow-lg">
            <FaCompactDisc
              className={`text-white ${isPlaying ? "animate-spin-slow" : ""}`}
            />
          </div>
          <h1 className="font-bold text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 hidden md:block">
            NextJuke
          </h1>
        </div>

        <div
          className="flex items-center gap-3 transition-transform duration-500 origin-right"
          style={{ transform: isUIIdle ? "scale(0.8)" : "scale(1)" }}
        >
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700 text-xs font-mono text-gray-400">
            <span
              className={`w-2 h-2 rounded-full ${
                peerId
                  ? "bg-green-500 shadow-[0_0_8px_#22c55e]"
                  : "bg-red-500 animate-pulse"
              }`}
            ></span>
            {peerId ? "ONLINE" : "OFFLINE"}
          </div>
        </div>
      </header>

      <div className="flex-1 relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
        <div
          className={`transition-all duration-700 ease-in-out ${
            showQR ? "opacity-20 !scale-95" : "opacity-100"
          } ${
            videoFit
              ? "absolute inset-0 w-full h-full overflow-hidden"
              : "w-full h-full relative"
          }`}
        >
          <div
            className={
              videoFit
                ? "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[177.78vh] h-[100vh] min-w-full min-h-full"
                : "w-full h-full"
            }
          >
            <YouTube
              videoId={currentSong?.id || ""}
              opts={{
                height: "100%",
                width: "100%",
                playerVars: {
                  autoplay: 1,
                  controls: 0,
                  disablekb: 1,
                  rel: 0,
                  showinfo: 0,
                  modestbranding: 1,
                  fs: 0,
                  iv_load_policy: 3,
                  playsinline: 1,
                },
              }}
              onReady={onReady}
              onStateChange={onStateChange}
              className="w-full h-full pointer-events-none"
            />
          </div>
        </div>

        {showQR && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4">
            <div className="flex flex-col items-center gap-6 p-8 rounded-3xl bg-zinc-900 border border-zinc-700 shadow-2xl animate-in fade-in zoom-in duration-500 max-w-sm w-full">
              <h2 className="text-3xl font-bold text-white text-center">
                Join NextJuke
              </h2>
              <div className="p-4 bg-white rounded-2xl">
                {origin && peerId ? (
                  <QRCode
                    value={remoteUrl}
                    size={180}
                    style={{ width: "100%", height: "auto" }}
                    viewBox={`0 0 256 256`}
                  />
                ) : (
                  <div className="w-[180px] h-[180px] bg-gray-200 animate-pulse rounded-lg" />
                )}
              </div>
              <div className="bg-black px-4 py-2 rounded-xl border border-zinc-800 flex gap-2 items-center w-full">
                <FaLink className="text-pink-500 shrink-0" />
                <span className="text-xs font-mono text-gray-400 truncate">
                  {remoteUrl || "Loading..."}
                </span>
              </div>
              <p className="text-gray-400 text-sm animate-pulse">
                สแกนเพื่อเริ่มเพิ่มเพลง
              </p>
            </div>
          </div>
        )}

        <div
          className={`absolute inset-0 flex items-center justify-center z-20 pointer-events-none transition-all duration-500 
            ${
              showNowPlaying && currentSong && !showQR
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-10"
            }`}
        >
          <div className="bg-black/90 p-8 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center text-center max-w-lg mx-6">
            <img
              src={currentSong?.thumbnail}
              className="w-40 h-40 rounded-2xl shadow-2xl mb-6 object-cover aspect-video"
            />
            <h2 className="text-2xl font-bold text-white mb-2 line-clamp-2">
              {currentSong?.title}
            </h2>
            <div className="flex items-center gap-2 text-pink-400 text-sm font-bold uppercase tracking-wider">
              <FaUserAstronaut /> {currentSong?.sender}
            </div>
          </div>
        </div>
      </div>

      <footer
        className={`fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-zinc-800 transition-all duration-500 ease-in-out flex items-center 
        ${
          isUIIdle
            ? "h-12 px-2 opacity-20 hover:opacity-100"
            : "h-16 px-2 md:px-8 opacity-100"
        } gap-2 md:gap-6`}
      >
        <div className="flex items-center gap-1 md:gap-2 transition-all duration-500 shrink-0">
          <button
            onClick={() =>
              isPlaying
                ? playerRef.current?.pauseVideo()
                : playerRef.current?.playVideo()
            }
            className="text-white hover:text-pink-500 p-2 hover:scale-110 transition bg-white/10 rounded-full w-8 h-8 md:w-10 md:h-10 flex items-center justify-center"
          >
            {isPlaying ? (
              <FaPause size={12} />
            ) : (
              <FaPlay className="ml-1" size={12} />
            )}
          </button>

          <button
            onClick={() => playNext()}
            className="text-gray-400 hover:text-white p-2 hover:scale-110 transition"
          >
            <FaStepForward size={18} />
          </button>
        </div>

        <div
          className={`flex-1 flex items-center gap-2 md:gap-4 transition-all duration-500 ${
            isUIIdle ? "opacity-0 blur-sm pointer-events-none" : "opacity-100"
          }`}
        >
          <span className="text-[10px] md:text-xs font-mono text-gray-500 w-8 md:w-10 text-right shrink-0">
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden relative group mx-1">
            <div
              className="absolute inset-y-0 left-0 bg-pink-600 transition-all duration-300"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={(e) =>
                playerRef.current?.seekTo(parseFloat(e.target.value), true)
              }
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <span className="text-[10px] md:text-xs font-mono text-gray-500 w-8 md:w-10 shrink-0">
            {formatTime(duration)}
          </span>
        </div>

        <div
          className={`flex items-center gap-1 md:gap-2 border-l border-zinc-800 pl-2 md:pl-4 transition-all duration-500 shrink-0 ${
            isUIIdle ? "scale-90" : "scale-100"
          }`}
        >
          {supportsFullscreen && (
            <button
              onClick={toggleFullscreen}
              className="text-gray-400 hover:text-white p-2"
            >
              <FaExpand size={14} />
            </button>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="text-gray-400 hover:text-white p-2"
          >
            <FaCog size={14} />
          </button>
        </div>
      </footer>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          <div className="flex gap-4 text-base overflow-x-auto pb-1">
            <button
              onClick={() => setSettingsTab("dashboard")}
              className={`whitespace-nowrap pb-1 ${
                settingsTab === "dashboard"
                  ? "text-white border-b-2 border-pink-500 font-bold"
                  : "text-gray-500"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setSettingsTab("settings")}
              className={`whitespace-nowrap pb-1 ${
                settingsTab === "settings"
                  ? "text-white border-b-2 border-pink-500 font-bold"
                  : "text-gray-500"
              }`}
            >
              Settings
            </button>
            <button
              onClick={() => setSettingsTab("about")}
              className={`whitespace-nowrap pb-1 ${
                settingsTab === "about"
                  ? "text-white border-b-2 border-pink-500 font-bold"
                  : "text-gray-500"
              }`}
            >
              เกี่ยวกับเรา
            </button>
          </div>
        }
      >
        <div className="p-4 text-white">
          {settingsTab === "dashboard" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <h3 className="font-bold text-pink-500 mb-2">
                  คิวเพลง ({queue.length})
                </h3>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar">
                  {queue.length === 0 ? (
                    <div className="text-zinc-500 text-sm italic py-4 text-center">
                      ยังไม่มีเพลงในคิว
                    </div>
                  ) : (
                    queue.map((s, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-sm p-2 bg-black/40 rounded"
                      >
                        <span className="truncate flex-1">
                          {i + 1}. {s.title}
                        </span>
                        <span className="text-zinc-500 text-xs ml-2">
                          {s.sender}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <h3 className="font-bold text-blue-500 mb-2">
                  ผู้ใช้งาน ({connectedUsers.length})
                </h3>
                <div className="space-y-2">
                  {connectedUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex justify-between text-sm p-2 bg-black/40 rounded items-center"
                    >
                      <span>
                        {u.name} {u.isMaster && "👑"}
                      </span>
                      {u.id !== masterId && (
                        <button
                          onClick={() => {
                            setMasterId(u.id);
                            showToast("เปลี่ยน DJ แล้ว", "info");
                          }}
                          className="text-[10px] bg-zinc-700 px-2 py-1 rounded hover:bg-zinc-600"
                        >
                          ตั้งเป็น DJ
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {settingsTab === "settings" && (
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-zinc-800/50 rounded-xl p-6 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div className="flex gap-3 items-center">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                      <FaHandPointer />
                    </div>
                    <div>
                      <h4 className="font-bold">ระบบตรวจสอบการเปิดเสียง</h4>
                      <p className="text-xs text-gray-400">
                        {requireInteraction
                          ? "เปิด (Safe): บังคับกดเปิดเสียง"
                          : "ปิด (Free Mode): เล่นต่อเนื่อง (อาจไม่มีเสียง)"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={toggleRequireInteraction}
                    className={`w-14 h-7 rounded-full p-1 transition-colors duration-300 ${
                      requireInteraction ? "bg-green-500" : "bg-zinc-600"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${
                        requireInteraction ? "translate-x-7" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="h-px bg-white/5" />

                <div className="flex items-center justify-between">
                  <div className="flex gap-3 items-center">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                      {videoFit ? <FaCompress /> : <FaCrop />}
                    </div>
                    <div>
                      <h4 className="font-bold">
                        โหมดการแสดงผล (Aspect Ratio)
                      </h4>
                      <p className="text-xs text-gray-400">
                        {videoFit
                          ? "กำลังใช้งาน: เต็มจอ (ตัดขอบ)"
                          : "กำลังใช้งาน: ปกติ (เห็นครบ)"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={toggleVideoFit}
                    className={`w-14 h-7 rounded-full p-1 transition-colors duration-300 ${
                      videoFit ? "bg-green-500" : "bg-zinc-600"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${
                        videoFit ? "translate-x-7" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="text-center text-xs text-gray-500 mt-4">
                OS: {isIOS ? "iOS / iPadOS" : "Android / Desktop"} detected
              </div>
            </div>
          )}

          {settingsTab === "about" && (
            <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-zinc-800/50 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-pink-500/20 rounded-full flex items-center justify-center text-pink-500">
                    <FaHeart size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">เกี่ยวกับ NextJuke</h3>
                    <p className="text-gray-400 text-sm">
                      สร้างด้วยใจ เพื่อปาร์ตี้ของคุณ
                    </p>
                  </div>
                </div>

                <p className="text-gray-300 leading-relaxed text-sm">
                  แอปพลิเคชันนี้เกิดขึ้นจากความต้องการใช้งานส่วนตัว
                  ในงานปาร์ตี้ที่บ้าน
                  เพื่อแก้ปัญหาการต้องส่งโทรศัพท์เครื่องเดียววนไปรอบวงเพื่อเปิดเพลง
                  ทำให้ทุกคนสามารถร่วมสนุกเป็น DJ ได้จากมือถือของตัวเอง
                </p>

                <div className="p-4 bg-zinc-900/50 rounded-lg border border-white/5 mt-4">
                  <h4 className="text-white font-bold flex items-center gap-2 mb-3">
                    <FaCode className="text-blue-400" /> Tech Stack
                  </h4>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li>
                      • <span className="text-white">Next.js</span> - Framework
                      หลักในการพัฒนา
                    </li>
                    <li>
                      • <span className="text-white">Tailwind CSS</span> -
                      ตกแต่งหน้าตาแอป
                    </li>
                    <li>
                      • <span className="text-white">PeerJS (WebRTC)</span> -
                      ระบบรีโมทไร้สายแบบ Real-time
                    </li>
                    <li>
                      • <span className="text-white">YouTube IFrame API</span> -
                      ตัวเล่นเพลงหลัก
                    </li>
                  </ul>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500 mt-4 justify-center">
                  <FaInfoCircle />
                  <span>
                    ใช้งานฟรี 100% ไม่มีโฆษณา ไม่มีการเก็บข้อมูลส่วนตัว
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showWelcomeModal}
        onClose={handleCloseWelcome}
        title="ยินดีต้อนรับสู่ NextJuke"
      >
        <div className="p-3 md:p-6 text-white overflow-y-auto max-h-[80vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-8">
            <div className="bg-zinc-800/50 p-3 md:p-6 rounded-2xl border border-green-500/20 text-center space-y-2 md:space-y-4">
              <FaAndroid className="text-4xl md:text-6xl text-green-500 mx-auto" />
              <h3 className="text-base md:text-xl font-bold text-green-400">
                Android User
              </h3>
              <p className="text-xs md:text-sm text-gray-300 leading-relaxed">
                ระบบจะเล่นเพลงต่อเนื่องอัตโนมัติ <br />
                เพียงแค่แตะ <strong>"เปิดเสียง"</strong> ในเพลงแรกครั้งเดียว
              </p>
              <div className="flex justify-center items-center gap-2">
                <FaCheck className="text-green-500" />
                <span className="text-xs text-green-500">
                  แนะนำสำหรับเปิดจอทิ้งไว้
                </span>
              </div>
            </div>

            <div className="bg-zinc-800/50 p-3 md:p-6 rounded-2xl border border-white/20 text-center space-y-2 md:space-y-4">
              <FaApple className="text-4xl md:text-6xl text-white mx-auto" />
              <h3 className="text-base md:text-xl font-bold text-white">
                iOS User
              </h3>
              <p className="text-xs md:text-sm text-gray-300 leading-relaxed">
                เนื่องจากระบบความปลอดภัยของ iOS <br />
                เสียงเพลงจะถูกปิดอัตโนมัติเมื่อเริ่มเพลงใหม่ <br />
                <strong className="text-pink-400">
                  คุณต้องกดปุ่ม "เปิดเสียง" ทุกครั้ง
                </strong>
              </p>
              <div className="inline-block bg-red-500/20 text-red-300 text-[10px] md:text-xs px-2 md:px-3 py-1 rounded-full">
                ข้อจำกัดของระบบปฏิบัติการ
              </div>
            </div>
          </div>
          <button
            onClick={handleCloseWelcome}
            className="w-full mt-4 md:mt-8 bg-pink-600 hover:bg-pink-500 text-white py-3 md:py-4 rounded-xl font-bold text-sm md:text-lg transition shadow-lg shadow-pink-600/20 sticky bottom-0"
          >
            รับทราบ
          </button>
        </div>
      </Modal>
    </div>
  );
}
