import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, ComposedChart, PieChart, Pie, Cell
} from 'recharts';
import * as LucideIcons from 'lucide-react';

// ============================================
// ===== 案件設定（ここだけ変更してください） =====
// ============================================
const CONFIG = {
  TITLE: 'ACQUA GROUP LINEダッシュボード',

  // --- データ取得方法（どちらか一方を設定） ---
  
  // 方法A: テスト用（スプシを「ウェブに公開」してCSV URLを貼る。ログイン不要）
  CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTwVpKVhJ3eunj2VX8Ibye67mm4-QQ0r7NvdboXGaXhKBsvIdlVQegmz6YfhODRygNmall2XX3i_4Pz/pub?gid=1922873880&single=true&output=csv',
  
  // 方法B: 本番用（プロキシ経由。ログイン必須・アクセス制御あり）
  SHEET_URL: '',  // スプレッドシートのURLをそのまま貼る
  PROXY_URL: 'https://line-ai.your-domain.workers.dev',
  GOOGLE_CLIENT_ID: 'xxxx.apps.googleusercontent.com',
  SHEET_NAME: 'シート1',
};
// ============================================

const COLORS = { 
  primary: "#2563eb",    // 深い青
  secondary: "#7c3aed",  // 紫
  success: "#059669",    // 深緑
  warning: "#d97706",    // 琥珀
  danger: "#dc2626",     // 赤
  info: "#0891b2",       // ティール
  muted: "#94a3b8"       // グレー（補助テキスト用）
};
const PIE_COLORS = [
  "#2563eb", "#059669", "#7c3aed", "#d97706", "#dc2626", 
  "#0891b2", "#db2777", "#65a30d", "#9333ea", "#ef4444", "#0d9488"
];

// --- Helper Functions ---
const getSheetId = (url: string) => {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : url;
};

const parseDate = (dateStr: any) => {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (!s) return null;
  const match = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (match) {
    const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    return isNaN(d.getTime()) ? null : d;
  }
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};

const formatMonth = (date: Date | null) => {
  if (!date) return null;
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月`;
};

const hasTag = (val: any) => {
  if (!val) return false;
  const s = String(val).trim();
  return s !== '' && s !== '0';
};

const isTrue = (val: any) => {
  if (!val) return false;
  const s = String(val).trim();
  return s === '1' || s === '１' || s.toLowerCase() === 'true';
};

// --- UI Components ---
const IconComp = ({ name, size = 18, className = "" }: { name: string, size?: number, className?: string }) => {
  const iconName = name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('') as keyof typeof LucideIcons;
  const Icon = (LucideIcons[iconName] || LucideIcons.HelpCircle) as React.ElementType;
  return <Icon size={size} className={className} />;
};

const InfoTooltip = ({ text }: { text: string }) => (
  <div className="relative group inline-flex items-center ml-1.5 z-[100] align-middle">
    <IconComp name="info" size={14} className="text-slate-400 cursor-help hover:text-blue-600 transition-colors" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-max max-w-[280px] bg-slate-800 text-white text-[11px] p-3 rounded-lg shadow-xl whitespace-pre-wrap leading-relaxed border border-slate-700 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-[100]">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-800"></div>
    </div>
  </div>
);

const KPICard = ({ title, value, unit, icon, colorName = "blue", info, subText }: any) => {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-emerald-50 text-emerald-600 border-emerald-100",
    purple: "bg-violet-50 text-violet-600 border-violet-100",
    orange: "bg-amber-50 text-amber-600 border-amber-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    slate: "bg-slate-50 text-slate-600 border-slate-100",
    pink: "bg-pink-50 text-pink-600 border-pink-100"
  };
  const theme = colors[colorName] || colors.blue;
  return (
    <div className="glass p-5 rounded-2xl card-hover relative flex flex-col justify-between min-h-[120px]">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-3 rounded-xl ${theme} border`}>
          <IconComp name={icon} size={20} />
        </div>
      </div>
      <div>
        <h3 className="text-slate-400 text-[10px] font-bold tracking-[0.15em] uppercase mb-1 flex items-center">
          {title}
          {info && <InfoTooltip text={info} />}
        </h3>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-slate-800 tracking-tight font-serif">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
          <span className="text-slate-400 text-xs font-bold">{unit}</span>
        </div>
        {subText && <p className="text-[10px] text-slate-400 mt-1 font-bold">{subText}</p>}
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-xl border border-slate-200 text-xs z-[100]">
        <p className="font-bold text-slate-700 mb-2 text-sm font-serif">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
            <span className="text-slate-500 font-medium">{entry.name}:</span>
            <span className="font-bold text-slate-800">
              {entry.value ? entry.value.toLocaleString() : 0}
              {entry.name.includes('率') ? '%' : ''}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// --- Data Fetching ---
