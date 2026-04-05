import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  onSnapshot, 
  collection, 
  setDoc, 
  updateDoc, 
  arrayUnion 
} from 'firebase/firestore';
import { Compass, MapPin, Shield, Lock, Send, Loader2, Target } from 'lucide-react';

// --- Firebase 初始化 ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'treasure-hunt-default';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('login'); // login, radar, admin
  const [missionId, setMissionId] = useState('');
  const [missionData, setMissionData] = useState(null);
  const [adminPass, setAdminPass] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  
  // 使用者座標
  const [userPos, setUserPos] = useState({ lat: 0, lng: 0 });

  // 1. 初始化身份驗證 (Rule 3)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
        setError("身份驗證失敗，請重新整理頁面");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. 獲取地理位置
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => console.error("GPS Error:", err),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // 3. 監聽任務數據 (Rule 1 & 2)
  useEffect(() => {
    if (!user || !missionId || view === 'login') return;

    const missionDoc = doc(db, 'artifacts', appId, 'public', 'data', 'missions', missionId);
    
    const unsubscribe = onSnapshot(missionDoc, (docSnap) => {
      if (docSnap.exists()) {
        setMissionData(docSnap.data());
      } else {
        // 如果任務不存在，初始化一個
        setDoc(missionDoc, { id: missionId, treasures: [], createdAt: Date.now() });
      }
    }, (err) => {
      console.error("Firestore Error:", err);
    });

    return () => unsubscribe();
  }, [user, missionId, view]);

  // 處理進入任務
  const handleJoinMission = () => {
    if (missionId.trim().length < 3) return;
    setView('radar');
  };

  // 處理管理員驗證
  const handleAdminLogin = () => {
    if (adminPass === '1234') { // 預設密碼
      setIsAdmin(true);
      setView('admin');
    }
  };

  // 丟擲寶箱 (Admin 功能)
  const dropTreasure = async (emoji = '🎁') => {
    if (!isAdmin || !missionId) return;
    const missionRef = doc(db, 'artifacts', appId, 'public', 'data', 'missions', missionId);
    
    const newTreasure = {
      id: Math.random().toString(36).substr(2, 9),
      lat: userPos.lat + (Math.random() - 0.5) * 0.001, // 模擬在附近
      lng: userPos.lng + (Math.random() - 0.5) * 0.001,
      emoji: emoji,
      timestamp: Date.now()
    };

    await updateDoc(missionRef, {
      treasures: arrayUnion(newTreasure)
    });
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-xl font-bold tracking-widest animate-pulse">雷達系統初始化中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen bg-slate-900 flex items-center justify-center text-red-400 p-8 text-center">
        <div>
          <Shield className="w-16 h-16 mx-auto mb-4" />
          <p className="text-xl">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden flex flex-col">
      {/* 頂部導航 */}
      <header className="p-4 flex justify-between items-center bg-slate-900/50 border-b border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Target className="text-blue-500 w-6 h-6" />
          <span className="font-bold tracking-tighter text-lg">TREASURE RADAR</span>
        </div>
        {view !== 'login' && (
          <button 
            onClick={() => setView('login')}
            className="text-xs bg-slate-800 px-3 py-1 rounded-full text-slate-400 hover:bg-slate-700 transition-colors"
          >
            離開任務
          </button>
        )}
      </header>

      <main className="flex-1 relative flex flex-col items-center justify-center p-6">
        
        {/* 視圖 1: 登入/進入任務 */}
        {view === 'login' && (
          <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center">
              <h2 className="text-3xl font-black mb-2">準備好開始了嗎？</h2>
              <p className="text-slate-400">輸入 Mission ID 以連接同步雷達</p>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
                <Compass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input 
                  type="text"
                  placeholder="例如: SKW-001"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-lg font-mono uppercase"
                  value={missionId}
                  onChange={(e) => setMissionId(e.target.value.toUpperCase())}
                />
              </div>
              <button 
                onClick={handleJoinMission}
                disabled={!missionId}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
              >
                掃描信號
              </button>
            </div>

            <div className="pt-8 border-t border-slate-800">
              <button 
                onClick={() => setView('admin-login')}
                className="w-full text-slate-500 text-sm flex items-center justify-center gap-2 hover:text-slate-300"
              >
                <Shield className="w-4 h-4" /> 管理員控制台
              </button>
            </div>
          </div>
        )}

        {/* 視圖 2: 雷達畫面 */}
        {view === 'radar' && (
          <div className="w-full h-full flex flex-col items-center animate-in zoom-in-95 duration-500">
            {/* 圓形雷達主體 */}
            <div className="relative w-72 h-72 md:w-96 md:h-96 rounded-full border-2 border-blue-500/30 flex items-center justify-center overflow-hidden bg-slate-900/30 backdrop-blur-sm shadow-[0_0_50px_rgba(37,99,235,0.1)]">
              {/* 雷達掃描線 */}
              <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent,rgba(37,99,235,0.2))] animate-[spin_4s_linear_infinite]" />
              
              {/* 背景網格 */}
              <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '30px 30px'}} />
              
              {/* 中心點 (使用者) */}
              <div className="relative z-10 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(255,255,255,0.8)] animate-pulse" />
              
              {/* 寶箱紅點 (Firestore 同步數據) */}
              {missionData?.treasures?.map((t) => (
                <div 
                  key={t.id}
                  className="absolute transition-all duration-1000 flex flex-col items-center"
                  style={{
                    // 這裡簡易模擬座標轉化為雷達位置 (實際需用 Haversine 算距離)
                    left: `calc(50% + ${(t.lng - userPos.lng) * 50000}px)`,
                    top: `calc(50% - ${(t.lat - userPos.lat) * 50000}px)`
                  }}
                >
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-ping mb-1" />
                  <span className="text-xl drop-shadow-md">{t.emoji}</span>
                </div>
              ))}
            </div>

            {/* 狀態資訊 */}
            <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-sm">
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">任務 ID</p>
                <p className="font-mono font-bold text-blue-400">{missionId}</p>
              </div>
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">偵測目標</p>
                <p className="font-bold">{missionData?.treasures?.length || 0} 個信號</p>
              </div>
            </div>

            <p className="mt-12 text-slate-500 text-sm animate-pulse">正在接收衛星實時數據...</p>
          </div>
        )}

        {/* 視圖 3: 管理員登入 */}
        {view === 'admin-login' && (
          <div className="w-full max-w-sm space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 justify-center">
              <Lock className="w-6 h-6 text-yellow-500" /> 安全驗證
            </h2>
            <input 
              type="password"
              placeholder="請輸入管理密碼"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-4 px-4 text-center text-2xl tracking-widest focus:ring-2 focus:ring-yellow-500 outline-none"
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
            />
            <button 
              onClick={handleAdminLogin}
              className="w-full bg-yellow-600 hover:bg-yellow-500 py-4 rounded-xl font-bold"
            >
              進入終端
            </button>
            <button onClick={() => setView('login')} className="w-full text-slate-500">返回</button>
          </div>
        )}

        {/* 視圖 4: 管理員控制面板 */}
        {view === 'admin' && (
          <div className="w-full max-w-md space-y-6 overflow-y-auto">
            <div className="bg-slate-900 p-6 rounded-3xl border border-yellow-500/20">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Shield className="text-yellow-500 w-5 h-5" /> 任務投放終端
              </h2>
              
              <div className="grid grid-cols-3 gap-3 mb-6">
                {['🎁', '💎', '💰', '👑', '🗺️', '👻'].map(emoji => (
                  <button 
                    key={emoji}
                    onClick={() => dropTreasure(emoji)}
                    className="aspect-square bg-slate-800 rounded-2xl text-3xl flex items-center justify-center hover:bg-slate-700 active:scale-90 transition-all border border-slate-700"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <div className="bg-slate-950 p-4 rounded-xl font-mono text-xs text-green-500 space-y-1 border border-green-500/10">
                <p>&gt; 定位: {userPos.lat.toFixed(4)}, {userPos.lng.toFixed(4)}</p>
                <p>&gt; 頻道: {missionId}</p>
                <p>&gt; 狀態: 系統已就緒...</p>
              </div>
            </div>

            <button 
              onClick={() => setView('radar')}
              className="w-full bg-blue-600 py-4 rounded-xl font-bold flex items-center justify-center gap-2"
            >
              切換至觀測雷達 <Compass className="w-5 h-5" />
            </button>
          </div>
        )}

      </main>

      {/* 底部裝飾 */}
      <footer className="p-2 text-[10px] text-center text-slate-600 font-mono tracking-widest uppercase">
        encrypted-satellite-link-v2.5 // status: secured
      </footer>
    </div>
  );
}
