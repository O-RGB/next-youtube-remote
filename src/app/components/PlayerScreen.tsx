"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
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
  FaVolumeUp,
  FaLink,
  FaAndroid,
  FaApple,
  FaCrop,
  FaVolumeMute,
  FaCheck,
} from "react-icons/fa";
import FunToast from "../components/FunToast";
import Modal from "./Modal";

// --- Utility: Format Time ---
const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};

export default function PlayerScreen() {
  // --- State ---
  const [peerId, setPeerId] = useState<string>("");
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
  const [masterId, setMasterId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"dashboard" | "settings">(
    "dashboard"
  );
  const [origin, setOrigin] = useState("");

  // Settings State
  const [videoFit, setVideoFit] = useState(false); // true = ตัดขอบ (Scale Up)

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showNowPlaying, setShowNowPlaying] = useState(false);

  // Interaction & UI State
  const [isUIIdle, setIsUIIdle] = useState(false);
  const uiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "join" | "add" | "info" | "alert";
  } | null>(null);

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

  // Init & Load Settings
  useEffect(() => {
    setOrigin(window.location.origin);

    // Load Master ID
    const savedMaster = localStorage.getItem("jukebox_master_id");
    if (savedMaster) setMasterId(savedMaster);

    // Load Video Fit Setting
    const savedFit = localStorage.getItem("jukebox_video_fit");
    if (savedFit === "true") setVideoFit(true);

    // Check Welcome Modal
    const hasSeenWelcome = localStorage.getItem("jukebox_has_seen_welcome");
    if (!hasSeenWelcome) {
      setShowWelcomeModal(true);
    }
  }, []);

  const handleCloseWelcome = () => {
    setShowWelcomeModal(false);
    localStorage.setItem("jukebox_has_seen_welcome", "true");
    // Try to unmute immediately after interaction
    if (playerRef.current) {
      playerRef.current.unMute();
    }
  };

  const toggleVideoFit = () => {
    const newVal = !videoFit;
    setVideoFit(newVal);
    localStorage.setItem("jukebox_video_fit", String(newVal));
  };

  // --- UI Auto Shrink Logic ---
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
      if (playerRef.current) playerRef.current.loadVideoById(nextSong.id);
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
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  const onReady = (event: { target: YouTubePlayer }) => {
    playerRef.current = event.target;
    event.target.unMute();
    event.target.setVolume(100);
  };

  const onStateChange = (e: any) => {
    if (e.data === 1) {
      setIsPlaying(true);
      setNeedsInteraction(false);
    }
    if (e.data === 2) setIsPlaying(false);
    if (e.data === 0) playNext();

    if ((e.data === -1 || e.data === 5) && currentSong) {
      setTimeout(() => {
        if (playerRef.current) {
          const state = playerRef.current.getPlayerState();
          if (state !== 1 && state !== 3) {
            setNeedsInteraction(true);
          }
        }
      }, 1000);
    }
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

      {/* --- Unmute / Interaction Overlay --- */}
      {needsInteraction && currentSong && (
        <div
          onClick={() => {
            playerRef.current?.unMute();
            playerRef.current?.playVideo();
            setNeedsInteraction(false);
          }}
          className="absolute inset-0 z-[60] bg-black/60 flex flex-col items-center justify-center cursor-pointer animate-in fade-in duration-300"
        >
          <div className="bg-white text-black p-6 rounded-full shadow-[0_0_50px_rgba(255,255,255,0.4)] animate-pulse">
            <FaPlay size={40} className="pl-1" />
          </div>
          <p className="mt-6 text-2xl font-bold tracking-widest uppercase">
            แตะเพื่อเล่นเพลง
          </p>
        </div>
      )}

      {/* --- Header (Top Bar) --- */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 transition-all duration-500 ease-in-out border-b border-zinc-800 bg-black
            ${
              isUIIdle
                ? "h-12 opacity-80 translate-y-[-10%]"
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

        {/* Status Indicator */}
        <div
          className="flex items-center gap-3 transition-transform duration-500 origin-right"
          style={{ transform: isUIIdle ? "scale(0.8)" : "scale(1)" }}
        >
          <button
            onClick={() => {
              playerRef.current?.unMute();
              showToast("เปิดเสียงแล้ว", "info");
            }}
            className="md:hidden p-2 text-gray-400 hover:text-white"
          >
            <FaVolumeUp />
          </button>
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

      {/* --- Content --- */}
      <div className="flex-1 relative w-full bg-black flex items-center justify-center overflow-hidden">
        {/* YouTube Wrapper for Scaling/Cropping */}
        <div
          className={`w-full h-full relative transition-transform duration-700 ease-in-out ${
            videoFit ? "scale-[1.35]" : "scale-100"
          } ${showQR ? "opacity-20 !scale-95" : "opacity-100"}`}
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
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        </div>

        {/* QR Code */}
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

        {/* Now Playing Popup */}
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

      {/* --- Footer Control Bar --- */}
      <footer
        className={`fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-zinc-800 transition-all duration-500 ease-in-out flex items-center gap-6
        ${
          isUIIdle
            ? "h-16 px-8 opacity-20 translate-y-0 hover:opacity-100" // ปรับ opacity 0.2 ตอน idle
            : "h-24 px-4 md:px-10 opacity-100 translate-y-0"
        }`}
      >
        <div className="flex items-center gap-4 transition-all duration-500">
          <button
            onClick={() =>
              isPlaying
                ? playerRef.current?.pauseVideo()
                : playerRef.current?.playVideo()
            }
            className={`rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition shadow-lg shadow-white/10
                ${isUIIdle ? "w-8 h-8" : "w-12 h-12"}`} // ลดขนาดปุ่ม Play ให้เล็กลงตอน idle (8x4 = 32px)
          >
            {isPlaying ? (
              <FaPause size={isUIIdle ? 12 : 16} />
            ) : (
              <FaPlay className="ml-1" size={isUIIdle ? 12 : 16} />
            )}
          </button>
          <button
            onClick={() => playNext()}
            className="text-gray-400 hover:text-white p-2 hover:scale-110 transition"
          >
            <FaStepForward size={isUIIdle ? 18 : 20} />
          </button>
        </div>

        {/* Time & Progress */}
        <div
          className={`flex-1 flex items-center gap-4 transition-all duration-500 ${
            isUIIdle ? "opacity-0 blur-sm pointer-events-none" : "opacity-100"
          }`}
        >
          <span className="text-xs font-mono text-gray-500 w-10 text-right">
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden relative group">
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
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
          </div>
          <span className="text-xs font-mono text-gray-500 w-10">
            {formatTime(duration)}
          </span>
        </div>

        {/* Tools */}
        <div
          className={`flex items-center gap-2 border-l border-zinc-800 pl-4 transition-all duration-500 ${
            isUIIdle ? "scale-90" : "scale-100"
          }`}
        >
          <button
            onClick={toggleFullscreen}
            className="text-gray-400 hover:text-white p-2"
          >
            <FaExpand />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-gray-400 hover:text-white p-2"
          >
            <FaCog />
          </button>
        </div>
      </footer>

      {/* Settings Modal (Updated with Tabs) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          <div className="flex gap-4 text-base">
            <button
              onClick={() => setSettingsTab("dashboard")}
              className={`pb-1 ${
                settingsTab === "dashboard"
                  ? "text-white border-b-2 border-pink-500 font-bold"
                  : "text-gray-500"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setSettingsTab("settings")}
              className={`pb-1 ${
                settingsTab === "settings"
                  ? "text-white border-b-2 border-pink-500 font-bold"
                  : "text-gray-500"
              }`}
            >
              Settings
            </button>
          </div>
        }
      >
        <div className="p-4 text-white">
          {settingsTab === "dashboard" ? (
            // --- Dashboard Tab ---
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
          ) : (
            // --- Settings Tab ---
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-zinc-800/50 rounded-xl p-6 flex flex-col gap-6">
                {/* Crop / Scale Option */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-3 items-center">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <FaCrop />
                    </div>
                    <div>
                      <h4 className="font-bold">ตัดขอบวิดีโอ (Fill Screen)</h4>
                      <p className="text-xs text-gray-400">
                        ขยายวิดีโอให้เต็มจอโทรศัพท์ (ตัดขอบดำออก)
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

                <div className="h-px bg-white/5" />

                {/* Unmute Option */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-3 items-center">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
                      <FaVolumeMute />
                    </div>
                    <div>
                      <h4 className="font-bold">แก้ไขปัญหาเสียงหาย</h4>
                      <p className="text-xs text-gray-400">
                        หากวิดีโอเล่นแต่ไม่มีเสียง ให้กดปุ่มนี้
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (playerRef.current) {
                        playerRef.current.unMute();
                        playerRef.current.setVolume(100);
                        showToast("เปิดเสียงแล้ว", "info");
                      }
                    }}
                    className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
                  >
                    เปิดเสียง (Unmute)
                  </button>
                </div>
              </div>

              <div className="text-center text-xs text-gray-500 mt-4">
                NextJuke Settings v1.1
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Welcome / Info Modal */}
      <Modal
        isOpen={showWelcomeModal}
        onClose={handleCloseWelcome}
        title="ข้อแนะนำการใช้งาน"
      >
        <div className="p-6 text-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Android Info */}
            <div className="bg-zinc-800/50 p-6 rounded-2xl border border-green-500/20 text-center space-y-4">
              <FaAndroid className="text-6xl text-green-500 mx-auto" />
              <h3 className="text-xl font-bold text-green-400">Android User</h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                บน Android ส่วนใหญ่สามารถทำงานได้ปกติ <br />
                เพียงแค่แตะ <strong>
                  "เปิดเสียง"
                </strong> หรือแตะหน้าจอครั้งแรก <br />
                ระบบจะสามารถ Autoplay เพลงถัดไปได้อัตโนมัติ
              </p>
              <div className="flex justify-center">
                <FaCheck className="text-green-500" />{" "}
                <span className="text-xs ml-2 text-green-500">
                  แนะนำสำหรับเปิดจอทิ้งไว้
                </span>
              </div>
            </div>

            {/* iOS Info */}
            <div className="bg-zinc-800/50 p-6 rounded-2xl border border-gray-500/20 text-center space-y-4">
              <FaApple className="text-6xl text-white mx-auto" />
              <h3 className="text-xl font-bold text-white">iOS / iPad User</h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                เนื่องจากนโยบายความปลอดภัยของ Apple <br />
                <strong>
                  เสียงอาจจะถูกปิด (Mute)
                </strong> ทุกครั้งที่เปลี่ยนเพลง <br />
                คุณอาจจะต้องคอยกดปุ่มเปิดเสียงด้วยตัวเอง
              </p>
              <div className="inline-block bg-red-500/20 text-red-300 text-xs px-3 py-1 rounded-full">
                ต้องกดเปิดเสียงทุกครั้ง
              </div>
            </div>
          </div>
          <button
            onClick={handleCloseWelcome}
            className="w-full mt-8 bg-pink-600 hover:bg-pink-500 text-white py-4 rounded-xl font-bold text-lg transition shadow-lg shadow-pink-600/20"
          >
            รับทราบ และเริ่มปาร์ตี้!
          </button>
        </div>
      </Modal>
    </div>
  );
}
