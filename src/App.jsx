import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  deleteDoc, 
  addDoc, 
  getDocs 
} from 'firebase/firestore';

// --- Firebase 初始化與配置 (Rule 1 & 3) ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'dragon-radar-cloud';

const DEFAULT_EMOJIS = ["🔴", "⭐", "💎", "🔥", "⚡", "🍀", "🌀", "🛡️", "🔑", "🛸", "🐲", "🧿", "🎁", "🚩", "🧭"];

export default function App() {
  const [user, setUser] = useState(null);
  const [missionId, setMissionId] = useState('');
  const [isStarted, setIsStarted] = useState(false);
  const [userPos, setUserPos] = useState(null);
  const [stations, setStations] = useState([]);
  const [showLeader, setShowLeader] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false); 
  const [pass, setPass] = useState('');
  const [dropType, setDropType] = useState('emoji');
  const [selectedEmoji, setSelectedEmoji] = useState(0);
  const [customText, setCustomText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [zoom, setZoom] = useState(5);
  const [foundModal, setFoundModal] = useState(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  // 1. 身份驗證流程 (Rule 3)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Auth Error:", e);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. GPS 監控
  useEffect(() => {
    if (!isStarted) return;
    const watchId = navigator.geolocation.watchPosition(
      (p) => setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => console.error("GPS Error:", err),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isStarted]);

  // 3. 雲端數據即時同步 (Rule 1 & 2)
  useEffect(() => {
    // 必須有使用者、任務 ID 且已啟動雷達才監聽
    if (!user || !missionId || !isStarted) return;

    // 定義 Firestore 路徑：/artifacts/{appId}/public/data/missions/{missionId}/points
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', `mission_${missionId}`);
    
    // 使用 onSnapshot 進行即時監聽 (Rule 2: 簡單查詢)
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStations(data);
    }, (err) => {
      console.error("Firestore Listen Error:", err);
    });

    return () => unsubscribe();
  }, [user, missionId, isStarted]);

  // 4. 碰撞偵測 (當靠近目標 15 公尺內觸發)
  useEffect(() => {
    if (!userPos || stations.length === 0 || foundModal) return;
    
    stations.forEach(s => {
      const dist = calculateDistance(userPos.lat, userPos.lng, s.lat, s.lng);
      if (dist < 15) {
        setFoundModal(s);
      }
    });
  }, [userPos, stations, foundModal]);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // 公尺
    const f1 = lat1 * Math.PI/180;
    const f2 = lat2 * Math.PI/180;
    const df = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(df/2)*Math.sin(df/2) + Math.cos(f1)*Math.cos(f2)*Math.sin(dl/2)*Math.sin(dl/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const handleVerify = () => {
    if (pass === '0728') {
      setIsAuthed(true);
      setIsAdminMode(true);
    } else if (pass === '1234') {
      setIsAuthed(true);
      setIsAdminMode(false);
    } else {
      setPass('');
    }
  };

  const handleDrop = async () => {
    if (!user || !userPos || !isAuthed) return;
    
    let content = "";
    if (dropType === 'emoji') content = selectedEmoji.toString();
    else if (dropType === 'text') content = customText;
    else if (dropType === 'image') content = imageUrl;

    if (dropType !== 'emoji' && !content) return;

    try {
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', `mission_${missionId}`);
      await addDoc(colRef, {
        lat: userPos.lat,
        lng: userPos.lng,
        type: dropType,
        content: content,
        timestamp: Date.now(),
        createdBy: user.uid
      });
      setCustomText('');
      setImageUrl('');
    } catch (e) {
      console.error("Drop failed:", e);
    }
  };

  const handleDelete = async (id) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', `mission_${missionId}`, id);
      await deleteDoc(docRef);
    } catch (e) {
      console.error("Delete failed:", e);
    }
  };

  const handleClearAll = async () => {
    if (!user) return;
    if (!isConfirmingClear) {
      setIsConfirmingClear(true);
      setTimeout(() => setIsConfirmingClear(false), 3000); 
      return;
    }
    try {
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', `mission_${missionId}`);
      const snapshot = await getDocs(colRef);
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `mission_${missionId}`, d.id)));
      await Promise.all(deletePromises);
      setIsConfirmingClear(false);
    } catch (e) {
      console.error("Clear all failed:", e);
    }
  };

  // --- UI 渲染 ---

  // 1. 入口頁面
  if (!isStarted) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-8 text-green-500 font-mono z-50">
        <div className="w-24 h-24 border-4 border-green-900 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <span className="text-4xl">🛰️</span>
        </div>
        <h1 className="text-xl font-bold tracking-widest mb-1 text-center uppercase">Dragon Radar Cloud</h1>
        <p className="text-[10px] text-green-900 mb-8 uppercase tracking-widest font-black">Multiplayer Sync Active</p>
        <input 
          type="text" 
          value={missionId}
          onChange={(e) => setMissionId(e.target.value.toUpperCase().replace(/\s/g, ''))}
          placeholder="ENTER MISSION ID" 
          className="bg-transparent border-b-2 border-green-900 text-center text-2xl outline-none w-full max-w-xs mb-10 text-white focus:border-green-400 placeholder:text-green-900/50"
        />
        <button 
          onClick={() => missionId && setIsStarted(true)}
          className="w-full max-w-xs bg-green-900/20 border border-green-500 py-4 font-bold rounded-lg hover:bg-green-500 hover:text-black transition-all uppercase tracking-widest active:scale-95"
        >
          Boot System
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0a2b16] overflow-hidden font-mono select-none">
      {/* 雷達掃描背景 */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" 
        style={{ backgroundImage: 'linear-gradient(#1e6b3a 1px, transparent 1px), linear-gradient(90deg, #1e6b3a 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>
      <div className="absolute inset-0 pointer-events-none border-b border-green-400/30 animate-[scan_4s_linear_infinite]" 
           style={{ background: 'linear-gradient(to bottom, transparent, rgba(57, 255, 20, 0.05))' }}></div>

      {/* 雷達點陣 */}
      {userPos && stations.map(s => {
        const range = 300 / zoom; // 雷達顯示範圍
        const dLat = s.lat - userPos.lat;
        const dLng = s.lng - userPos.lng;
        const y = 50 - (dLat * 111320 / range) * 50;
        const x = 50 + (dLng * 111320 * Math.cos(userPos.lat * Math.PI / 180) / range) * 50;
        
        if (x < 0 || x > 100 || y < 0 || y > 100) return null;
        return (
          <div key={s.id} className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 z-20" style={{ left: `${x}%`, top: `${y}%` }}>
            <div className="w-full h-full bg-red-600 rounded-full border-2 border-white shadow-[0_0_15px_#f00] animate-pulse"></div>
          </div>
        );
      })}

      {/* 中心定位點 */}
      <div className="absolute top-1/2 left-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 z-30">
        <div className="w-full h-full bg-white rounded-full shadow-[0_0_10px_#fff]"></div>
        <div className="absolute inset-0 border border-white rounded-full animate-ping opacity-50"></div>
      </div>

      {/* 頂部資訊 */}
      <div className="absolute inset-0 p-4 flex flex-col justify-between pointer-events-none">
        <div className="flex justify-between items-start pointer-events-auto">
          <div className="bg-black/80 p-3 rounded border border-green-500/30 backdrop-blur-md">
            <div className="text-[9px] text-green-700 uppercase font-black">Sync ID</div>
            <div className="text-xl font-bold text-green-400 tracking-tighter">{missionId}</div>
          </div>
          <button 
            onClick={() => setShowLeader(true)} 
            className="bg-black/80 border border-green-500 text-green-500 px-4 py-2 rounded text-xs font-black active:scale-90 transition-all uppercase"
          >
            Admin Panel
          </button>
        </div>

        {/* 縮放控制器 */}
        <div className="flex justify-between items-end pointer-events-auto">
          <div className="flex flex-col gap-3">
            {[1, 5, 10].map(z => (
              <button 
                key={z} 
                onClick={() => setZoom(z)} 
                className={`w-12 h-12 rounded-full border-2 font-black transition-all flex items-center justify-center ${zoom === z ? 'bg-green-500 text-black border-white scale-110' : 'bg-black/80 text-green-500 border-green-500/50 opacity-60'}`}
              >
                {z}x
              </button>
            ))}
          </div>
          <div className="bg-black/80 p-3 rounded border border-green-500/30 text-right backdrop-blur-md">
            <div className="text-[9px] text-green-700 uppercase font-black">Active Nodes</div>
            <div className="text-4xl font-bold text-green-400 leading-none">{stations.length.toString().padStart(2, '0')}</div>
          </div>
        </div>
      </div>

      {/* 攔截彈窗 */}
      {foundModal && (
        <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-10 text-center">
          <div className="text-xs text-green-500 mb-6 tracking-[0.5em] uppercase animate-pulse font-black">Intercepting Packet</div>
          <div className="mb-10">
            {foundModal.type === 'emoji' && <span className="text-[120px] drop-shadow-[0_0_30px_rgba(255,0,0,0.5)]">{DEFAULT_EMOJIS[parseInt(foundModal.content)]}</span>}
            {foundModal.type === 'text' && <span className="text-3xl font-black text-white px-4 block leading-tight">{foundModal.content}</span>}
            {foundModal.type === 'image' && <img src={foundModal.content} className="max-h-[50vh] rounded-2xl border-2 border-white shadow-2xl" alt="target" />}
          </div>
          <button 
            onClick={() => setFoundModal(null)} 
            className="bg-green-500 text-black px-16 py-5 font-black rounded-full uppercase tracking-widest active:scale-95 transition-all shadow-[0_0_30px_rgba(34,197,94,0.3)]"
          >
            數據已接收
          </button>
        </div>
      )}

      {/* 管理面板 */}
      {showLeader && (
        <div className="fixed inset-0 z-[500] bg-zinc-950 p-6 overflow-y-auto text-white">
          {!isAuthed ? (
            <div className="h-full flex flex-col items-center justify-center max-w-xs mx-auto">
              <h2 className="text-green-500 mb-8 font-mono tracking-widest uppercase text-sm font-black">Security Pin Required</h2>
              <input 
                type="password" 
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                placeholder="****" 
                className="bg-zinc-900 border border-zinc-800 text-center text-4xl text-white outline-none mb-10 w-full py-4 rounded-xl tracking-[0.5em] focus:border-green-500"
              />
              <div className="flex gap-4 w-full">
                <button onClick={() => setShowLeader(false)} className="flex-1 text-zinc-500 font-black uppercase text-xs">Close</button>
                <button onClick={handleVerify} className="flex-1 bg-green-600 text-black py-4 rounded-xl font-black uppercase text-xs">Verify</button>
              </div>
            </div>
          ) : (
            <div className="max-w-md mx-auto space-y-8 pb-32">
              <div className="flex justify-between items-center sticky top-0 bg-zinc-950/90 backdrop-blur-md py-4 z-10 border-b border-zinc-900">
                <h2 className="font-black text-2xl italic uppercase tracking-tighter">Command Center</h2>
                <button onClick={() => setShowLeader(false)} className="bg-zinc-900 text-zinc-400 px-4 py-2 rounded-full text-xs font-black">EXIT</button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-3 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                  {['emoji', 'text', 'image'].map(m => (
                    <button key={m} onClick={() => setDropType(m)} className={`py-3 text-xs font-black rounded-lg transition-all uppercase ${dropType === m ? 'bg-green-600 text-black' : 'text-zinc-500'}`}>
                      {m}
                    </button>
                  ))}
                </div>

                <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 min-h-[160px] flex items-center justify-center">
                  {dropType === 'emoji' && (
                    <div className="grid grid-cols-5 gap-3 w-full">
                      {DEFAULT_EMOJIS.map((e, i) => (
                        <button key={i} onClick={() => setSelectedEmoji(i)} className={`text-2xl p-2 rounded-xl border-2 transition-all aspect-square ${selectedEmoji === i ? 'bg-green-900/40 border-green-500 scale-110' : 'bg-black border-transparent opacity-30'}`}>{e}</button>
                      ))}
                    </div>
                  )}
                  {dropType === 'text' && (
                    <textarea value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="Message content..." className="w-full bg-black text-white p-4 rounded-xl h-32 border border-zinc-800 outline-none" />
                  )}
                  {dropType === 'image' && (
                    <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://image-url.jpg" className="w-full bg-black text-white p-4 rounded-xl border border-zinc-800 outline-none" />
                  )}
                </div>

                <button onClick={handleDrop} className="w-full bg-white text-black font-black py-5 rounded-2xl uppercase tracking-widest text-sm active:scale-95 transition-all">
                   Deploy to Cloud
                </button>
              </div>

              <div className="pt-8 space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
                  <h3 className="text-xs font-black text-zinc-500 uppercase italic">Deployed Nodes ({missionId})</h3>
                  {isAdminMode && (
                    <button onClick={handleClearAll} className={`text-[10px] font-black px-4 py-2 rounded-full ${isConfirmingClear ? 'bg-red-600 text-white animate-pulse' : 'bg-zinc-900 text-red-500'}`}>
                      {isConfirmingClear ? 'CONFIRM PURGE' : 'PURGE ALL'}
                    </button>
                  )}
                </div>
                
                <div className="space-y-4">
                  {stations.map((s, idx) => (
                    <div key={s.id} className="bg-zinc-900 p-5 rounded-2xl flex justify-between items-center border border-zinc-800">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] bg-green-900 text-green-400 px-2 py-0.5 rounded font-black tracking-widest">#{idx+1}</span>
                          <span className="text-xs font-black uppercase text-zinc-300">{s.type} Packet</span>
                        </div>
                        <div className="text-[9px] text-zinc-600 font-mono mt-1 uppercase">
                          {s.lat.toFixed(6)}, {s.lng.toFixed(6)}
                        </div>
                      </div>
                      <button onClick={() => handleDelete(s.id)} className="text-zinc-600 hover:text-red-500 p-2">
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan { from { transform: translateY(-100%); } to { transform: translateY(100%); } }
        body { background: black; overscroll-behavior: none; }
        * { -webkit-tap-highlight-color: transparent; }
      `}} />
    </div>
  );
}
