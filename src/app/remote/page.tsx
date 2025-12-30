"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Peer, DataConnection } from "peerjs";
import { Song, Command, User } from "@/types/player";
import {
  FaPlay,
  FaPause,
  FaStop,
  FaStepForward,
  FaPlus,
  FaUser,
  FaLock,
  FaMusic,
  FaCircle,
  FaYoutube,
} from "react-icons/fa";

// แยก Logic หลักมาไว้ใน Component นี้
function RemoteContent() {
  const searchParams = useSearchParams();
  const hostId = searchParams.get("host");

  const [user, setUser] = useState<User | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const [inputUrl, setInputUrl] = useState("");
  const [previewSong, setPreviewSong] = useState<{
    title: string;
    thumb: string;
  } | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [masterId, setMasterId] = useState<string | null>(null);

  const connRef = useRef<DataConnection | null>(null);

  // Login Logic
  useEffect(() => {
    if (!hostId) return;
    const storageKey = `jukebox_user_${hostId}`;
    const savedUser = localStorage.getItem(storageKey);
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setIsJoined(true);
    }
  }, [hostId]);

  const handleJoin = () => {
    if (!usernameInput.trim() || !hostId) return;
    const newUser: User = {
      id: crypto.randomUUID(),
      name: usernameInput,
      isMaster: false,
    };
    localStorage.setItem(`jukebox_user_${hostId}`, JSON.stringify(newUser));
    setUser(newUser);
    setIsJoined(true);
  };

  // Peer Connect
  useEffect(() => {
    if (!hostId || !isJoined || !user) return;
    let peer: Peer;
    const init = async () => {
      const { default: Peer } = await import("peerjs");
      peer = new Peer();
      peer.on("open", () => {
        setStatus("Connecting...");
        const conn = peer.connect(hostId);
        conn.on("open", () => {
          setStatus("Connected");
          connRef.current = conn;
          conn.send({ type: "JOIN", user });
          conn.send({ type: "GET_STATE" });
        });
        conn.on("data", (data: any) => {
          if (data.type === "UPDATE_STATE") {
            setQueue(data.queue);
            setMasterId(data.masterId);
          }
        });
        conn.on("close", () => setStatus("Disconnected"));
      });
    };
    init();
    return () => peer?.destroy();
  }, [hostId, isJoined, user]);

  const send = (cmd: Command) => {
    if (connRef.current?.open) connRef.current.send(cmd);
  };
  const sendAction = (type: "PLAY" | "PAUSE" | "STOP" | "NEXT") => {
    if (user) send({ type, user });
  };

  // Preview Logic
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setInputUrl(url);
    if (url.includes("youtube") || url.includes("youtu.be")) {
      fetch(`https://noembed.com/embed?url=${url}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.title)
            setPreviewSong({ title: d.title, thumb: d.thumbnail_url });
        })
        .catch(() => {});
    } else setPreviewSong(null);
  };

  const handleAddSong = () => {
    if (!inputUrl || !user) return;
    send({ type: "ADD_SONG", url: inputUrl, user });
    setInputUrl("");
    setPreviewSong(null);
  };

  const iAmMaster = user?.id === masterId;

  // --- Login Screen (Glass) ---
  if (!isJoined)
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 bg-[#0f0f11] overflow-hidden">
        {/* Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/40 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/40 rounded-full blur-[100px]" />

        <div className="w-full max-w-sm bg-white/5 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl flex flex-col gap-6 text-center animate-in fade-in zoom-in duration-500">
          <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-blue-500 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-green-500/20">
            <FaMusic className="text-white text-3xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              Jukebox Party
            </h1>
            <p className="text-gray-400 text-sm">Enter your name to join</p>
          </div>
          <input
            type="text"
            placeholder="Your Name"
            className="w-full bg-black/30 border border-white/10 p-4 rounded-xl text-center text-white placeholder:text-gray-500 focus:outline-none focus:border-green-500 transition"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
          />
          <button
            onClick={handleJoin}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:scale-105 active:scale-95 transition text-white p-4 rounded-xl font-bold shadow-lg shadow-green-500/20"
          >
            Start Party
          </button>
        </div>
      </div>
    );

  // --- Main Remote (Glass) ---
  return (
    <div className="min-h-screen bg-[#0f0f11] text-white p-4 md:p-8 flex flex-col gap-6 relative overflow-x-hidden font-sans">
      {/* Background Blobs */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-0 right-0 w-[80%] h-[50%] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[80%] h-[50%] bg-blue-900/20 rounded-full blur-[120px]" />
      </div>

      {/* Header Pill */}
      <div className="flex justify-between items-center bg-white/5 backdrop-blur-md p-2 pl-3 pr-4 rounded-full border border-white/10 shadow-lg mx-auto w-full max-w-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-orange-500 rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
            {user?.name[0].toUpperCase()}
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-sm text-white">{user?.name}</span>
            <span className="text-[10px] text-gray-400 font-mono tracking-wide">
              {iAmMaster ? "👑 DJ MASTER" : "GUEST"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/5">
          <FaCircle
            className={`text-[8px] ${
              status === "Connected"
                ? "text-green-400 animate-pulse"
                : "text-red-500"
            }`}
          />
          <span className="text-[10px] uppercase font-bold text-gray-300">
            {status}
          </span>
        </div>
      </div>

      <div className="max-w-md mx-auto w-full space-y-6 flex-1 flex flex-col">
        {/* Add Song Card */}
        <div className="bg-white/5 backdrop-blur-xl p-5 rounded-3xl border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-wider">
            <FaYoutube className="text-red-500 text-lg" /> Request Song
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputUrl}
              onChange={handleInputChange}
              placeholder="Paste YouTube Link..."
              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-pink-500 focus:bg-black/50 transition placeholder:text-gray-600"
            />
            <button
              onClick={handleAddSong}
              disabled={!previewSong}
              className={`px-5 rounded-xl transition flex items-center justify-center shadow-lg ${
                previewSong
                  ? "bg-pink-500 hover:bg-pink-400 text-white"
                  : "bg-white/10 text-gray-500 cursor-not-allowed"
              }`}
            >
              <FaPlus />
            </button>
          </div>

          {/* Link Preview */}
          {previewSong && (
            <div className="flex gap-3 bg-white/5 p-3 rounded-xl border border-white/10 animate-in fade-in slide-in-from-top-2">
              <img
                src={previewSong.thumb}
                className="w-16 h-12 object-cover rounded-lg shadow-sm"
              />
              <div className="flex-1 overflow-hidden flex flex-col justify-center">
                <p className="text-[10px] text-pink-400 font-bold uppercase">
                  Ready to add
                </p>
                <p className="text-xs font-medium truncate text-gray-200">
                  {previewSong.title}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Master Controls (Conditional) */}
        {iAmMaster ? (
          <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-bottom-4">
            <button
              onClick={() => sendAction("PLAY")}
              className="p-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center gap-2 font-bold transition hover:scale-[1.02] active:scale-95 shadow-lg"
            >
              <FaPlay className="text-green-400" /> Play
            </button>
            <button
              onClick={() => sendAction("PAUSE")}
              className="p-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center gap-2 font-bold transition hover:scale-[1.02] active:scale-95 shadow-lg"
            >
              <FaPause className="text-yellow-400" /> Pause
            </button>
            <button
              onClick={() => sendAction("NEXT")}
              className="col-span-2 p-5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center gap-3 font-bold transition hover:scale-[1.02] active:scale-95 shadow-lg shadow-purple-500/20"
            >
              <FaStepForward /> Next Song
            </button>
            <button
              onClick={() => sendAction("STOP")}
              className="col-span-2 p-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition hover:bg-red-500/20 active:scale-95"
            >
              <FaStop /> Stop Session
            </button>
          </div>
        ) : (
          <div className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 flex flex-col items-center justify-center text-gray-500 gap-3 text-center border-dashed">
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center">
              <FaLock className="text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-300 font-bold">
                DJ Control Locked
              </p>
              <p className="text-xs text-gray-500">
                Only the Master can control playback.
              </p>
            </div>
          </div>
        )}

        {/* Queue List */}
        <div className="flex-1 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden flex flex-col shadow-xl min-h-[300px]">
          <div className="p-4 bg-white/5 border-b border-white/5 font-bold text-xs uppercase flex justify-between items-center text-gray-400 tracking-wider">
            <span>Queue List</span>
            <span className="bg-white/10 px-2 py-0.5 rounded text-white font-mono">
              {queue.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {queue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-2 opacity-50">
                <FaMusic size={32} />
                <p className="text-sm">Queue is empty</p>
              </div>
            ) : (
              queue.map((song, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-black/20 hover:bg-black/40 rounded-xl border border-white/5 flex gap-3 items-center transition group"
                >
                  {song.thumbnail && (
                    <img
                      src={song.thumbnail}
                      className="w-10 h-10 rounded-lg object-cover opacity-80 group-hover:opacity-100 transition"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-gray-200 group-hover:text-white transition">
                      {song.title}
                    </p>
                    <p className="text-[10px] text-gray-500 flex items-center gap-1">
                      <FaUser size={8} /> {song.sender}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Default Export ที่หุ้มด้วย Suspense
export default function RemotePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0f0f11] text-white flex items-center justify-center font-mono animate-pulse">
          Loading Remote...
        </div>
      }
    >
      <RemoteContent />
    </Suspense>
  );
}
