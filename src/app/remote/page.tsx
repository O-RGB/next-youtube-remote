"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Peer, DataConnection } from "peerjs";
import { Song, Command, User } from "@/types/player";
import {
  FaPlay,
  FaPause,
  FaStepForward,
  FaPlus,
  FaList,
  FaYoutube,
  FaStop,
} from "react-icons/fa";
import Modal from "../components/Modal";

// [CONFIG] ใช้ Config เดียวกันกับหน้า Player เพื่อให้เจาะ Network เดียวกันได้
const peerConfig = {
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
    ],
  },
};

function RemoteContent() {
  const searchParams = useSearchParams();
  const hostId = searchParams.get("host");

  const [user, setUser] = useState<User | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [status, setStatus] = useState("กำลังเริ่มต้น...");
  const [inputUrl, setInputUrl] = useState("");
  const [previewSong, setPreviewSong] = useState<{
    title: string;
    thumb: string;
  } | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [masterId, setMasterId] = useState<string | null>(null);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const connRef = useRef<DataConnection | null>(null);

  useEffect(() => {
    if (!hostId) return;
    const saved = localStorage.getItem(`jukebox_user_${hostId}`);
    if (saved) {
      setUser(JSON.parse(saved));
      setIsJoined(true);
    }
  }, [hostId]);

  const handleJoin = () => {
    if (!usernameInput.trim() || !hostId) return;
    const newUser = {
      id: crypto.randomUUID(),
      name: usernameInput,
      isMaster: false,
    };
    localStorage.setItem(`jukebox_user_${hostId}`, JSON.stringify(newUser));
    setUser(newUser);
    setIsJoined(true);
  };

  useEffect(() => {
    if (!hostId || !isJoined || !user) return;
    let peer: Peer;
    const init = async () => {
      const { default: Peer } = await import("peerjs");

      // [UPDATED] ใส่ Config ที่นี่ด้วย
      peer = new Peer(peerConfig);

      peer.on("open", () => {
        setStatus("กำลังเชื่อมต่อ...");
        const conn = peer.connect(hostId);
        conn.on("open", () => {
          setStatus("เชื่อมต่อแล้ว");
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
        conn.on("close", () => setStatus("หลุดการเชื่อมต่อ"));
      });

      // Handle Errors
      peer.on("error", (err) => {
        console.error(err);
        setStatus("เชื่อมต่อล้มเหลว (ลอง Refresh ใหม่)");
      });
    };
    init();
    return () => peer?.destroy();
  }, [hostId, isJoined, user]);

  const send = (cmd: Command) =>
    connRef.current?.open && connRef.current.send(cmd);
  const sendAction = (type: "PLAY" | "PAUSE" | "STOP" | "NEXT") =>
    user && send({ type, user });
  const iAmMaster = user?.id === masterId;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setInputUrl(url);
    if (url.includes("youtu")) {
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
    setToast("ส่งเพลงแล้ว!");
    setTimeout(() => setToast(null), 2000);
  };

  if (!isJoined)
    return (
      <div className="fixed inset-0 bg-[#0f0f11] flex flex-col items-center justify-center p-6 overflow-hidden">
        <div className="w-full max-w-sm bg-white/10 backdrop-blur-lg p-8 rounded-3xl border border-white/10 text-center space-y-6">
          <h1 className="text-2xl font-bold text-white">เข้าร่วมปาร์ตี้</h1>
          <input
            className="w-full bg-black/40 border border-white/20 p-4 rounded-xl text-center text-white outline-none focus:border-green-500 transition"
            placeholder="ใส่ชื่อของคุณ"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
          />
          <button
            onClick={handleJoin}
            className="w-full bg-green-600 text-white p-4 rounded-xl font-bold shadow-lg shadow-green-600/20 active:scale-95 transition"
          >
            เข้าห้อง
          </button>
        </div>
      </div>
    );

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0f0f11] text-white overflow-hidden font-sans">
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-2 rounded-full shadow-lg z-50 animate-bounce">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="shrink-0 p-4 flex justify-between items-center bg-black/20 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-orange-500 flex items-center justify-center font-bold text-lg shadow-inner border border-white/10">
            {user?.name[0].toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">{user?.name}</div>
            <div className="text-[10px] text-gray-400 font-mono">
              {iAmMaster ? "👑 DJ MASTER" : "ผู้ร่วมงาน"}
            </div>
          </div>
        </div>
        <div
          className={`text-[10px] px-2 py-1 rounded-full border ${
            status === "เชื่อมต่อแล้ว"
              ? "bg-green-500/10 border-green-500 text-green-500"
              : "bg-red-500/10 border-red-500 text-red-500"
          }`}
        >
          {status}
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
        {/* Request Box */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
            <FaYoutube className="text-red-500 text-lg" /> ขอเพลง (YouTube)
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputUrl}
              onChange={handleInputChange}
              placeholder="วางลิงก์ YouTube ที่นี่..."
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-pink-500 outline-none transition"
            />
            <button
              onClick={handleAddSong}
              disabled={!previewSong}
              className={`w-12 flex items-center justify-center rounded-xl transition ${
                previewSong
                  ? "bg-pink-500 text-white"
                  : "bg-white/10 text-gray-500"
              }`}
            >
              <FaPlus />
            </button>
          </div>
          {previewSong && (
            <div className="flex gap-3 bg-black/30 p-2 rounded-lg border border-white/5 animate-in slide-in-from-top-2">
              <img
                src={previewSong.thumb}
                className="w-12 h-9 object-cover rounded"
              />
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <p className="text-xs font-bold truncate text-white">
                  {previewSong.title}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Master Controls */}
        {iAmMaster ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => sendAction("PLAY")}
              className="bg-zinc-800 hover:bg-zinc-700 p-6 rounded-2xl flex flex-col items-center gap-2 transition active:scale-95 border border-white/5"
            >
              <FaPlay className="text-green-400 text-2xl" />{" "}
              <span className="text-xs font-bold">เล่น</span>
            </button>
            <button
              onClick={() => sendAction("PAUSE")}
              className="bg-zinc-800 hover:bg-zinc-700 p-6 rounded-2xl flex flex-col items-center gap-2 transition active:scale-95 border border-white/5"
            >
              <FaPause className="text-yellow-400 text-2xl" />{" "}
              <span className="text-xs font-bold">หยุดชั่วคราว</span>
            </button>
            <button
              onClick={() => sendAction("NEXT")}
              className="col-span-2 bg-gradient-to-r from-blue-600 to-purple-600 p-4 rounded-2xl flex items-center justify-center gap-3 font-bold shadow-lg active:scale-95 transition"
            >
              <FaStepForward /> เล่นเพลงถัดไป
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-white/5 rounded-2xl p-6">
            <p className="text-sm">รอ Master DJ ควบคุมเพลง</p>
          </div>
        )}
      </div>

      <div className="shrink-0 p-4 pb-8 bg-black/40 backdrop-blur-md border-t border-white/5 grid grid-cols-2 gap-4">
        <button
          onClick={() => setShowQueueModal(true)}
          className="bg-white/10 hover:bg-white/20 p-3 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition"
        >
          <FaList /> ดูคิวเพลง ({queue.length})
        </button>
        {iAmMaster && (
          <button
            onClick={() => sendAction("STOP")}
            className="bg-red-500/10 text-red-400 hover:bg-red-500/20 p-3 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition"
          >
            <FaStop /> จบปาร์ตี้
          </button>
        )}
      </div>

      {/* Queue Modal */}
      <Modal
        isOpen={showQueueModal}
        onClose={() => setShowQueueModal(false)}
        title="รายการคิวเพลง"
      >
        <div className="p-4 bg-zinc-900 min-h-[50vh]">
          {queue.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              ยังไม่มีเพลงในคิว
            </div>
          ) : (
            queue.map((s, i) => (
              <div
                key={i}
                className="flex gap-3 items-center p-3 border-b border-white/5"
              >
                <span className="text-gray-500 font-mono text-xs w-6">
                  {i + 1}
                </span>
                {s.thumbnail && (
                  <img
                    src={s.thumbnail}
                    className="w-10 h-10 rounded object-cover opacity-70"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {s.title}
                  </div>
                  <div className="text-xs text-gray-500">โดย {s.sender}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}

export default function RemotePage() {
  return (
    <Suspense
      fallback={
        <div className="bg-black text-white h-screen flex items-center justify-center">
          กำลังโหลด...
        </div>
      }
    >
      <RemoteContent />
    </Suspense>
  );
}
