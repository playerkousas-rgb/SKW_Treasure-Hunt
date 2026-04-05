import React from 'react';
import { createRoot } from 'react-dom/client';
// 確保 App 元件在同一個專案目錄下
import App from './App.jsx';

/**
 * 這是應用程式的進入點檔案 (Entry Point)。
 * 它負責將 React 應用程式掛載到 index.html 檔案中定義的 <div id="root"></div>。
 */

const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  // 在開發環境中，如果找不到 root 節點，在控制台給予提示
  console.error("Critical Error: 'root' element not found in index.html.");
}