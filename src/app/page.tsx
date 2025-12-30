"use client";

import React, { useState } from "react";
import {
  FaQrcode,
  FaUsers,
  FaYoutube,
  FaRocket,
  FaMusic,
  FaArrowRight,
} from "react-icons/fa";
import PlayerScreen from "./components/PlayerScreen";

export default function Home() {
  const [isStarted, setIsStarted] = useState(false);

  // ถ้าเริ่มแอปแล้ว ให้แสดง PlayerScreen ทับไปเลย (SPA Mode)
  if (isStarted) {
    return <PlayerScreen />;
  }

  // หน้า Landing (ก่อนกดเริ่ม)
  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-pink-500 selection:text-white">
      {/* Navbar */}
      <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-orange-500">
          NextJuke
        </div>
        <button
          onClick={() => setIsStarted(true)}
          className="bg-white text-black px-6 py-2 rounded-full font-bold hover:scale-105 transition"
        >
          เปิด Player
        </button>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-8 max-w-4xl mx-auto animate-in fade-in duration-700">
        <div className="space-y-4">
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-tight">
            เปลี่ยนทุกหน้าจอ <br />
            เป็น{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-orange-500">
              Party Jukebox.
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            สร้างห้องปาร์ตี้ แชร์ QR Code แล้วให้เพื่อนๆ
            ช่วยกันเลือกเพลงผ่านมือถือ ไม่ต้องโหลดแอป ไม่ต้องล็อกอิน
          </p>
        </div>

        <button
          onClick={() => setIsStarted(true)}
          className="group relative inline-flex items-center justify-center gap-3 bg-pink-600 hover:bg-pink-500 text-white px-8 py-4 rounded-full text-xl font-bold transition-all hover:shadow-[0_0_40px_rgba(236,72,153,0.6)]"
        >
          <FaRocket /> เริ่มปาร์ตี้เลย
          <span className="absolute inset-0 rounded-full ring-2 ring-white/20 group-hover:ring-white/40 animate-pulse"></span>
        </button>

        <div className="w-full mt-24 mb-10 p-1">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 to-purple-900 border border-white/10 p-8 sm:p-12 text-left flex flex-col sm:flex-row items-center justify-between gap-8 group">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

            <div className="space-y-4 relative z-10 max-w-xl">
              <div className="flex items-center gap-3 text-indigo-300 font-bold uppercase tracking-wider text-sm">
                <FaMusic /> แนะนำเพื่อนบ้าน
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white">
                NextKaraoke
              </h2>
              <p className="text-gray-300 text-lg leading-relaxed">
                อีกหนึ่งทางเลือกสำหรับสายร้อง! แอปเล่นคาราโอเกะบนเว็บ รองรับไฟล์{" "}
                <span className="text-white font-bold">MIDI, EMK, NCN</span>{" "}
                เต็มรูปแบบ
              </p>
            </div>

            <a
              href="https://next-karaoke.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 shrink-0 bg-white text-indigo-900 px-8 py-4 rounded-full font-bold text-lg flex items-center gap-2 hover:bg-indigo-50 hover:scale-105 transition shadow-xl"
            >
              ลองดูไหม <FaArrowRight />
            </a>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full mt-16 text-left">
          <FeatureCard
            icon={<FaYoutube className="text-red-500" />}
            title="YouTube Powered"
            desc="ค้นหาและเล่นเพลงจาก YouTube ได้นับล้านเพลงทันที"
          />
          <FeatureCard
            icon={<FaQrcode className="text-blue-500" />}
            title="เข้าใช้งานง่าย"
            desc="เพื่อนสแกน QR Code แล้วเข้าร่วมได้เลย ไม่ต้องสมัครสมาชิก"
          />
          <FeatureCard
            icon={<FaUsers className="text-purple-500" />}
            title="ระบบคิวเพลง"
            desc="ทุกคนมีสิทธิ์เลือกเพลง โดยมี Master DJ คอยดูแลความเรียบร้อย"
          />
        </div>

        {/* --- เพิ่มส่วนแนะนำ NextKaraoke --- */}
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-gray-600 text-sm">
        NextJuke © {new Date().getFullYear()} - Built with Next.js
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl hover:bg-zinc-900 transition hover:border-zinc-700">
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-400 leading-relaxed text-sm">{desc}</p>
    </div>
  );
}
