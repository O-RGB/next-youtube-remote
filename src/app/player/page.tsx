"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import YouTube, { YouTubePlayer } from "react-youtube";
import type { Peer, DataConnection } from "peerjs";
import QRCode from "react-qr-code";
import { Song, Command, User } from "@/types/player";
import {
  FaWifi,
  FaPlay,
  FaPause,
  FaStop,
  FaStepForward,
  FaUserAstronaut,
  FaCrown,
  FaMusic,
  FaQrcode,
  FaLink,
  FaCog,
  FaExpand,
  FaCompress,
  FaCompactDisc,
} from "react-icons/fa";
import Modal from "../components/Modal";

// --- Utility: Format Time ---
const formatTime = (seconds: number) => {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};

// --- Toast Component ---
const FunToast = ({
  message,
  type,
}: {
  message: string;
  type: "join" | "add" | "info" | "alert";
}) => {
  const styles = {
    join: "bg-blue-600 border-blue-500",
    add: "bg-green-600 border-green-500",
    info: "bg-purple-600 border-purple-500",
    alert: "bg-red-600 border-red-500",
  };
  return (
    <div
      className={`fixed top-24 right-5 ${styles[type]} text-white px-6 py-3 rounded-xl border shadow-2xl animate-bounce flex items-center gap-3 z-[60]`}
    >
      <span className="font-bold">{message}</span>
    </div>
  );
};

