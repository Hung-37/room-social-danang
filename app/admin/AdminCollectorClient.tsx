'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import FileManagerClient from './FileManagerClient';

type Source = {
  id: string;
  name: string;
  type: string;
  url: string;
  permission: string;
  enabled: boolean;
  note: string;
  listingSelectors?: Record<string, string>;
  result?: { ok?: boolean; status?: string; note?: string };
};

type RunResult = {
  sourceId: string;
  sourceName: string;
  status: string;
  count: number;
  error?: string;
  warning?: string;
};

type RunResponse = {
  data: RunResult[];
  meta: { ranAt: string; configured: number; collected: number; persistence?: Record<string, unknown>; ai?: Record<string, unknown> };
};

type ImportResponse = {
  data?: Array<{ title: string; price: number | null; area: number | null; address: string | null; aiAnalysis?: { summary?: string; riskLevel?: string } }>;
  stats?: { received: number; rejected: number; irrelevant: number; duplicates: number; needsReview: number };
  saved?: number;
  ai?: { analyzed: number; errors: string[] };
  error?: string;
};

type UrlPreview = {
  externalId: string;
  title: string;
  summary: string;
  price: number | null;
  area: number | null;
  address: string | null;
  imageUrl?: string | null;
  source?: { url?: string | null; name?: string };
};

type UrlPreviewResponse = {
  data?: UrlPreview[];
  meta?: { url: string; format: string; pages?: number; maxPages?: number; received: number; limited?: boolean; warnings?: string[]; robots?: { checked: boolean; warning?: string | null } };
  error?: string;
};

type Listing = {
  externalId: string;
  title: string;
  summary: string;
  price: number | null;
  area: number | null;
  address: string | null;
  verificationStatus: string;
  trustScore: number;
  sourceName: string;
  updatedAt: string;
};

type DashboardStats = {
  listings: { publishedCount: number; pendingCount: number; rejectedCount: number };
  community?: { publishedCount: number; pendingCount: number; rejectedCount: number };
  lastRun: { ranAt: string; collected: number; duplicates: number; errors: number } | null;
};

type CollectorStatus = { active: boolean; startedAt: string | null; lastRun: DashboardStats['lastRun'] };

type CommunityPost = {
  id: string;
  title: string;
  summary: string;
  clusterName: string;
  authorName?: string;
  status: string;
  comments: number;
  updated: string;
};

type CommunityReport = {
  id: string;
  postId: string;
  title: string;
  reason: string;
  details?: string | null;
  status: string;
  reporterName: string;
  createdAt: string;
};

type AuditLog = {
  id: number;
  entityType: string;
  entityId: string;
  action: string;
  actorEmail: string | null;
  details: unknown;
  createdAt: string;
};

const INTERVAL_MS = 6 * 60 * 60 * 1000;

