import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

/**
 * 這是應用程式的進入點 (Entry Point)
 * 負責將 App 組件掛載到 HTML 中的 #root 元素
 * * 修正說明：
 * 1. 移除了 import './index.css' 以避免編譯錯誤（樣式已整合至 index.html 或 App.jsx 中）。
 * 2. 確保導入 App.jsx 的路徑相對於此檔案是正確的。
 */

const rootElement = document.getElementById('root');

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} else {
  // 如果找不到 root 元素，在控制台打印錯誤訊息以便除錯
  console.error("找不到 root 元素，請檢查 index.html 是否包含 <div id='root'></div>");
}