export default function PlayerPage() {
  // --- State ---
  const [peerId, setPeerId] = useState<string>("");
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
  const [masterId, setMasterId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [origin, setOrigin] = useState("");

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNowPlaying, setShowNowPlaying] = useState(false);

  // --- UI Visibility Logic (Focus Mode) ---
  const [isUIActive, setIsUIActive] = useState(true);
  const uiTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Interaction
  const [toast, setToast] = useState<{
    msg: string;
    type: "join" | "add" | "info" | "alert";
  } | null>(null);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  // Refs
  const playerRef = useRef<YouTubePlayer | null>(null);
  const queueRef = useRef<Song[]>([]);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const usersRef = useRef<User[]>([]);
  const masterIdRef = useRef<string | null>(null);
  const currentSongRef = useRef<Song | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  // Sync Refs
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

  // Init
  useEffect(() => {
    setOrigin(window.location.origin);
    const savedMaster = localStorage.getItem("jukebox_master_id");
    if (savedMaster) setMasterId(savedMaster);

    const isIosDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIosDevice);
  }, []);

  // --- UI Auto Hide Logic (Desktop Mouse Move) ---
  const handleMouseMove = useCallback(() => {
    setIsUIActive(true);
    if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
    uiTimeoutRef.current = setTimeout(() => {
      if (!isModalOpen) {
        setIsUIActive(false);
      }
    }, 3000);
  }, [isModalOpen]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    handleMouseMove();
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
    };
  }, [handleMouseMove]);

  // --- Mobile Toggle Logic ---
  const handleScreenTap = () => {
    setIsUIActive((prev) => !prev);
    if (!isUIActive) {
      handleMouseMove();
    }
  };

  // Now Playing Popup
  useEffect(() => {
    if (currentSong) {
      setShowNowPlaying(true);
      const timer = setTimeout(() => setShowNowPlaying(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setShowNowPlaying(false);
    }
  }, [currentSong]);

  // Progress Bar
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
    setTimeout(() => setToast(null), 4000);
  };

  // PeerJS
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

  // Commands
  const isMaster = (userId?: string) => userId === masterIdRef.current;
  const promoteToMaster = (user: User) => {
    setMasterId(user.id);
    localStorage.setItem("jukebox_master_id", user.id);
    showToast(`${user.name} is now the DJ Master!`, "info");
  };

  const handleCommand = (cmd: Command, conn: DataConnection) => {
    switch (cmd.type) {
      case "JOIN":
        const newUser = { ...cmd.user };
        if (newUser.id === localStorage.getItem("jukebox_master_id")) {
          newUser.isMaster = true;
          if (masterIdRef.current !== newUser.id) setMasterId(newUser.id);
          showToast(`Welcome back Master ${newUser.name}!`, "info");
        }
        setConnectedUsers((prev) => {
          const clean = prev.filter((u) => u.id !== newUser.id);
          return [...clean, newUser];
        });
        connectionsRef.current.set(conn.peer, conn);
        if (!newUser.isMaster) showToast(`${newUser.name} joined`, "join");
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
                if (
                  !currentSongRef.current &&
                  prev.length === 0 &&
                  playerRef.current
                ) {
                  setTimeout(() => playNext(newQueue), 500);
                }
                return newQueue;
              });
              showToast(`${cmd.user.name} added: ${newSong.title}`, "add");
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

  const playNext = (overrideQueue?: Song[]) => {
    const currentQueue = overrideQueue || queueRef.current;
    if (currentQueue.length > 0) {
      const [nextSong, ...remainingQueue] = currentQueue;
      setQueue(remainingQueue);
      setCurrentSong(nextSong);
      setIsPlaying(true);
      if (isIOS) {
        setNeedsInteraction(true);
        playerRef.current?.cueVideoById(nextSong.id);
      } else {
        playerRef.current?.loadVideoById(nextSong.id);
        playerRef.current?.playVideo();
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
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    playerRef.current?.seekTo(time, true);
  };

  const onReady = (event: { target: YouTubePlayer }) => {
    playerRef.current = event.target;
    event.target.unMute();
    event.target.setVolume(100);
  };

  const onStateChange = (e: any) => {
    if (e.data === 1) setIsPlaying(true);
    if (e.data === 2) setIsPlaying(false);
    if (e.data === 0) playNext();
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
    <div className="h-screen w-screen flex flex-col bg-black text-white font-sans overflow-hidden">
      {toast && <FunToast message={toast.msg} type={toast.type} />}

      {/* --- Header --- */}
      <header
        style={{ height: isUIActive ? "64px" : "0px" }}
        className="flex-shrink-0 bg-black border-b border-zinc-800 flex items-center justify-between px-6 shadow-md transition-[height] duration-500 ease-in-out overflow-hidden z-50"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-orange-400 rounded-lg flex items-center justify-center shadow-lg shadow-pink-500/20">
            <FaCompactDisc className="text-white animate-spin-slow" />
          </div>
          <h1 className="font-bold text-lg tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 whitespace-nowrap">
            JUKEBOX PARTY
          </h1>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-gray-400 whitespace-nowrap">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700">
            <span
              className={`w-2 h-2 rounded-full ${
                peerId
                  ? "bg-green-500 shadow-[0_0_10px_#22c55e]"
                  : "bg-red-500 animate-pulse"
              }`}
            ></span>
            {peerId ? "ONLINE" : "CONNECTING"}
          </div>
        </div>
      </header>

      {/* --- Middle Content --- */}
      <div
        className="flex-1 relative w-full bg-black flex items-center justify-center overflow-hidden"
        onClick={handleScreenTap}
      >
        {needsInteraction && isIOS && (
          <div
            className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center cursor-pointer backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              setNeedsInteraction(false);
              playerRef.current?.playVideo();
            }}
          >
            <FaPlay className="text-white/80 w-20 h-20 drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]" />
            <p className="mt-4 text-xl font-light tracking-widest">
              TAP TO START
            </p>
          </div>
        )}

        {/* Video Player Container */}
        <div
          className={`w-full h-full relative transition-all duration-1000 ${
            showQR ? "opacity-10 scale-95 blur-sm" : "opacity-100 scale-100"
          }`}
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
                fs: 0, // ปิดปุ่ม Fullscreen ของ YouTube
                iv_load_policy: 3, // ปิด Annotations
                playsinline: 1, // เล่นในกรอบสำหรับ iOS
              },
            }}
            onReady={onReady}
            onStateChange={onStateChange}
            // *** เพิ่ม pointer-events-none ตรงนี้เพื่อปิดการรับเมาส์ทั้งหมด ***
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        </div>

        {/* QR Code Screen */}
        {showQR && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 pointer-events-none">
            <div className="flex flex-col items-center gap-6 p-8 rounded-3xl bg-zinc-900/90 border border-zinc-700 shadow-2xl animate-in fade-in zoom-in duration-500 max-w-sm w-full pointer-events-auto">
              <h2 className="text-3xl font-bold text-white drop-shadow-md text-center">
                Join the Party
              </h2>
              <div className="p-4 bg-white rounded-2xl shadow-inner">
                {origin && peerId ? (
                  <QRCode
                    value={remoteUrl}
                    size={180}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    viewBox={`0 0 256 256`}
                  />
                ) : (
                  <div className="w-[180px] h-[180px] bg-gray-200 animate-pulse rounded-lg flex items-center justify-center text-black/20 text-xs">
                    Loading QR...
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 bg-black px-4 py-3 rounded-xl w-full border border-zinc-800">
                <FaLink className="text-pink-500 shrink-0" />
                <span className="font-mono text-xs text-gray-300 truncate text-center flex-1">
                  {remoteUrl || "Generating link..."}
                </span>
              </div>
              <p className="text-gray-400 text-sm animate-pulse">
                Scan to start adding songs
              </p>
            </div>
          </div>
        )}

        {/* Now Playing Overlay */}
        {showNowPlaying && currentSong && !showQR && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none animate-in fade-in zoom-in duration-300">
            <div className="bg-black/80 backdrop-blur-md p-8 rounded-3xl border border-zinc-700 shadow-2xl flex flex-col items-center text-center max-w-2xl mx-4 gap-4">
              {currentSong.thumbnail && (
                <img
                  src={currentSong.thumbnail}
                  className="w-32 h-32 rounded-2xl shadow-lg object-cover border border-zinc-600"
                />
              )}
              <div>
                <h2 className="text-2xl md:text-4xl font-bold text-white mb-2 line-clamp-2 leading-tight">
                  {currentSong.title}
                </h2>
                <div className="flex items-center justify-center gap-2 text-pink-400 font-medium text-lg bg-pink-500/10 px-4 py-1 rounded-full w-fit mx-auto border border-pink-500/20">
                  <FaUserAstronaut /> <span>{currentSong.sender}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- Footer Control Bar --- */}
      <footer
        style={{ height: isUIActive ? "96px" : "0px" }}
        className="flex-shrink-0 bg-black border-t border-zinc-800 z-50 flex items-center px-4 md:px-10 gap-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-[height] duration-500 ease-in-out overflow-hidden"
      >
        {/* Play/Pause/Stop/Next */}
        <div className="flex items-center gap-4 text-white">
          <button
            onClick={() =>
              isPlaying
                ? playerRef.current?.pauseVideo()
                : playerRef.current?.playVideo()
            }
            className="w-12 h-12 flex items-center justify-center rounded-full bg-white text-black hover:scale-110 transition shadow-lg"
          >
            {isPlaying ? <FaPause /> : <FaPlay className="ml-1" />}
          </button>
          <button
            onClick={handleStop}
            className="text-gray-400 hover:text-red-400 transition hover:scale-110 p-2"
          >
            <FaStop size={18} />
          </button>
          <button
            onClick={() => playNext()}
            className="text-gray-400 hover:text-white transition hover:scale-110 p-2"
          >
            <FaStepForward size={20} />
          </button>
        </div>

        {/* Time & Progress */}
        <div className="flex-1 flex items-center gap-4">
          <span className="text-xs font-mono text-gray-400 w-10 text-right">
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 relative h-10 flex items-center group">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-pink-500 hover:accent-pink-400 focus:outline-none z-10"
            />
          </div>
          <span className="text-xs font-mono text-gray-400 w-10">
            {formatTime(duration)}
          </span>
        </div>

        {/* Tools */}
        <div className="flex items-center gap-4 border-l border-zinc-800 pl-6">
          <button
            onClick={toggleFullscreen}
            className="text-gray-400 hover:text-white transition p-2"
          >
            {isFullscreen ? <FaCompress size={18} /> : <FaExpand size={18} />}
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className={`text-gray-400 hover:text-white transition p-2 ${
              isModalOpen ? "rotate-90 text-white" : ""
            }`}
          >
            <FaCog size={20} />
          </button>
        </div>
      </footer>

      {/* Settings Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          <>
            <FaMusic className="text-pink-500" />{" "}
            <span className="text-white">Room Dashboard</span>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-800 bg-[#121214] h-[60vh] text-white">
          {/* Col 1: Connection */}
          <div className="p-6 flex flex-col items-center justify-center bg-zinc-900/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-orange-500"></div>
            <h3 className="text-gray-400 font-bold mb-6 text-xs tracking-[0.2em] flex items-center gap-2">
              <FaQrcode /> JOIN PARTY
            </h3>
            <div className="bg-white p-3 rounded-xl shadow-lg w-40 h-40 flex items-center justify-center">
              {origin && peerId ? (
                <QRCode value={remoteUrl} size={140} />
              ) : (
                <div className="animate-pulse text-black">...</div>
              )}
            </div>
            <div className="mt-6 bg-black px-4 py-2 rounded-lg flex items-center gap-2 w-full max-w-[220px] border border-zinc-800">
              <FaLink className="text-pink-500" />
              <div className="text-[10px] font-mono text-gray-400 truncate">
                {remoteUrl}
              </div>
            </div>
          </div>

          {/* Col 2: Queue */}
          <div className="p-6 flex flex-col bg-transparent">
            <h3 className="text-pink-400 font-bold mb-4 text-xs tracking-[0.2em] uppercase">
              Up Next ({queue.length})
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600 text-sm italic">
                  <FaMusic className="mb-2 text-2xl opacity-20" />
                  Queue is empty
                </div>
              ) : (
                queue.map((q, i) => (
                  <div
                    key={i}
                    className="bg-zinc-800/50 hover:bg-zinc-800 p-3 rounded-lg flex justify-between items-center border border-zinc-800 transition group"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="text-zinc-500 font-mono text-xs">
                        {i + 1}
                      </span>
                      <span className="truncate text-sm text-zinc-300 group-hover:text-white transition">
                        {q.title}
                      </span>
                    </div>
                    <span className="text-[10px] bg-black/50 px-2 py-1 rounded text-zinc-400 ml-2 whitespace-nowrap border border-zinc-700">
                      {q.sender}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Col 3: Users */}
          <div className="p-6 flex flex-col bg-zinc-900/50">
            <h3 className="text-blue-400 font-bold mb-4 text-xs tracking-[0.2em] uppercase flex items-center gap-2">
              <FaWifi /> Connected ({connectedUsers.length})
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {connectedUsers.map((u) => (
                <div
                  key={u.id}
                  onClick={() => promoteToMaster(u)}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition border border-transparent hover:border-zinc-700 ${
                    u.id === masterId
                      ? "bg-green-900/20 border-green-500/20"
                      : "hover:bg-zinc-800"
                  }`}
                >
                  <span className="flex items-center gap-3 font-medium text-sm text-zinc-200">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-lg ${
                        u.id === masterId
                          ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white"
                          : "bg-zinc-700 text-zinc-300"
                      }`}
                    >
                      {u.name[0].toUpperCase()}
                    </div>
                    {u.name}
                  </span>
                  {u.id === masterId && (
                    <FaCrown className="text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]" />
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-zinc-500 mt-4 text-center border-t border-zinc-800 pt-4">
              Tap a user to make them DJ
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