export default function AdminCollectorClient() {
  const [sources, setSources] = useState<Source[]>([]);
  const [run, setRun] = useState<RunResponse | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
  const [message, setMessage] = useState('');
  const [importContent, setImportContent] = useState('');
  const [importFormat, setImportFormat] = useState<'json' | 'csv'>('json');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [useAi, setUseAi] = useState(true);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'collector' | 'listings' | 'community' | 'reports' | 'audit' | 'html' | 'files'>('collector');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<string | null>(null);
  const [listingQuery, setListingQuery] = useState('');
  const [listingStatus, setListingStatus] = useState('all');
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState(false);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [collectorStatus, setCollectorStatus] = useState<CollectorStatus | null>(null);
  const [crawlUrl, setCrawlUrl] = useState('');
  const [crawlMaxPages, setCrawlMaxPages] = useState(5);
  const [crawlPreview, setCrawlPreview] = useState<UrlPreviewResponse | null>(null);
  const [isPreviewingUrl, setIsPreviewingUrl] = useState(false);
  const [isImportingPreview, setIsImportingPreview] = useState(false);

  async function loadSources() {
    try {
      const response = await fetch('/api/collector/check');
      const payload = await response.json();
      setSources(payload.data ?? []);
    } catch (error) {
      setMessage('Không tải được danh sách nguồn.');
    }
  }

  async function toggleSource(source: Source) {
    const response = await fetch('/api/collector/check', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId: source.id, enabled: !source.enabled })
    });
    if (response.ok) {
      setMessage(`${source.name}: đã ${source.enabled ? 'tắt' : 'bật'} nguồn.`);
      loadSources();
    } else {
      setMessage('Không thể cập nhật trạng thái nguồn.');
    }
  }

  async function loadListings() {
    setLoadingListings(true);
    try {
      const response = await fetch('/api/listings?includePending=true&limit=200');
      const payload = await response.json();
      if (response.ok && payload.data) {
        setListings(payload.data);
        const storage = payload.meta?.storage === 'file_cache' ? 'cache cục bộ' : 'database';
        setMessage(`Đã tải ${payload.data.length} bài từ ${storage}.`);
      } else {
        setListings([]);
        setMessage('Database chưa có dữ liệu. Sử dụng Import để thêm dữ liệu mẫu.');
      }
    } catch (error) {
      setListings([]);
      setMessage('Database chưa được cấu hình. Đang ở chế độ demo.');
    } finally {
      setLoadingListings(false);
    }
  }

  async function loadDashboard() {
    try {
      const response = await fetch('/api/admin/stats');
      if (response.ok) setDashboard((await response.json()).data ?? null);
    } catch {
      setDashboard(null);
    }
  }

  async function loadCollectorStatus() {
    try {
      const response = await fetch('/api/collector/status');
      if (response.ok) setCollectorStatus((await response.json()).data ?? null);
    } catch { setCollectorStatus(null); }
  }

  async function loadCommunityPosts() {
    setLoadingCommunity(true);
    try {
      const response = await fetch('/api/community/posts?limit=100');
      const payload = await response.json();
      setCommunityPosts(response.ok ? payload.data ?? [] : []);
    } catch {
      setCommunityPosts([]);
      setMessage('Không tải được bài cộng đồng.');
    } finally {
      setLoadingCommunity(false);
    }
  }

  async function loadReports() {
    try {
      const response = await fetch('/api/admin/reports');
      const payload = await response.json();
      setReports(response.ok ? payload.data ?? [] : []);
    } catch { setReports([]); }
  }

  async function loadAuditLogs() {
    try {
      const response = await fetch('/api/admin/audit?limit=200');
      const payload = await response.json();
      setAuditLogs(response.ok ? payload.data ?? [] : []);
    } catch { setAuditLogs([]); }
  }

  async function updateReport(id: string, status: 'resolved' | 'dismissed' | 'pending') {
    if (status === 'dismissed' && !window.confirm('Bỏ qua báo cáo này?')) return;
    const response = await fetch('/api/admin/reports', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status })
    });
    if (response.ok) { setMessage('Đã cập nhật báo cáo.'); loadReports(); }
    else setMessage('Không thể cập nhật báo cáo.');
  }

  async function updateCommunityStatus(id: string, status: 'verified' | 'rejected' | 'needs_review') {
    if (status === 'rejected' && !window.confirm('Bạn chắc chắn muốn từ chối bài viết này?')) return;
    try {
      const response = await fetch(`/api/community/posts/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || 'Không thể cập nhật bài cộng đồng.');
        return;
      }
      setMessage(status === 'verified' ? 'Đã duyệt bài cộng đồng.' : status === 'rejected' ? 'Đã từ chối bài cộng đồng.' : 'Đã đưa bài về chờ duyệt.');
      loadCommunityPosts();
    } catch {
      setMessage('Lỗi khi cập nhật bài cộng đồng.');
    }
  }

  async function runCollector() {
    setIsRunning(true);
    setMessage('Đang kiểm tra các nguồn được phép...');
    try {
      const response = await fetch('/api/collector/run', { method: 'POST' });
      const payload = await response.json();
      setRun(payload);
      
      if (payload.meta?.status === 'no_enabled_sources') {
        setMessage(payload.meta.message || 'Chưa có nguồn nào được bật.');
        if (payload.meta.instructions) {
          setMessage(payload.meta.message + '\n\n' + payload.meta.instructions.join('\n'));
        }
      } else if (payload.meta.configured > 0) {
        setMessage(`Đã hoàn tất thu thập. Thu được ${payload.meta.collected} bài từ ${payload.meta.configured} nguồn.`);
        loadListings();
      } else {
        setMessage('Chưa có nguồn nào được bật.');
      }
    } catch {
      setMessage('Không thể chạy collector lúc này.');
    } finally {
      setIsRunning(false);
      await loadCollectorStatus();
      await loadDashboard();
    }
  }

  async function importListings() {
    setIsImporting(true);
    setImportResult(null);
    setMessage('Đang lọc dữ liệu nhập...');
    try {
      const form = new FormData();
      if (importFile) form.append('file', importFile);
      else {
        form.append('content', importContent);
        form.append('format', importFormat);
      }
      form.append('useAi', String(useAi));
      const response = await fetch('/api/import/listings', { method: 'POST', body: form });
      const payload = await response.json() as ImportResponse;
      setImportResult(payload);
      setMessage(payload.error ?? `Đã lọc ${payload.data?.length ?? 0} tin${payload.ai?.analyzed ? ` và AI đã phân tích ${payload.ai.analyzed}` : ''}.`);
      // Reload listings after import
      loadListings();
    } catch {
      setMessage('Không thể xử lý dữ liệu nhập.');
    } finally {
      setIsImporting(false);
    }
  }

  async function previewUrl() {
    setIsPreviewingUrl(true);
    setCrawlPreview(null);
    setMessage('Đang kiểm tra robots.txt và phân tích URL công khai...');
    try {
      const response = await fetch('/api/collector/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: crawlUrl.trim(), maxPages: crawlMaxPages })
      });
      const payload = await response.json() as UrlPreviewResponse;
      setCrawlPreview(payload);
      setMessage(response.ok ? `Đã nhận diện ${payload.data?.length ?? 0} tin từ ${payload.meta?.format ?? 'URL'}.` : (payload.error ?? 'Không đọc được URL.'));
    } catch {
      setMessage('Không thể kết nối tới bộ phân tích URL.');
    } finally {
      setIsPreviewingUrl(false);
    }
  }

  async function importCrawlPreview() {
    const data = crawlPreview?.data ?? [];
    if (data.length === 0) return;
    setIsImportingPreview(true);
    try {
      const response = await fetch('/api/import/listings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: JSON.stringify(data), format: 'json', sourceUrl: crawlPreview?.meta?.url ?? crawlUrl, useAi: false })
      });
      const payload = await response.json() as ImportResponse;
      setImportResult(payload);
      setMessage(response.ok ? `Đã đưa ${payload.saved ?? payload.data?.length ?? 0} tin vào hàng chờ duyệt.` : (payload.error ?? 'Không thể lưu preview.'));
      if (response.ok) { setCrawlPreview(null); loadListings(); loadDashboard(); }
    } catch {
      setMessage('Không thể lưu dữ liệu cào vào hàng chờ duyệt.');
    } finally {
      setIsImportingPreview(false);
    }
  }

  async function updateListingStatus(externalId: string, status: string) {
    try {
      const response = await fetch(`/api/listings/${externalId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        const payload = await response.json();
        setMessage(payload.databaseSynced === false
          ? 'Đã lưu trạng thái vào cache cục bộ; MySQL hiện chưa kết nối.'
          : 'Đã cập nhật trạng thái.');
        loadListings();
      } else {
        const payload = await response.json();
        setMessage(payload.error || 'Không thể cập nhật trạng thái.');
      }
    } catch {
      setMessage('Lỗi khi cập nhật trạng thái.');
    }
  }

  async function batchUpdateStatus(status: string) {
    if (selectedListings.size === 0) {
      setMessage('Vui lòng chọn ít nhất một bài.');
      return;
    }
    setBatchAction(status);
    try {
      const externalIds = Array.from(selectedListings);
      const promises = externalIds.map(id =>
        fetch(`/api/listings/${id}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        })
      );
      await Promise.all(promises);
      setMessage(`Đã cập nhật ${externalIds.length} bài thành ${status}.`);
      setSelectedListings(new Set());
      loadListings();
    } catch {
      setMessage('Lỗi khi cập nhật hàng loạt.');
    } finally {
      setBatchAction(null);
    }
  }

  async function autoRecluster() {
    setBatchAction('recluster');
    try {
      const response = await fetch('/api/admin/recluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const payload = await response.json();
      if (response.ok && payload.data) {
        const { fileUpdated, databaseUpdated, totalUpdated } = payload.data;
        setMessage(`Đã phân cụm lại: ${fileUpdated} bài từ file, ${databaseUpdated} bài từ database. Tổng: ${totalUpdated} bài.`);
        loadListings();
      } else {
        setMessage(payload.error || 'Không thể phân cụm lại.');
      }
    } catch {
      setMessage('Lỗi khi phân cụm lại.');
    } finally {
      setBatchAction(null);
    }
  }

  function toggleSelection(externalId: string) {
    setSelectedListings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(externalId)) {
        newSet.delete(externalId);
      } else {
        newSet.add(externalId);
      }
      return newSet;
    });
  }

  function toggleSelectAll() {
    if (visibleListings.length > 0 && visibleListings.every((listing) => selectedListings.has(listing.externalId))) {
      setSelectedListings(new Set());
    } else {
      setSelectedListings(new Set(visibleListings.map(l => l.externalId)));
    }
  }

  const visibleListings = listings.filter((listing) => {
    const query = listingQuery.trim().toLocaleLowerCase('vi');
    const matchesQuery = !query || `${listing.title} ${listing.address ?? ''} ${listing.sourceName}`.toLocaleLowerCase('vi').includes(query);
    return matchesQuery && (listingStatus === 'all' || listing.verificationStatus === listingStatus);
  });

  async function createHtmlSource(sourceData: {
    url: string;
    name: string;
    selectors: Record<string, string>;
  }) {
    try {
      const response = await fetch('/api/collector/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sourceData)
      });
      const payload = await response.json();
      if (response.ok) {
        setMessage('Đã tạo cấu hình HTML crawler. Vui lòng thêm vào .env.local để persist.');
        loadSources();
      } else {
        setMessage(payload.error || 'Không thể tạo cấu hình.');
      }
    } catch {
      setMessage('Lỗi khi tạo cấu hình HTML crawler.');
    }
  }

  useEffect(() => {
    loadSources();
    loadListings();
    loadCommunityPosts();
    loadReports();
    loadAuditLogs();
    loadDashboard();
    loadCollectorStatus();
    if (new URLSearchParams(window.location.search).get('tab') === 'listings') {
      setActiveTab('listings');
    }
  }, []);

  useEffect(() => {
    if (!autoRun) return undefined;
    const timer = window.setInterval(() => {
      runCollector().catch(() => setMessage('Lượt tự động thất bại.'));
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [autoRun]);

  useEffect(() => {
    if (!collectorStatus?.active) return undefined;
    const timer = window.setInterval(() => {
      loadCollectorStatus();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [collectorStatus?.active]);

  return (
    <section className="admin-page">
      <div className="container">
        <div className="admin-heading">
          <div>
            <span className="eyebrow">Khu vực quản trị</span>
            <h1>Quản trị hệ thống</h1>
            <p>Quản lý nguồn dữ liệu, bài đăng và cấu hình hệ thống.</p>
          </div>
          <div className="admin-controls">
            <Link href="/" className="secondary-btn">← Về trang chủ</Link>
          </div>
        </div>

        {dashboard && <div className="admin-summary">
          <div className="admin-stat"><span>Tin đã duyệt</span><b>{dashboard.listings.publishedCount}</b></div>
          <div className="admin-stat"><span>Chờ duyệt</span><b>{dashboard.listings.pendingCount}</b></div>
          <div className="admin-stat"><span>Bị từ chối</span><b>{dashboard.listings.rejectedCount}</b></div>
          <div className="admin-stat"><span>Bài cộng đồng chờ duyệt</span><b>{dashboard.community?.pendingCount ?? 0}</b></div>
          <div className="admin-stat"><span>Lỗi collector gần nhất</span><b>{dashboard.lastRun?.errors ?? 0}</b></div>
        </div>}

        <div className="admin-tabs">
          <button 
            className={`admin-tab ${activeTab === 'collector' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('collector')}
          >
            Collector
          </button>
          <button 
            className={`admin-tab ${activeTab === 'listings' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('listings')}
          >
            Quản lý bài ({listings.length})
          </button>
          <button
            className={`admin-tab ${activeTab === 'community' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('community')}
          >
            Cộng đồng ({communityPosts.filter((post) => post.status !== 'Đã từ chối').length})
          </button>
          <button className={`admin-tab ${activeTab === 'reports' ? 'is-active' : ''}`} onClick={() => setActiveTab('reports')}>
            Báo cáo ({reports.filter((report) => report.status === 'pending').length})
          </button>
          <button className={`admin-tab ${activeTab === 'audit' ? 'is-active' : ''}`} onClick={() => setActiveTab('audit')}>
            Audit log ({auditLogs.length})
          </button>
          <button 
            className={`admin-tab ${activeTab === 'html' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('html')}
          >
            HTML Crawler
          </button>
          <button 
            className={`admin-tab ${activeTab === 'files' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            📁 File JSON
          </button>
        </div>

        {activeTab === 'collector' && (
          <>
            <div className="admin-notice">
              <strong>Chính sách nguồn:</strong> chỉ chạy API/RSS công khai đã allowlist. Không đăng nhập, không vượt CAPTCHA, không cào group kín và mọi bài mới đều cần kiểm chứng.
            </div>

            {/* Thông báo hướng dẫn khi chưa có nguồn */}
            {sources.filter(s => s.enabled).length === 0 && (
              <div className="admin-notice guide-notice">
                <strong>📋 Hướng dẫn bắt đầu:</strong>
                <ol>
                  <li>Sử dụng <strong>Import</strong> bên dưới để nhập dữ liệu từ file CSV/JSON (khuyên dùng)</li>
                  <li>Hoặc cấu hình <code>PUBLIC_FEED_URL</code> trong <code>.env.local</code> cho nguồn JSON</li>
                  <li>Hoặc cấu hình <code>HTML_CRAWLER_URL</code> trong <code>.env.local</code> cho nguồn HTML</li>
                  <li>Sau đó click <strong>"Chạy ngay"</strong> để thu thập dữ liệu</li>
                </ol>
              </div>
            )}

            <div className="import-panel">
              <div className="admin-section-head">
                <div>
                  <h2>📥 Nhập dữ liệu có quyền sử dụng</h2>
                  <p>Tải CSV/JSON hoặc dán nội dung tin từ các nguồn bạn có quyền sử dụng để lọc và lưu vào hệ thống.</p>
                </div>
              </div>
              <div className="import-controls">
                <label className="secondary-btn">
                  Chọn CSV/JSON
                  <input 
                    type="file" 
                    accept=".csv,.json,application/json,text/csv" 
                    hidden 
                    onChange={(event) => setImportFile(event.target.files?.[0] ?? null)} 
                  />
                </label>
                <select 
                  value={importFormat} 
                  onChange={(event) => setImportFormat(event.target.value as 'json' | 'csv')} 
                  aria-label="Định dạng nội dung"
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
                <label className="toggle-control">
                  <input 
                    type="checkbox" 
                    checked={useAi} 
                    onChange={(event) => setUseAi(event.target.checked)} 
                  /> 
                  Chỉnh lý bằng Ollama
                </label>
              </div>
              {importFile ? (
                <p className="file-name">Đã chọn: {importFile.name}</p>
              ) : (
                <textarea 
                  className="import-textarea" 
                  value={importContent} 
                  onChange={(event) => setImportContent(event.target.value)} 
                  placeholder="Dán JSON hoặc CSV tại đây..." 
                  rows={7} 
                />
              )}
              <button 
                className="primary-btn" 
                onClick={importListings} 
                disabled={isImporting || (!importFile && !importContent.trim())}
              >
                {isImporting ? 'Đang xử lý...' : 'Lọc và nhập dữ liệu'}
              </button>
            </div>

            <div className="import-panel url-crawl-panel">
              <div className="admin-section-head">
                <div>
                  <h2>🌐 Cào thử một URL công khai</h2>
                  <p>Nhập trang HTTPS bất kỳ được phép truy cập. Hệ thống tự nhận diện JSON, RSS, JSON-LD, Open Graph và card HTML, sau đó luôn đưa tin vào hàng chờ duyệt.</p>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="crawl-url">URL nguồn công khai</label>
                <input id="crawl-url" value={crawlUrl} onChange={(event) => setCrawlUrl(event.target.value)} placeholder="https://ten-website.vn/phong-tro" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); previewUrl(); } }} />
              </div>
              <div className="form-group">
                <label htmlFor="crawl-pages">Số trang tối đa</label>
                <select id="crawl-pages" value={crawlMaxPages} onChange={(event) => setCrawlMaxPages(Number(event.target.value))}>
                  <option value={1}>1 trang</option><option value={3}>3 trang</option><option value={5}>5 trang</option><option value={10}>10 trang</option><option value={20}>20 trang</option>
                </select>
              </div>
              <div className="admin-controls">
                <button className="primary-btn" onClick={previewUrl} disabled={isPreviewingUrl || !crawlUrl.trim()}>{isPreviewingUrl ? 'Đang phân tích...' : 'Phân tích URL'}</button>
                {crawlPreview?.data && <button className="success-btn" onClick={importCrawlPreview} disabled={isImportingPreview || crawlPreview.data.length === 0}>{isImportingPreview ? 'Đang lưu...' : `Đưa ${crawlPreview.data.length} tin vào chờ duyệt`}</button>}
              </div>
              {crawlPreview?.meta && <p className="admin-status-note">Định dạng: <strong>{crawlPreview.meta.format}</strong> · đã đọc {crawlPreview.meta.pages ?? 1}/{crawlPreview.meta.maxPages ?? crawlMaxPages} trang · nhận diện {crawlPreview.meta.received} tin{crawlPreview.meta.limited ? ' (đã giới hạn 100 tin)' : ''}{crawlPreview.meta.robots?.warning ? ` · ${crawlPreview.meta.robots.warning}` : ''}</p>}
              {crawlPreview?.error && <p className="error-message">{crawlPreview.error}</p>}
              {crawlPreview?.data && <div className="admin-results import-results">
                {crawlPreview.data.slice(0, 20).map((item) => <div className="run-row" key={item.externalId}>
                  <span><strong>{item.title}</strong><small>{item.price ? `${item.price.toLocaleString('vi-VN')}đ/tháng` : 'Chưa rõ giá'} · {item.area ? `${item.area}m²` : '—'} · {item.address || 'Chưa rõ khu vực'}</small></span>
                  <b>Chờ duyệt</b>
                </div>)}
                {crawlPreview.data.length === 0 && <p className="empty-state">Không tìm thấy tin phù hợp. Trang có thể cần JavaScript hoặc không chứa từ khóa phòng/nhà cho thuê.</p>}
              </div>}
            </div>

            <div className="admin-summary">
              <div className="admin-stat"><span>Nguồn đã khai báo</span><b>{sources.length}</b></div>
              <div className="admin-stat"><span>Nguồn đang bật</span><b>{sources.filter((source) => source.enabled).length}</b></div>
              <div className="admin-stat"><span>Bản ghi lượt gần nhất</span><b>{run?.meta.collected ?? 0}</b></div>
            </div>
            <p className="admin-status-note">
              {collectorStatus?.active
                ? `Collector đang chạy từ ${new Date(collectorStatus.startedAt ?? Date.now()).toLocaleString('vi-VN')}.`
                : collectorStatus?.lastRun
                  ? `Lần chạy gần nhất: ${new Date(collectorStatus.lastRun.ranAt).toLocaleString('vi-VN')}.`
                  : 'Chưa có lượt collector nào được ghi nhận.'}
            </p>

            <div className="admin-section-head">
              <div>
                <h2>Nguồn dữ liệu</h2>
                <p>URL được cấu hình trong <code>js/collector.js</code> và <code>.env.local</code>.</p>
              </div>
              <div className="admin-controls">
                <label className="toggle-control">
                  <input 
                    type="checkbox" 
                    checked={autoRun} 
                    onChange={(event) => setAutoRun(event.target.checked)} 
                  /> 
                  <span>Tự chạy mỗi 6 giờ</span>
                </label>
                <button 
                  className="primary-btn" 
                  onClick={runCollector} 
                  disabled={isRunning || collectorStatus?.active === true}
                >
                  {isRunning || collectorStatus?.active ? 'Đang chạy...' : 'Chạy ngay'}
                </button>
              </div>
            </div>
            <div className="source-table">
              {sources.map((source) => (
                <div className="source-row" key={source.id}>
                  <div>
                    <strong>{source.name}</strong>
                    <span>{source.note}</span>
                    {source.url && <small>{source.url}</small>}
                  </div>
                  <div className="listing-actions">
                    <span className={`source-status ${source.result?.ok ? 'is-ready' : ''}`} title={source.result?.note || source.note}>
                      {source.result?.ok ? '● Khỏe' : source.enabled ? '● Cần kiểm tra' : '○ Chưa bật'}
                    </span>
                    <button className={source.enabled ? 'danger-btn' : 'success-btn'} onClick={() => toggleSource(source)}>
                      {source.enabled ? 'Tắt nguồn' : 'Bật nguồn'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {run && (
              <div className="admin-results">
                <div className="admin-section-head">
                  <div>
                    <h2>Kết quả gần nhất</h2>
                    <p>{new Date(run.meta.ranAt).toLocaleString('vi-VN')}</p>
                  </div>
                </div>
                {run.data.length === 0 ? (
                  <p className="empty-state">Chưa có nguồn công khai nào được cấu hình.</p>
                ) : (
                  run.data.map((item) => (
                    <div className="run-row" key={item.sourceId}>
                      <span>{item.sourceName}</span>
                      <b className={item.status === 'success' ? 'result-success' : 'result-error'} title={item.warning || item.error}>
                        {item.status === 'success' ? `${item.count} bài${item.warning ? ' · parser không lấy được tin' : ''}` : item.error}
                      </b>
                    </div>
                  ))
                )}
              </div>
            )}

            {importResult?.data && (
              <div className="admin-results import-results">
                <div className="admin-section-head">
                  <div>
                    <h2>Preview dữ liệu nhập</h2>
                    <p>
                      {importResult.stats?.irrelevant ?? 0} tin không liên quan, 
                      {importResult.stats?.duplicates ?? 0} tin trùng, 
                      đã lưu {importResult.saved ?? 0} tin.
                    </p>
                  </div>
                </div>
                {importResult.data.slice(0, 20).map((item, index) => (
                  <div className="run-row" key={`${item.title}-${index}`}>
                    <span>
                      <strong>{item.title}</strong>
                      <small>
                        {item.price ?? 'Chưa rõ giá'} · {item.area ?? '—'} m² · {item.address ?? 'Chưa rõ khu vực'}
                      </small>
                    </span>
                    <b>{item.aiAnalysis?.riskLevel ?? 'needs_review'}</b>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'listings' && (
          <>
            <div className="admin-section-head">
              <div>
                <h2>Quản lý bài đăng</h2>
                <p>Xem xét và duyệt các bài đăng từ hệ thống.</p>
              </div>
              <div className="admin-controls">
                {selectedListings.size > 0 && (
                  <>
                    <button
                      className="success-btn"
                      onClick={() => batchUpdateStatus('verified')}
                      disabled={batchAction !== null}
                    >
                      {batchAction === 'verified' ? 'Đang xử lý...' : `Duyệt ${selectedListings.size} bài`}
                    </button>
                    <button
                      className="danger-btn"
                      onClick={() => batchUpdateStatus('rejected')}
                      disabled={batchAction !== null}
                    >
                      {batchAction === 'rejected' ? 'Đang xử lý...' : `Từ chối ${selectedListings.size} bài`}
                    </button>
                  </>
                )}
                <button className="secondary-btn" onClick={autoRecluster} disabled={batchAction !== null}>
                  {batchAction === 'recluster' ? 'Đang phân cụm...' : 'Tự động phân cụm'}
                </button>
                <button className="secondary-btn" onClick={loadListings} disabled={loadingListings}>
                  {loadingListings ? 'Đang tải...' : 'Tải lại'}
                </button>
              </div>
            </div>

            <div className="feed-filters admin-listing-filters">
              <input value={listingQuery} onChange={(event) => setListingQuery(event.target.value)} placeholder="Tìm tiêu đề, địa chỉ hoặc nguồn..." aria-label="Tìm bài đăng quản trị" />
              <select value={listingStatus} onChange={(event) => setListingStatus(event.target.value)} aria-label="Lọc trạng thái bài đăng">
                <option value="all">Tất cả trạng thái</option>
                <option value="needs_review">Chờ duyệt</option>
                <option value="verified">Đã duyệt</option>
                <option value="rejected">Từ chối</option>
              </select>
            </div>

            {listings.length === 0 ? (
              <div className="empty-state">
                <p>Chưa có bài đăng nào từ các nguồn dữ liệu.</p>
                <p>Hãy cấu hình và bật nguồn dữ liệu, sau đó chạy collector để thu thập bài đăng.</p>
              </div>
            ) : (
              <>
                {listings.length > 0 && (
                  <div className="batch-actions-bar">
                    <label className="toggle-control">
                      <input
                        type="checkbox"
                        checked={visibleListings.length > 0 && visibleListings.every((listing) => selectedListings.has(listing.externalId))}
                        onChange={toggleSelectAll}
                      />
                      <span>Chọn tất cả ({selectedListings.size}/{visibleListings.length})</span>
                    </label>
                  </div>
                )}
                <div className="source-table">
                  {visibleListings.map((listing) => (
                    <div className={`source-row ${selectedListings.has(listing.externalId) ? 'is-selected' : ''}`} key={listing.externalId}>
                      <label className="listing-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedListings.has(listing.externalId)}
                          onChange={() => toggleSelection(listing.externalId)}
                        />
                      </label>
                      <div className="listing-content">
                        <strong>{listing.title}</strong>
                        <span>{listing.price ? `${listing.price.toLocaleString('vi-VN')}đ/tháng` : 'Chưa rõ giá'} · {listing.area ? `${listing.area}m²` : '—'}</span>
                        <small>{listing.address || 'Chưa rõ địa chỉ'} · {listing.sourceName}</small>
                      </div>
                      <div className="listing-actions">
                        <span className={`status-badge ${listing.verificationStatus}`}>
                          {listing.verificationStatus === 'verified' ? 'Đã duyệt' : listing.verificationStatus === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
                        </span>
                        <select
                          value={listing.verificationStatus}
                          onChange={(e) => updateListingStatus(listing.externalId, e.target.value)}
                          className="status-select"
                        >
                          <option value="needs_review">Cần kiểm chứng</option>
                          <option value="verified">Đã duyệt</option>
                          <option value="rejected">Từ chối</option>
                        </select>
                        <Link href={`/bai/${listing.externalId}`} className="secondary-btn" target="_blank">
                          Xem
                        </Link>
                      </div>
                    </div>
                  ))}
                  {visibleListings.length === 0 && <div className="empty-state"><p>Không có bản ghi phù hợp bộ lọc.</p></div>}
                </div>
              </>
            )}
          </>
        )}

        {activeTab === 'community' && (
          <>
            <div className="admin-section-head">
              <div>
                <h2>Kiểm duyệt cộng đồng</h2>
                <p>Bài viết chỉ xuất hiện công khai sau khi được quản trị viên xác minh.</p>
              </div>
              <button className="secondary-btn" onClick={loadCommunityPosts} disabled={loadingCommunity}>
                {loadingCommunity ? 'Đang tải...' : 'Tải lại'}
              </button>
            </div>
            {communityPosts.length === 0 ? (
              <div className="empty-state"><p>Chưa có bài cộng đồng nào cần xử lý.</p></div>
            ) : (
              <div className="source-table">
                {communityPosts.map((post) => (
                  <div className="source-row" key={post.id}>
                    <div className="listing-content">
                      <strong>{post.title}</strong>
                      <span>{post.authorName || 'Thành viên'} · {post.clusterName} · {post.comments} bình luận</span>
                      <small>{post.summary}</small>
                    </div>
                    <div className="listing-actions">
                      <span className={`status-badge ${post.status}`}>{post.status === 'Còn phòng' ? 'Đã duyệt' : post.status === 'Đã từ chối' ? 'Từ chối' : 'Chờ duyệt'}</span>
                      <button className="success-btn" onClick={() => updateCommunityStatus(post.id, 'verified')}>Duyệt</button>
                      <button className="danger-btn" onClick={() => updateCommunityStatus(post.id, 'rejected')}>Từ chối</button>
                      <Link href={`/bai/${post.id}`} className="secondary-btn" target="_blank">Xem</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'reports' && (
          <>
            <div className="admin-section-head">
              <div><h2>Báo cáo cộng đồng</h2><p>Kiểm tra nội dung bị người dùng đánh dấu và quyết định xử lý.</p></div>
              <button className="secondary-btn" onClick={loadReports}>Tải lại</button>
            </div>
            {reports.length === 0 ? <div className="empty-state"><p>Chưa có báo cáo nào.</p></div> : <div className="source-table">
              {reports.map((report) => <div className="source-row" key={report.id}>
                <div className="listing-content"><strong>{report.title}</strong><span>{report.reporterName} · {report.reason} · {new Date(report.createdAt).toLocaleString('vi-VN')}</span><small>{report.details || 'Không có mô tả thêm'}</small></div>
                <div className="listing-actions"><span className={`status-badge ${report.status}`}>{report.status}</span><Link href={`/bai/${report.postId}`} className="secondary-btn" target="_blank">Xem bài</Link><button className="success-btn" onClick={() => updateReport(report.id, 'resolved')}>Đã xử lý</button><button className="secondary-btn" onClick={() => updateReport(report.id, 'dismissed')}>Bỏ qua</button></div>
              </div>)}
            </div>}
          </>
        )}

        {activeTab === 'audit' && (
          <>
            <div className="admin-section-head">
              <div><h2>Audit log</h2><p>Lịch sử duyệt, từ chối và xử lý báo cáo trong hệ thống.</p></div>
              <button className="secondary-btn" onClick={loadAuditLogs}>Tải lại</button>
            </div>
            {auditLogs.length === 0 ? <div className="empty-state"><p>Chưa có audit log hoặc MySQL chưa được cấu hình.</p></div> : <div className="source-table">
              {auditLogs.map((log) => <div className="source-row" key={log.id}>
                <div className="listing-content"><strong>{log.action}</strong><span>{log.entityType} · {log.entityId}</span><small>{log.actorEmail || 'Hệ thống'} · {new Date(log.createdAt).toLocaleString('vi-VN')}</small></div>
                <span className="source-status is-ready">Đã ghi nhận</span>
              </div>)}
            </div>}
          </>
        )}

        {activeTab === 'html' && (
          <>
            <div className="admin-notice">
              <strong>HTML Crawler:</strong> Chỉ sử dụng cho các nguồn đã cho phép truy cập. Không tự động cào Nhà Tốt, Batdongsan.
            </div>

            <div className="import-panel">
              <div className="admin-section-head">
                <div>
                  <h2>Thêm nguồn HTML mới</h2>
                  <p>Cấu hình selectors cho website muốn thu thập.</p>
                </div>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                createHtmlSource({
                  url: formData.get('url') as string,
                  name: formData.get('name') as string,
                  selectors: {
                    itemSelector: formData.get('itemSelector') as string,
                    titleSelector: formData.get('titleSelector') as string,
                    descriptionSelector: formData.get('descriptionSelector') as string,
                    priceSelector: formData.get('priceSelector') as string,
                    areaSelector: formData.get('areaSelector') as string,
                    addressSelector: formData.get('addressSelector') as string,
                  }
                });
              }}>
                <div className="form-group">
                  <label>Tên nguồn</label>
                  <input name="name" placeholder="Ví dụ: CafeLand" required />
                </div>
                <div className="form-group">
                  <label>URL</label>
                  <input name="url" placeholder="https://example.com/listings" required />
                </div>
                <div className="form-group">
                  <label>Item Selector</label>
                  <input name="itemSelector" placeholder="div.listing-item" defaultValue="div.listing-item" />
                </div>
                <div className="form-group">
                  <label>Title Selector</label>
                  <input name="titleSelector" placeholder="h2.title" defaultValue="h2.title" />
                </div>
                <div className="form-group">
                  <label>Description Selector</label>
                  <input name="descriptionSelector" placeholder="div.description" defaultValue="div.description" />
                </div>
                <div className="form-group">
                  <label>Price Selector</label>
                  <input name="priceSelector" placeholder="span.price" defaultValue="span.price" />
                </div>
                <div className="form-group">
                  <label>Area Selector</label>
                  <input name="areaSelector" placeholder="span.area" defaultValue="span.area" />
                </div>
                <div className="form-group">
                  <label>Address Selector</label>
                  <input name="addressSelector" placeholder="div.address" defaultValue="div.address" />
                </div>
                <button type="submit" className="primary-btn">Tạo cấu hình</button>
              </form>
            </div>

            <div className="admin-section-head">
              <div>
                <h2>Nguồn HTML hiện tại</h2>
                <p>Các nguồn đã cấu hình trong hệ thống.</p>
              </div>
            </div>
            <div className="source-table">
              {sources.filter(s => s.type === 'html' || s.permission === 'public_html').map((source) => (
                <div className="source-row" key={source.id}>
                  <div>
                    <strong>{source.name}</strong>
                    <span>{source.url}</span>
                    {source.listingSelectors && (
                      <small>
                        Items: {source.listingSelectors.itemSelector}, 
                        Title: {source.listingSelectors.titleSelector}
                      </small>
                    )}
                  </div>
                  <span className={`source-status ${source.enabled ? 'is-ready' : ''}`}>
                    {source.enabled ? 'Đã bật' : 'Chưa bật'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'files' && (
          <FileManagerClient />
        )}

        <div className="admin-section-head">
          <span className="admin-message">{message}</span>
        </div>
      </div>
    </section>
  );
}
