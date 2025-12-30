"use client";
import React, { useEffect, useState, useRef } from "react";
import {
  FaInfoCircle,
  FaCheckCircle,
  FaMusic,
  FaExclamationCircle,
} from "react-icons/fa";

interface ToastProps {
  message: string;
  type: "join" | "add" | "info" | "alert";
  onClose: () => void;
}

export default function FunToast({ message, type, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  // ใช้ useRef เพื่อเก็บฟังก์ชัน onClose ล่าสุดไว้เสมอ
  const onCloseRef = useRef(onClose);

  // อัปเดต ref ทุกครั้งที่ prop onClose เปลี่ยน (เผื่อ Parent ส่งตัวใหม่มา)
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    // เริ่ม Animation เข้า
    requestAnimationFrame(() => setIsVisible(true));

    const timer = setTimeout(() => {
      setIsVisible(false); // เริ่ม Animation ออก

      // รอ Animation จบ (300ms) แล้วค่อยเรียก onClose ตัวล่าสุด
      setTimeout(() => {
        if (onCloseRef.current) {
          onCloseRef.current();
        }
      }, 300);
    }, 3000);

    return () => clearTimeout(timer);
  }, []); // ใส่ Dependency ว่าง [] เพื่อให้ Timer เริ่มทำงานแค่ครั้งเดียวตอน Mount ไม่โดน Reset เมื่อ Parent re-render

  const config = {
    join: { bg: "bg-blue-600", icon: <FaInfoCircle /> },
    add: { bg: "bg-green-600", icon: <FaMusic /> },
    info: { bg: "bg-purple-600", icon: <FaCheckCircle /> },
    alert: { bg: "bg-red-600", icon: <FaExclamationCircle /> },
  };

  const style = config[type];

  return (
    <div
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 ease-out transform ${
        isVisible
          ? "translate-y-0 opacity-100 scale-100"
          : "-translate-y-4 opacity-0 scale-95"
      }`}
    >
      <div
        className={`${style.bg} text-white pl-4 pr-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md border border-white/10 min-w-[300px] max-w-[90vw]`}
      >
        <div className="bg-white/20 p-2 rounded-full text-white">
          {style.icon}
        </div>
        <span className="font-medium text-sm truncate">{message}</span>
      </div>
    </div>
  );
}