function fetchViaCSV(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(CONFIG.CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => resolve(results.data),
      error: (error) => reject(error)
    });
  });
}

async function fetchViaProxy(): Promise<any[]> {
  const token = localStorage.getItem('google_id_token');
  const res = await fetch(`${CONFIG.PROXY_URL}/sheets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ sheetId: getSheetId(CONFIG.SHEET_URL), sheetName: CONFIG.SHEET_NAME })
  });
  if (res.status === 403) {
    throw new Error('アクセス権がありません。スプレッドシートの共有設定を管理者に確認してください。');
  }
  const json = await res.json();
  return json.rows.map((row: any[]) => {
    const obj: any = {};
    json.headers.forEach((h: string, i: number) => { obj[h] = row[i] || ''; });
    return obj;
  });
}

async function fetchSheetData() {
  if (CONFIG.CSV_URL) {
    return await fetchViaCSV();
  }
  return await fetchViaProxy();
}

// --- Main App Component ---
export default function App() {
  const [rawData, setRawData] = useState<any[]>([]);
  const [keysMap, setKeysMap] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Auth state
  const isTestMode = !!CONFIG.CSV_URL;
  const [isAuthenticated, setIsAuthenticated] = useState(isTestMode || !!localStorage.getItem('google_id_token'));

  // Filter state
  const [dateFilter, setDateFilter] = useState('all');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSheetData();
      if (data.length > 0) {
        setKeysMap(Object.keys(data[0]));
      }
      setRawData(data);
      
      // Extract available months
      const months = new Set<string>();
      data.forEach(row => {
        const d = parseDate(row['友だち追加日時']);
        if (d) {
          const m = formatMonth(d);
          if (m) months.add(m);
        }
      });
      setAvailableMonths(Array.from(months).sort().reverse());
      
      setLoading(false);
    } catch (error: any) {
      setErrorMsg(`データの取得に失敗しました: ${error.message}`);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, fetchData]);

  // Handle Google Sign-In
  useEffect(() => {
    if (!isTestMode && !isAuthenticated) {
      const initGoogleAuth = () => {
        if (window.google) {
          window.google.accounts.id.initialize({
            client_id: CONFIG.GOOGLE_CLIENT_ID,
            callback: (response: any) => {
              localStorage.setItem('google_id_token', response.credential);
              setIsAuthenticated(true);
            }
          });
          window.google.accounts.id.renderButton(
            document.getElementById("google-signin-button"),
            { theme: "outline", size: "large" }
          );
        } else {
          setTimeout(initGoogleAuth, 100);
        }
      };
      initGoogleAuth();
    }
  }, [isTestMode, isAuthenticated]);

  const handleLogout = () => {
    localStorage.removeItem('google_id_token');
    setIsAuthenticated(false);
    setRawData([]);
  };

  // Filtered Data
  const filteredData = useMemo(() => {
    return rawData.filter(row => {
      if (isTrue(row['ユーザーブロック'])) return false;
      
      if (dateFilter !== 'all') {
        const d = parseDate(row['友だち追加日時']);
        if (!d || formatMonth(d) !== dateFilter) return false;
      }
      return true;
    });
  }, [rawData, dateFilter]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter]);

  // --- Aggregations ---
  const stats = useMemo(() => {
    const total = filteredData.length;
    
    // KPIs
    const enqueteAnswered = filteredData.filter(r => isTrue(r['【全体】【CV】アンケート誘導_回答済み']) || isTrue(r['【OG1】【CV】アンケート誘導_回答済み']) || isTrue(r['【OG2】【CV】アンケート誘導_回答済み'])).length;
    const interviewReserved = filteredData.filter(r => isTrue(r['【全体】【CV】カジュアル面談_予約済み']) || isTrue(r['【OG1】【CV】カジュアル面談_予約済み']) || isTrue(r['【OG2】【CV】カジュアル面談_予約済み'])).length;
    const interviewCompleted = filteredData.filter(r => isTrue(r['【CV】カジュアル面談_完了'])).length;
    const interviewCanceled = filteredData.filter(r => isTrue(r['カジュアル面談_キャンセル'])).length;

    // Scenarios - OG1 Enquete
    const og1Enquete = [
      { name: '登録直後', target: filteredData.filter(r => isTrue(r['【OG1】【対象者】アンケート誘導_登録直後'])).length, tap: filteredData.filter(r => isTrue(r['【OG1】【タップ】アンケート誘導_登録直後'])).length },
      { name: '10分後', target: filteredData.filter(r => isTrue(r['【OG1】【対象者】アンケート誘導_10分後'])).length, tap: filteredData.filter(r => isTrue(r['【OG1】【タップ】アンケート誘導_10分後'])).length },
      { name: '1時間後', target: filteredData.filter(r => isTrue(r['【OG1】【対象者】アンケート誘導_1時間後'])).length, tap: filteredData.filter(r => isTrue(r['【OG1】【タップ】アンケート誘導_1時間後'])).length },
      { name: '1日後', target: filteredData.filter(r => isTrue(r['【OG1】【対象者】アンケート誘導_1日後 12:23']) || isTrue(r['【OG1】【対象者】アンケート誘導_1日後 20:03'])).length, tap: filteredData.filter(r => isTrue(r['【OG1】【タップ】アンケート誘導_1日後 12:23']) || isTrue(r['【OG1】【タップ】アンケート誘導_1日後 20:03'])).length },
    ].map(d => ({ ...d, rate: d.target > 0 ? Math.round((d.tap / d.target) * 1000) / 10 : 0 }));

    // Scenarios - OG2 Enquete
    const og2Enquete = [
      { name: '登録直後', target: filteredData.filter(r => isTrue(r['【OG2】【対象者】アンケート誘導_登録直後'])).length, tap: filteredData.filter(r => isTrue(r['【OG2】【タップ】アンケート誘導_登録直後'])).length },
      { name: '10分後', target: filteredData.filter(r => isTrue(r['【OG2】【対象者】アンケート誘導_10分後'])).length, tap: filteredData.filter(r => isTrue(r['【OG2】【タップ】アンケート誘導_10分後'])).length },
      { name: '1時間後', target: filteredData.filter(r => isTrue(r['【OG2】【対象者】アンケート誘導_1時間後'])).length, tap: filteredData.filter(r => isTrue(r['【OG2】【タップ】アンケート誘導_1時間後'])).length },
      { name: '1日後', target: filteredData.filter(r => isTrue(r['【OG2】【対象者】アンケート誘導_1日後 12:23']) || isTrue(r['【OG2】【対象者】アンケート誘導_1日後 20:03'])).length, tap: filteredData.filter(r => isTrue(r['【OG2】【タップ】アンケート誘導_1日後 12:23']) || isTrue(r['【OG2】【タップ】アンケート誘導_1日後 20:03'])).length },
    ].map(d => ({ ...d, rate: d.target > 0 ? Math.round((d.tap / d.target) * 1000) / 10 : 0 }));

    // Scenarios - Post Enquete (Host)
    const postEnqueteHost = [
      { name: '直後', target: filteredData.filter(r => isTrue(r['【OG1】【対象者】アンケート回答後：ホスト_アンケート回答直後']) || isTrue(r['【OG2】【対象者】アンケート回答後：ホスト_アンケート回答直後'])).length, tap: filteredData.filter(r => isTrue(r['【OG1】【タップ】アンケート回答後：ホスト_アンケート回答直後']) || isTrue(r['【OG2】【タップ】アンケート回答後：ホスト_アンケート回答直後'])).length },
      { name: '1時間後', target: filteredData.filter(r => isTrue(r['【OG1】【対象者】アンケート回答後：ホスト_1時間後 面談誘導']) || isTrue(r['【OG2】【対象者】アンケート回答後：ホスト_1時間後 面談誘導'])).length, tap: filteredData.filter(r => isTrue(r['【OG1】【タップ】アンケート回答後：ホスト_1時間後 面談誘導']) || isTrue(r['【OG2】【タップ】アンケート回答後：ホスト_1時間後 面談誘導'])).length },
      { name: '1日後', target: filteredData.filter(r => isTrue(r['【OG1】【対象者】アンケート回答後：ホスト_1日後 19:03 面談誘導']) || isTrue(r['【OG2】【対象者】アンケート回答後：ホスト_1日後 19:03 面談誘導'])).length, tap: filteredData.filter(r => isTrue(r['【OG1】【タップ】アンケート回答後：ホスト_1日後 19:03 面談誘導']) || isTrue(r['【OG2】【タップ】アンケート回答後：ホスト_1日後 19:03 面談誘導'])).length },
      { name: '2日後', target: filteredData.filter(r => isTrue(r['【OG1】【対象者】アンケート回答後：ホスト_2日後 12:07 面談誘導']) || isTrue(r['【OG2】【対象者】アンケート回答後：ホスト_2日後 12:07 面談誘導'])).length, tap: filteredData.filter(r => isTrue(r['【OG1】【タップ】アンケート回答後：ホスト_2日後 12:07 面談誘導']) || isTrue(r['【OG2】【タップ】アンケート回答後：ホスト_2日後 12:07 面談誘導'])).length },
      { name: '3日後', target: filteredData.filter(r => isTrue(r['【OG1】【対象者】アンケート回答後：ホスト_3日後 20:03 面談誘導']) || isTrue(r['【OG2】【対象者】アンケート回答後：ホスト_3日後 20:03 面談誘導'])).length, tap: filteredData.filter(r => isTrue(r['【OG1】【タップ】アンケート回答後：ホスト_3日後 20:03 面談誘導']) || isTrue(r['【OG2】【タップ】アンケート回答後：ホスト_3日後 20:03 面談誘導'])).length },
    ].map(d => ({ ...d, rate: d.target > 0 ? Math.round((d.tap / d.target) * 1000) / 10 : 0 }));

    // Attributes - Jobs
    const jobs = ['あおい会長の元', 'キャバクラ', 'ホスト', '内勤', 'その他'];
    const jobData = jobs.map(job => {
      const users = filteredData.filter(r => isTrue(r[`職種_${job}`]));
      const cv = users.filter(r => isTrue(r['【全体】【CV】カジュアル面談_予約済み']) || isTrue(r['【OG1】【CV】カジュアル面談_予約済み']) || isTrue(r['【OG2】【CV】カジュアル面談_予約済み'])).length;
      return {
        name: job,
        count: users.length,
        cvRate: users.length > 0 ? Math.round((cv / users.length) * 1000) / 10 : 0
      };
    }).filter(d => d.count > 0);

    // Attributes - Ages
    const ages = ['24歳以下', '25〜29歳', '30〜34歳', '35歳以上'];
    const ageData = ages.map(age => {
      const users = filteredData.filter(r => isTrue(r[`年代_${age}`]));
      const cv = users.filter(r => isTrue(r['【全体】【CV】カジュアル面談_予約済み']) || isTrue(r['【OG1】【CV】カジュアル面談_予約済み']) || isTrue(r['【OG2】【CV】カジュアル面談_予約済み'])).length;
      return {
        name: age,
        count: users.length,
        cvRate: users.length > 0 ? Math.round((cv / users.length) * 1000) / 10 : 0
      };
    }).filter(d => d.count > 0);

    // Attributes - Locations
    const locations = ['北海道・東北', '関東', '歌舞伎町', '中部・近畿', '関西', '中国・四国・九州・沖縄'];
    const locData = locations.map(loc => {
      const users = filteredData.filter(r => isTrue(r[`勤務地_${loc}`]));
      const cv = users.filter(r => isTrue(r['【全体】【CV】カジュアル面談_予約済み']) || isTrue(r['【OG1】【CV】カジュアル面談_予約済み']) || isTrue(r['【OG2】【CV】カジュアル面談_予約済み'])).length;
      return {
        name: loc,
        count: users.length,
        cvRate: users.length > 0 ? Math.round((cv / users.length) * 1000) / 10 : 0
      };
    }).filter(d => d.count > 0);

    // Traffic Sources
    const sourcesMap: Record<string, { count: number, cv: number }> = {};
    filteredData.forEach(r => {
      const src = r['流入経路：最新'] || '不明';
      if (!sourcesMap[src]) sourcesMap[src] = { count: 0, cv: 0 };
      sourcesMap[src].count++;
      if (isTrue(r['【全体】【CV】カジュアル面談_予約済み']) || isTrue(r['【OG1】【CV】カジュアル面談_予約済み']) || isTrue(r['【OG2】【CV】カジュアル面談_予約済み'])) {
        sourcesMap[src].cv++;
      }
    });
    const sourceData = Object.entries(sourcesMap).map(([name, data]) => ({
      name,
      count: data.count,
      cvRate: data.count > 0 ? Math.round((data.cv / data.count) * 1000) / 10 : 0
    })).sort((a, b) => b.count - a.count);

    // Rich Menu
    const rmItems = ['FAQ', 'WEB', 'YouTube', 'アンケート回答', 'カジュアル面談予約'];
    const rmData = rmItems.map(item => {
      const target = filteredData.filter(r => isTrue(r[`【対象者】RM_${item}`])).length;
      const tap = filteredData.filter(r => isTrue(r[`【タップ】RM_${item}`])).length;
      return {
        name: item,
        target,
        tap,
        rate: target > 0 ? Math.round((tap / target) * 1000) / 10 : 0
      };
    });

    const faqItems = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'];
    const faqData = faqItems.map(q => ({
      name: q,
      tap: filteredData.filter(r => isTrue(r[`【タップ】FAQ_${q}`])).length
    }));

    return {
      total,
      enqueteAnswered,
      enqueteRate: total > 0 ? Math.round((enqueteAnswered / total) * 1000) / 10 : 0,
      interviewReserved,
      reserveRate: total > 0 ? Math.round((interviewReserved / total) * 1000) / 10 : 0,
      interviewCompleted,
      completeRate: interviewReserved > 0 ? Math.round((interviewCompleted / interviewReserved) * 1000) / 10 : 0,
      interviewCanceled,
      cancelRate: interviewReserved > 0 ? Math.round((interviewCanceled / interviewReserved) * 1000) / 10 : 0,
      og1Enquete,
      og2Enquete,
      postEnqueteHost,
      jobData,
      ageData,
      locData,
      sourceData,
      rmData,
      faqData
    };
  }, [filteredData]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="glass p-10 rounded-3xl max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <IconComp name="lock" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 font-serif mb-2">{CONFIG.TITLE}</h1>
          <p className="text-slate-500 mb-8 text-sm">Googleアカウントでログインしてダッシュボードにアクセスしてください。</p>
          <div id="google-signin-button" className="flex justify-center"></div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">データを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="glass p-8 rounded-2xl max-w-lg w-full text-center border-red-100">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <IconComp name="alert-triangle" size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">エラーが発生しました</h2>
          <p className="text-red-600 mb-6">{errorMsg}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors">
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/50 p-4 rounded-2xl border border-slate-200/50 backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 font-serif tracking-tight">{CONFIG.TITLE}</h1>
          <p className="text-slate-500 text-sm mt-1">Lステップ データ分析ダッシュボード</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            <IconComp name="calendar" size={16} className="text-slate-400" />
            <select 
              className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="all">全期間</option>
              {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {!isTestMode && (
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors" title="ログアウト">
              <IconComp name="log-out" size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Overview KPIs */}
      <section>
        <div className="section-label mb-3">全体概要</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPICard title="総登録数" value={stats.total} unit="人" icon="users" colorName="blue" info="ブロックを除外した有効な友だち数" />
          <KPICard title="アンケート回答" value={stats.enqueteAnswered} unit="人" icon="clipboard-list" colorName="purple" subText={`回答率: ${stats.enqueteRate}%`} info="アンケートに回答した人数と、総登録数に対する割合" />
          <KPICard title="面談予約" value={stats.interviewReserved} unit="件" icon="calendar-check" colorName="orange" subText={`予約率: ${stats.reserveRate}%`} info="カジュアル面談を予約した人数と、総登録数に対する割合" />
          <KPICard title="面談完了" value={stats.interviewCompleted} unit="件" icon="check-circle" colorName="green" subText={`完了率: ${stats.completeRate}%`} info="面談が完了した人数と、予約数に対する割合" />
          <KPICard title="キャンセル" value={stats.interviewCanceled} unit="件" icon="x-circle" colorName="rose" subText={`キャンセル率: ${stats.cancelRate}%`} info="面談をキャンセルした人数と、予約数に対する割合" />
        </div>
      </section>

      {/* Scenario Analysis */}
      <section>
        <div className="section-label mb-3">シナリオ分析</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass p-6 rounded-2xl min-h-[350px] flex flex-col">
            <h3 className="text-slate-800 font-serif font-bold mb-4 flex items-center">
              アンケート誘導シナリオ (OG1)
              <InfoTooltip text="OG1経路のアンケート誘導シナリオの通目別対象者数とタップ率" />
            </h3>
            <div className="flex-1 min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stats.og1Enquete} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }} />
                  <Bar yAxisId="left" dataKey="target" name="対象者数" fill={COLORS.primary} radius={[4, 4, 0, 0]} barSize={30} />
                  <Bar yAxisId="left" dataKey="tap" name="タップ数" fill={COLORS.info} radius={[4, 4, 0, 0]} barSize={30} />
                  <Line yAxisId="right" type="monotone" dataKey="rate" name="タップ率(%)" stroke={COLORS.warning} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="glass p-6 rounded-2xl min-h-[350px] flex flex-col">
            <h3 className="text-slate-800 font-serif font-bold mb-4 flex items-center">
              アンケート回答後：ホスト
              <InfoTooltip text="アンケートで「ホスト」と回答したユーザーへのシナリオ配信状況" />
            </h3>
            <div className="flex-1 min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stats.postEnqueteHost} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }} />
                  <Bar yAxisId="left" dataKey="target" name="対象者数" fill={COLORS.secondary} radius={[4, 4, 0, 0]} barSize={30} />
                  <Bar yAxisId="left" dataKey="tap" name="タップ数" fill={COLORS.info} radius={[4, 4, 0, 0]} barSize={30} />
                  <Line yAxisId="right" type="monotone" dataKey="rate" name="タップ率(%)" stroke={COLORS.warning} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* User Attributes */}
      <section>
        <div className="section-label mb-3">ユーザー属性分析</div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass p-6 rounded-2xl min-h-[350px] flex flex-col">
            <h3 className="text-slate-800 font-serif font-bold mb-4 flex items-center">
              職種別 登録数と面談予約率
              <InfoTooltip text="アンケートで回答された職種別の割合と、その職種の面談予約率" />
            </h3>
            <div className="flex-1 min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stats.jobData} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" xAxisId="bottom" stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <XAxis type="number" xAxisId="top" orientation="top" stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }} />
                  <Bar xAxisId="bottom" dataKey="count" name="登録数" fill={COLORS.primary} radius={[0, 4, 4, 0]} barSize={20} />
                  <Line xAxisId="top" type="monotone" dataKey="cvRate" name="予約率(%)" stroke={COLORS.warning} strokeWidth={3} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass p-6 rounded-2xl min-h-[350px] flex flex-col">
            <h3 className="text-slate-800 font-serif font-bold mb-4 flex items-center">
              年代別 登録数と面談予約率
              <InfoTooltip text="年代別の登録割合と面談予約率" />
            </h3>
            <div className="flex-1 min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stats.ageData} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" xAxisId="bottom" stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <XAxis type="number" xAxisId="top" orientation="top" stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }} />
                  <Bar xAxisId="bottom" dataKey="count" name="登録数" fill={COLORS.success} radius={[0, 4, 4, 0]} barSize={20} />
                  <Line xAxisId="top" type="monotone" dataKey="cvRate" name="予約率(%)" stroke={COLORS.warning} strokeWidth={3} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass p-6 rounded-2xl min-h-[350px] flex flex-col">
            <h3 className="text-slate-800 font-serif font-bold mb-4 flex items-center">
              勤務地別 登録割合
              <InfoTooltip text="希望勤務地別の登録数割合" />
            </h3>
            <div className="flex-1 min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.locData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="count" stroke="none">
                    {stats.locData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Traffic & Rich Menu */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="section-label mb-3">流入経路分析</div>
            <div className="glass p-6 rounded-2xl min-h-[350px] flex flex-col">
              <h3 className="text-slate-800 font-serif font-bold mb-4 flex items-center">
                流入経路別 登録数と面談予約率
                <InfoTooltip text="どこからLINE登録したか（最新の経路）ごとの登録数と面談予約率" />
              </h3>
              <div className="flex-1 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={stats.sourceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }} />
                    <Bar yAxisId="left" dataKey="count" name="登録数" fill={COLORS.info} radius={[4, 4, 0, 0]} barSize={30} />
                    <Line yAxisId="right" type="monotone" dataKey="cvRate" name="予約率(%)" stroke={COLORS.warning} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div>
            <div className="section-label mb-3">リッチメニュー分析</div>
            <div className="glass p-6 rounded-2xl min-h-[350px] flex flex-col">
              <h3 className="text-slate-800 font-serif font-bold mb-4 flex items-center">
                リッチメニュー タップ状況
                <InfoTooltip text="リッチメニューの各項目の対象者数とタップ率" />
              </h3>
              <div className="flex-1 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={stats.rmData} layout="vertical" margin={{ top: 10, right: 10, left: 40, bottom: 0 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" xAxisId="bottom" stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <XAxis type="number" xAxisId="top" orientation="top" stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }} />
                    <Bar xAxisId="bottom" dataKey="target" name="対象者数" fill={COLORS.slate} radius={[0, 4, 4, 0]} barSize={15} />
                    <Bar xAxisId="bottom" dataKey="tap" name="タップ数" fill={COLORS.secondary} radius={[0, 4, 4, 0]} barSize={15} />
                    <Line xAxisId="top" type="monotone" dataKey="rate" name="タップ率(%)" stroke={COLORS.warning} strokeWidth={3} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Raw Data Table */}
      <section>
        <div className="section-label mb-3">生データ</div>
        <div className="glass rounded-2xl overflow-hidden flex flex-col border border-slate-200">
          <div className="p-4 border-b border-slate-200 bg-white/50 flex justify-between items-center">
            <h3 className="text-slate-800 font-serif font-bold">ユーザーデータ一覧</h3>
            <div className="text-xs font-bold text-slate-500">
              全 {filteredData.length.toLocaleString()} 件中 {(currentPage - 1) * itemsPerPage + 1} 〜 {Math.min(currentPage * itemsPerPage, filteredData.length)} 件を表示中
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  {keysMap.map(key => (
                    <th key={key} className="px-4 py-3">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedData.map((row, i) => (
                  <tr key={i} className="text-slate-700 hover:bg-blue-50/50 transition-colors">
                    {keysMap.map(key => (
                      <td key={key} className="px-4 py-3">
                        {isTrue(row[key]) ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600">
                            <IconComp name="check" size={12} />
                          </span>
                        ) : row[key]}
                      </td>
                    ))}
                  </tr>
                ))}
                {paginatedData.length === 0 && (
                  <tr>
                    <td colSpan={keysMap.length} className="px-4 py-8 text-center text-slate-500">データがありません</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-200 bg-white/50 flex items-center justify-between">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} /> 前へ
              </button>
              <span className="text-sm font-bold text-slate-600">
                {currentPage} <span className="text-slate-400 font-normal mx-1">/</span> {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                次へ <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
