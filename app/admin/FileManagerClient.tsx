'use client';

import { useEffect, useState } from 'react';

interface FileSource {
  id: string;
  name: string;
  path: string;
  enabled: boolean;
  lastUpdated: string | null;
  itemCount: number;
}

export default function FileManagerClient() {
  const [files, setFiles] = useState<FileSource[]>([
    {
      id: 'data-template',
      name: 'data-template.json',
      path: 'data-template.json',
      enabled: true,
      lastUpdated: null,
      itemCount: 0
    },
    {
      id: 'cached-listings',
      name: 'cached-listings.json',
      path: 'data/cached-listings.json',
      enabled: true,
      lastUpdated: null,
      itemCount: 0
    }
  ]);
  const [newFileName, setNewFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const loadFiles = async () => {
    try {
      // Load info about available files
      const response = await fetch('/api/files/list');
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || files);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  };

  const createFile = async () => {
    if (!newFileName.trim()) {
      setMessage('Vui lòng nhập tên file.');
      return;
    }

    if (!newFileName.endsWith('.json')) {
      setNewFileName(newFileName + '.json');
    }

    setLoading(true);
    try {
      const response = await fetch('/api/files/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: newFileName,
          content: fileContent || '[]'
        })
      });

      if (response.ok) {
        setMessage(`Đã tạo file ${newFileName} thành công!`);
        setNewFileName('');
        setFileContent('');
        loadFiles();
      } else {
        const error = await response.json();
        setMessage(`Lỗi: ${error.message}`);
      }
    } catch (error) {
      setMessage('Không thể tạo file.');
    } finally {
      setLoading(false);
    }
  };

  const deleteFile = async (fileId: string) => {
    if (!confirm('Bạn có chắc muốn xóa file này?')) return;

    try {
      const response = await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
      if (response.ok) {
        setMessage('Đã xóa file thành công!');
        loadFiles();
      } else {
        setMessage('Không thể xóa file.');
      }
    } catch (error) {
      setMessage('Lỗi khi xóa file.');
    }
  };

  const toggleFile = async (fileId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/files/${fileId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });

      if (response.ok) {
        setFiles(files.map(f => f.id === fileId ? { ...f, enabled } : f));
        setMessage(`Đã ${enabled ? 'bật' : 'tắt'} file ${fileId}`);
      }
    } catch (error) {
      setMessage('Không thể thay đổi trạng thái file.');
    }
  };

  const loadFileContent = async (fileId: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}/content`);
      if (response.ok) {
        const data = await response.json();
        setFileContent(JSON.stringify(data.content, null, 2));
        setMessage(`Đã tải nội dung file ${fileId}`);
      }
    } catch (error) {
      setMessage('Không thể tải nội dung file.');
    }
  };

  const saveFileContent = async (fileId: string) => {
    try {
      // Validate JSON
      const parsed = JSON.parse(fileContent);
      
      const response = await fetch(`/api/files/${fileId}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: parsed })
      });

      if (response.ok) {
        setMessage('Đã lưu nội dung file thành công!');
        loadFiles();
      } else {
        setMessage('Không thể lưu nội dung file.');
      }
    } catch (error) {
      setMessage('Nội dung không phải là JSON hợp lệ.');
    }
  };

  const runCollectorNow = async () => {
    setLoading(true);
    setMessage('Đang chạy collector từ các file JSON...');
    try {
      const response = await fetch('/api/collector/run', { method: 'POST' });
      const payload = await response.json();
      
      if (payload.meta?.configured > 0) {
        setMessage(`Đã thu thập ${payload.meta.collected} bài từ ${payload.meta.configured} nguồn.`);
        loadFiles();
      } else {
        setMessage('Không có nguồn nào được bật.');
      }
    } catch (error) {
      setMessage('Không thể chạy collector.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  return (
    <div className="file-manager">
      <div className="admin-section-head">
        <div>
          <h2>📁 Quản lý File JSON</h2>
          <p>Quản lý các file JSON chứa dữ liệu phòng trọ để collector tự động đọc.</p>
        </div>
        <button 
          className="primary-btn" 
          onClick={runCollectorNow}
          disabled={loading}
        >
          {loading ? 'Đang chạy...' : 'Chạy ngay'}
        </button>
      </div>

      {message && (
        <div className="admin-notice">
          {message}
        </div>
      )}

      <div className="file-list">
        <h3>File dữ liệu hiện có</h3>
        {files.length === 0 ? (
          <p className="empty-state">Chưa có file dữ liệu nào.</p>
        ) : (
          <div className="file-grid">
            {files.map((file) => (
              <div key={file.id} className="file-card">
                <div className="file-header">
                  <span className="file-name">{file.name}</span>
                  <label className="toggle-control">
                    <input
                      type="checkbox"
                      checked={file.enabled}
                      onChange={(e) => toggleFile(file.id, e.target.checked)}
                    />
                    <span>{file.enabled ? 'Bật' : 'Tắt'}</span>
                  </label>
                </div>
                <div className="file-info">
                  <span>📁 {file.path}</span>
                  {file.itemCount > 0 && <span>📊 {file.itemCount} bài</span>}
                  {file.lastUpdated && <span>🕒 {new Date(file.lastUpdated).toLocaleString('vi-VN')}</span>}
                </div>
                <div className="file-actions">
                  <button className="secondary-btn" onClick={() => loadFileContent(file.id)}>
                    📖 Đọc
                  </button>
                  <button className="secondary-btn" onClick={() => saveFileContent(file.id)}>
                    💾 Lưu
                  </button>
                  <button className="danger-btn" onClick={() => deleteFile(file.id)}>
                    🗑️ Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="file-editor">
        <h3>Editor file JSON</h3>
        <div className="editor-controls">
          <input
            type="text"
            placeholder="Tên file mới (ví dụ: my-data.json)"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
          />
          <button className="primary-btn" onClick={createFile} disabled={loading}>
            ➕ Tạo file mới
          </button>
        </div>
        <textarea
          className="json-editor"
          value={fileContent}
          onChange={(e) => setFileContent(e.target.value)}
          placeholder='Dán hoặc viết JSON ở đây. Ví dụ: [{"id": "1", "title": "Phòng trọ", "price": 2000000}]'
          rows={20}
        />
      </div>

      <div className="auto-run-info">
        <h3>⚙️ Cấu hình tự động</h3>
        <div className="info-card">
          <strong>Auto-run:</strong> Collector tự động chạy mỗi 30 phút
          <br />
          <strong>Server start:</strong> Tự động chạy khi mở server
          <br />
          <strong>File sources:</strong> Tất cả file JSON được bật sẽ được đọc tự động
        </div>
      </div>
    </div>
  );
}