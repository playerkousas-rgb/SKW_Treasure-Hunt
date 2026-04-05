import React, { useState, useEffect, useRef } from 'react';
// 注意：這裡先保留基礎功能，Firebase 邏輯建議放在獨立的 service 或在 useEffect 初始化
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

/**
 * Dragon Radar App - 根據你的 Firebase 設定優化的版本
 */
const App = () => {
  const [scale, setScale] = useState(1);
  const [dragonBalls, setDragonBalls] = useState([]);
  const canvasRef = useRef(null);

  // 這裡填入你截圖中的 Firebase Config (image_e75781.png)
  const firebaseConfig = {
    apiKey: "AIzaSyCZkWjw759mF_rpSEofMLLcS8GDzGz05eg",
    authDomain: "dragon-radar-app.firebaseapp.com",
    projectId: "dragon-radar-app",
    storageBucket: "dragon-radar-app.firebasestorage.app",
    messagingSenderId: "387279802113",
    appId: "1:387279802113:web:764b922d30806746c2d500",
    measurementId: "G-C7QC98VXQM"
  };

  useEffect(() => {
    // 初始化 Firebase (如果需要 analytics)
    const app = initializeApp(firebaseConfig);
    // getAnalytics(app); 

    // 初始化龍珠位置
    const balls = Array.from({ length: 7 }, (_, i) => ({
      id: i + 1,
      x: (Math.random() - 0.5) * 300,
      y: (Math.random() - 0.5) * 300,
    }));
    setDragonBalls(balls);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let scanAngle = 0;
    let animationId;

    const render = () => {
      const { width, height } = canvas;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = width / 2 - 10;

      ctx.clearRect(0, 0, width, height);
      
      // 繪製背景
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#102a10';
      ctx.fill();

      // 繪製格線
      ctx.strokeStyle = '#245a24';
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, (radius / 4) * i, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 繪製掃描光束
      const grad = ctx.createConicGradient(scanAngle, centerX, centerY);
      grad.addColorStop(0, 'rgba(0, 255, 0, 0.5)');
      grad.addColorStop(0.1, 'rgba(0, 255, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, scanAngle - 0.5, scanAngle);
      ctx.fill();

      // 繪製龍珠
      dragonBalls.forEach(ball => {
        const dx = centerX + (ball.x * scale);
        const dy = centerY + (ball.y * scale);
        if (Math.hypot(dx - centerX, dy - centerY) < radius) {
          ctx.beginPath();
          ctx.arc(dx, dy, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffcc00';
          ctx.shadowBlur = 10;
          ctx.shadowColor = 'yellow';
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      scanAngle += 0.05;
      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [dragonBalls, scale]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 font-mono text-white p-4">
      <h1 className="text-3xl font-bold mb-8 text-green-500">DRAGON RADAR</h1>
      
      <div className="bg-zinc-200 p-4 rounded-full shadow-2xl border-b-8 border-zinc-400">
        <canvas ref={canvasRef} width={300} height={300} className="rounded-full bg-black" />
      </div>

      <div className="mt-8 flex gap-4">
        <button onClick={() => setScale(s => s * 1.2)} className="bg-white text-black px-6 py-2 rounded-full font-bold">ZOOM +</button>
        <button onClick={() => setScale(s => s / 1.2)} className="bg-white text-black px-6 py-2 rounded-full font-bold">ZOOM -</button>
      </div>
    </div>
  );
};

export default App;