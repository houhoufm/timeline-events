"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toJpeg, toPng } from "html-to-image";
import {
  Search,
  Calendar,
  Tag,
  ArrowUpDown,
  Plus,
  Upload,
  Download,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

const STORAGE_KEY = "timeline_events_v1";
const DAY_MS = 24 * 60 * 60 * 1000;

const rawEvents = [
  {
    date: "2026-01-22",
    title: "V1.0 版本需求评审通过",
    meta: "负责人：张三",
    desc: "完成核心功能需求评审，确认范围、优先级及交付计划，进入正式开发阶段。",
    tags: ["里程碑", "需求", "评审"],
  },
  {
    date: "2026-01-18",
    title: "春节前数据准备与备份",
    meta: "工单：OPS-1024",
    tags: ["运维", "数据", "备份"],
  },
  {
    date: "2025-12-22",
    title: "制定 Q1 项目整体规划",
    meta: "负责人：产品经理",
    desc: "明确 Q1 目标、关键交付物及资源分配方案。",
    tags: ["规划", "管理"],
  },
  {
    date: "2025-12-15",
    title: "项目启动会",
    meta: "会议编号：MTG-20251215",
    tags: ["会议", "启动"],
  },
  {
    date: "2025-11-30",
    title: "完成用户调研与需求初稿",
    meta: "调研样本：42 人",
    tags: ["需求", "调研"],
  },
  {
    date: "2025-10-15",
    title: "确认项目预算与人员配置",
    meta: "预算：¥3,685,670",
    desc: "确定研发、测试、设计人员配置及阶段性成本控制方案。",
    tags: ["预算", "团队", "管理"],
  },
  {
    date: "2025-09-28",
    title: "确定产品方向与核心目标",
    meta: "决策会议：PRD-001",
    tags: ["产品", "方向", "战略"],
  },
];


function uid() {
  return "evt_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function normalizeEvent(e) {
  return {
    id: e?.id || uid(),
    date: e?.date || "",
    title: e?.title || "",
    desc: e?.desc || "",
    meta: e?.meta || "",
    tags: Array.isArray(e?.tags)
      ? e.tags.filter(Boolean)
      : typeof e?.tags === "string"
        ? e.tags
            .split(/[,|;，、\s]+/)
            .map((x) => x.trim())
            .filter(Boolean)
        : [],
  };
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function loadEvents() {
  if (!canUseStorage()) return rawEvents.map(normalizeEvent);
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return rawEvents.map(normalizeEvent);
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed)) return rawEvents.map(normalizeEvent);
    return parsed.map(normalizeEvent);
  } catch {
    return rawEvents.map(normalizeEvent);
  }
}

function saveEvents(list) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage errors in restricted or preview environments.
  }
}

function parseDateValue(dateStr) {
  if (!dateStr) return Number.NaN;
  const trimmed = dateStr.trim();
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(trimmed);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return Date.UTC(year, month - 1, day);
  }
  const fallback = Date.parse(trimmed);
  return Number.isNaN(fallback) ? Number.NaN : fallback;
}

function formatDateCN(dateStr) {
  if (!dateStr) return "";
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(dateStr.trim());
  if (!match) return dateStr;
  const y = match[1];
  const m = String(match[2]).padStart(2, "0");
  const day = String(match[3]).padStart(2, "0");
  return `${y}年${m}月${day}日`;
}

function daysDiffValue(aValue, bValue) {
  if (Number.isNaN(aValue) || Number.isNaN(bValue)) return 0;
  return Math.round((aValue - bValue) / DAY_MS);
}

function formatCNOld(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}年${m}月${day}日`;
}

function daysDiffOld(a, b) {
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return 0;
  return Math.round((da - db) / (1000 * 60 * 60 * 24));
}

function formatCN(dateStr) {
  return formatDateCN(dateStr);
}

function daysDiff(a, b) {
  return daysDiffValue(parseDateValue(a), parseDateValue(b));
}

function csvEscape(value) {
  const v = (value ?? "").toString();
  if (/[\n\r,\"]/g.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function toCSV(events) {
  const header = ["id", "date", "title", "desc", "tags", "meta"].join(",");
  const rows = events.map((e) =>
    [e.id, e.date, e.title, e.desc, (e.tags || []).join("|"), e.meta]
      .map(csvEscape)
      .join(",")
  );
  return [header, ...rows].join("\n");
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cur);
    cur = "";
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      pushCell();
      continue;
    }

    if (ch === "\n") {
      pushCell();
      pushRow();
      continue;
    }

    if (ch === "\r") {
      if (next === "\n") continue;
      pushCell();
      pushRow();
      continue;
    }

    cur += ch;
  }

  pushCell();
  if (row.length) pushRow();

  const header = (rows[0] || []).map((h) => (h || "").trim());
  const data = rows.slice(1);
  const idx = (name) => header.indexOf(name);
  const get = (r, name) => {
    const i = idx(name);
    if (i < 0) return "";
    return (r[i] ?? "").toString();
  };

  return data
    .filter((r) => r.some((x) => (x ?? "").toString().trim() !== ""))
    .map((r) => {
      const tagsRaw = get(r, "tags");
      return normalizeEvent({
        id: get(r, "id") || uid(),
        date: get(r, "date"),
        title: get(r, "title"),
        desc: get(r, "desc"),
        meta: get(r, "meta"),
        tags: tagsRaw,
      });
    });
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadDataUrl(filename, dataUrl) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function Timeline() {
  const [query, setQuery] = useState("");
  const [asc, setAsc] = useState(false);
  const [data, setData] = useState(() => loadEvents());
  const [modal, setModal] = useState({ open: false, mode: "add", draft: null });
  const [exporting, setExporting] = useState(false);

  const fileInputRef = useRef(null);
  const exportRef = useRef(null);

  useEffect(() => {
    saveEvents(data);
  }, [data]);

  const newestDate = useMemo(() => {
    const dates = data.map((e) => e.date).filter(Boolean);
    if (!dates.length) return "";
    return dates.sort((a, b) => {
      const av = parseDateValue(a);
      const bv = parseDateValue(b);
      if (Number.isNaN(av) && Number.isNaN(bv)) return 0;
      if (Number.isNaN(av)) return 1;
      if (Number.isNaN(bv)) return -1;
      return bv - av;
    })[0];
  }, [data]);

  const events = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = data.filter((e) => {
      if (!q) return true;
      const hay = `${e.id} ${e.date} ${e.title} ${(e.tags || []).join(" ")} ${e.meta || ""} ${e.desc || ""}`.toLowerCase();
      return hay.includes(q);
    });

    return [...filtered].sort((x, y) => {
      const tx = parseDateValue(x.date || "");
      const ty = parseDateValue(y.date || "");
      if (Number.isNaN(tx) && Number.isNaN(ty)) return 0;
      if (Number.isNaN(tx)) return asc ? 1 : -1;
      if (Number.isNaN(ty)) return asc ? -1 : 1;
      return asc ? tx - ty : ty - tx;
    });
  }, [query, asc, data]);

  const onAdd = () => {
    setModal({
      open: true,
      mode: "add",
      draft: normalizeEvent({ date: "", title: "", desc: "", meta: "", tags: [] }),
    });
  };

  const onEdit = (evt) => {
    setModal({ open: true, mode: "edit", draft: { ...evt } });
  };

  const onDelete = (id) => {
    if (!confirm("确定删除这条事件吗？")) return;
    setData((prev) => prev.filter((e) => e.id !== id));
  };

  const onSaveDraft = () => {
    const d = normalizeEvent(modal.draft || {});
    if (!d.date || !d.title) {
      alert("请至少填写：日期(date) 和 标题(title)");
      return;
    }

    setData((prev) => {
      if (modal.mode === "add") return [d, ...prev];
      return prev.map((e) => (e.id === d.id ? d : e));
    });
    setModal({ open: false, mode: "add", draft: null });
  };

  const onExportCSV = () => {
    downloadText(`timeline_${new Date().toISOString().slice(0, 10)}.csv`, toCSV(data));
  };

  const onExportJSON = () => {
    downloadText(
      `timeline_${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2)
    );
  };

  const onExportImage = async (format) => {
    const node = exportRef.current;
    if (!node) return;
    setExporting(true);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const dateStamp = new Date().toISOString().slice(0, 10);
      const pixelRatio = Math.min(3, window.devicePixelRatio || 2);
      const options = {
        pixelRatio,
        backgroundColor: format === "jpg" ? "#ffffff" : null,
        cacheBust: true,
        width: node.scrollWidth || node.offsetWidth,
        height: node.scrollHeight || node.offsetHeight,
      };
      const dataUrl =
        format === "jpg"
          ? await toJpeg(node, { ...options, quality: 0.95 })
          : await toPng(node, options);
      downloadDataUrl(`timeline_${dateStamp}.${format}`, dataUrl);
    } catch (err) {
      alert("导出图片失败：" + ((err && err.message) || String(err)));
    } finally {
      setExporting(false);
    }
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const decodeFileText = async (file) => {
    const buffer = await file.arrayBuffer();
    const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    if (!utf8.includes("\uFFFD")) return utf8;
    try {
      return new TextDecoder("gbk", { fatal: false }).decode(buffer);
    } catch {
      return utf8;
    }
  };

  const onImportFile = async (file) => {
    if (!file) return;
    const name = (file.name || "").toLowerCase();
    const text = await decodeFileText(file);

    try {
      let imported = [];

      if (name.endsWith(".json")) {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error("JSON 顶层应为数组");
        imported = parsed.map(normalizeEvent);
      } else {
        imported = parseCSV(text);
      }

      if (!imported.length) {
        alert(
          "没有解析到任何事件，请检查文件内容。\nCSV 列要求：id,date,title,desc,tags,meta"
        );
        return;
      }

      const mode = confirm(
        `导入成功，共 ${imported.length} 条。\n\n确定：追加到现有数据\n取消：覆盖现有数据`
      )
        ? "append"
        : "replace";

      setData((prev) => {
        if (mode === "replace") return imported;
        const map = new Map(prev.map((e) => [e.id, e]));
        for (const e of imported) map.set(e.id, e);
        return Array.from(map.values());
      });
    } catch (err) {
      alert(
        "导入失败：" +
          ((err && err.message) || String(err)) +
          "\n\nCSV 列要求：id,date,title,desc,tags,meta（tags 用 | 分隔）"
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onResetToSeed = () => {
    if (!confirm("确定恢复为初始示例数据吗？（会覆盖当前本地数据）")) return;
    setData(rawEvents.map(normalizeEvent));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <header className="mb-8 md:mb-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">动态时间线</h1>
              <p className="mt-1 text-sm md:text-base text-slate-600">
                功能：本地保存（LocalStorage）+ 导入/导出（CSV/JSON）+ 增删改
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
              <div className="relative flex-1 md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索：日期 / 标题 / 标签 / 备注 / 描述"
                  className="w-full rounded-2xl border border-slate-200 bg-white/80 px-10 py-2.5 text-sm outline-none shadow-sm focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setAsc((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5 text-sm shadow-sm hover:bg-white"
                  title="切换排序"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  {asc ? "正序" : "倒序"}
                </button>

                <button
                  onClick={onAdd}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2.5 text-sm text-white shadow-sm hover:bg-slate-800"
                  title="添加事件"
                >
                  <Plus className="h-4 w-4" />
                  添加
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
              <Calendar className="h-3.5 w-3.5" />
              共 {events.length} 条
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
              <Tag className="h-3.5 w-3.5" />
              支持搜索标签
            </span>
            {newestDate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
                最新日期：{formatCN(newestDate)}
              </span>
            )}

            <div className="ml-auto flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,text/csv,application/json"
                className="hidden"
                onChange={(e) => onImportFile(e.target.files?.[0])}
              />

              <button
                onClick={triggerImport}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs shadow-sm hover:bg-white"
                title="导入 CSV/JSON"
              >
                <Upload className="h-4 w-4" />
                导入
              </button>

              <button
                onClick={onExportCSV}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs shadow-sm hover:bg-white"
                title="导出 CSV（列：id,date,title,desc,tags,meta；tags 用 | 分隔）"
              >
                <Download className="h-4 w-4" />
                导出CSV
              </button>

              <button
                onClick={onExportJSON}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs shadow-sm hover:bg-white"
                title="导出 JSON"
              >
                <Download className="h-4 w-4" />
                导出JSON
              </button>

              <button
                onClick={() => onExportImage("png")}
                disabled={exporting}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                title="导出 PNG（透明）"
              >
                <Download className="h-4 w-4" />
                {exporting ? "导出中..." : "导出PNG"}
              </button>

              <button
                onClick={() => onExportImage("jpg")}
                disabled={exporting}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                title="导出 JPG"
              >
                <Download className="h-4 w-4" />
                {exporting ? "导出中..." : "导出JPG"}
              </button>

              <button
                onClick={onResetToSeed}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs shadow-sm hover:bg-white"
                title="恢复示例数据（覆盖本地）"
              >
                重置示例
              </button>
            </div>
          </div>
        </header>

        <section ref={exportRef} className="relative">
          <div className="pointer-events-none absolute left-4 top-0 h-full w-px bg-gradient-to-b from-transparent via-slate-200 to-transparent md:left-1/2" />

          <AnimatePresence initial={false}>
            <div className="space-y-6 md:space-y-10">
              {events.map((e, idx) => {
                const isLeft = idx % 2 === 0;
                const offsetDays = newestDate ? daysDiff(newestDate, e.date) : 0;

                return (
                  <motion.article
                    key={e.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                    className="relative grid grid-cols-1 md:grid-cols-2 md:items-start"
                  >
                    <div
                      className={
                        "md:pr-10 " +
                        (isLeft
                          ? "md:col-start-1"
                          : "md:col-start-1 md:opacity-0")
                      }
                    >
                      {isLeft && (
                        <EventCard
                          event={e}
                          offsetDays={offsetDays}
                          onEdit={() => onEdit(e)}
                          onDelete={() => onDelete(e.id)}
                        />
                      )}
                    </div>

                    <div
                      className={
                        "md:pl-10 " +
                        (!isLeft
                          ? "md:col-start-2"
                          : "md:col-start-2 md:opacity-0")
                      }
                    >
                      {!isLeft && (
                        <EventCard
                          event={e}
                          offsetDays={offsetDays}
                          onEdit={() => onEdit(e)}
                          onDelete={() => onDelete(e.id)}
                        />
                      )}
                    </div>

                    <div className="absolute left-4 top-6 -translate-x-1/2 md:left-1/2">
                      <div className="h-3.5 w-3.5 rounded-full bg-white shadow ring-2 ring-slate-300" />
                    </div>
                  </motion.article>
                );
              })}

              {events.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600"
                >
                  没有匹配的事件。试试换一个关键词。
                </motion.div>
              )}
            </div>
          </AnimatePresence>
        </section>

        <footer className="mt-10 text-xs text-slate-500">
          <div className="space-y-2">
            <p>
              清理浏览器数据会清空。
            </p>
            <p>
              CSV 列要求：<span className="font-mono">id,date,title,desc,tags,meta</span>；
              其中 <span className="font-mono">tags</span> 用 <span className="font-mono">|</span>{" "}
              分隔。
            </p>
          </div>
        </footer>
      </div>

      <EditModal
        open={modal.open}
        mode={modal.mode}
        draft={modal.draft}
        onClose={() => setModal({ open: false, mode: "add", draft: null })}
        onChange={(patch) =>
          setModal((m) => ({
            ...m,
            draft: normalizeEvent({ ...(m.draft || {}), ...patch }),
          }))
        }
        onSave={onSaveDraft}
      />
    </div>
  );
}

function EventCard({ event, offsetDays, onEdit, onDelete }) {
  return (
    <div className="relative pl-10 md:pl-0">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2">
            <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
              {event.date}
            </span>
            <span className="text-xs text-slate-600">{formatCN(event.date)}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              距离最新 {offsetDays === 0 ? "0" : offsetDays} 天
            </span>

            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
              title="编辑"
            >
              <Pencil className="h-3.5 w-3.5" />
              编辑
            </button>

            <button
              onClick={onDelete}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
              title="删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </button>
          </div>
        </div>

        <h3 className="mt-3 text-base md:text-lg font-semibold leading-snug">{event.title}</h3>

        {(event.tags?.length || event.meta) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {event.tags?.map((t) => (
              <span
                key={t}
                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
              >
                {t}
              </span>
            ))}
            {event.meta && (
              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                备注：{event.meta}
              </span>
            )}
          </div>
        )}

        {(event.desc || "").trim() && (
          <>
            <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
            <p className="mt-3 text-sm text-slate-600 whitespace-pre-wrap">{event.desc}</p>
          </>
        )}
      </div>

      <div className="pointer-events-none absolute left-4 top-6 hidden h-px w-6 bg-slate-200 md:hidden" />
    </div>
  );
}

function EditModal({ open, mode, draft, onClose, onChange, onSave }) {
  if (!open) return null;
  const d = draft || { id: "", date: "", title: "", desc: "", tags: [], meta: "" };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 md:items-center">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">
              {mode === "add" ? "添加事件" : "编辑事件"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              保存后将写入 LocalStorage（本地浏览器）。
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white p-2 hover:bg-slate-50"
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="日期 (YYYY-MM-DD)">
              <input
                value={d.date}
                onChange={(e) => onChange({ date: e.target.value })}
                placeholder="2026-01-22"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
              />
            </Field>

            <Field label="备注 / meta（可选）">
              <input
                value={d.meta || ""}
                onChange={(e) => onChange({ meta: e.target.value })}
                placeholder="例如：金额、编号、负责人"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
              />
            </Field>
          </div>

          <Field label="标题 (必填)">
            <input
              value={d.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="事件标题"
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
            />
          </Field>

          <Field label="标签 tags（用 , 或 | 或 空格 分隔）">
            <input
              value={(d.tags || []).join("|")}
              onChange={(e) => onChange({ tags: e.target.value })}
              placeholder="里程碑 前端"
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
            />
          </Field>

          <Field label="详细描述 desc（可选）">
            <textarea
              value={d.desc || ""}
              onChange={(e) => onChange({ desc: e.target.value })}
              placeholder="例如：附件链接、负责人、会议纪要要点"
              rows={5}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
            />
          </Field>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <div className="font-medium text-slate-700">导入/导出说明</div>
            <div className="mt-1">
              CSV 列：<span className="font-mono">id,date,title,desc,tags,meta</span>；
              tags 用 <span className="font-mono">|</span> 分隔。
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={onSave}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
          >
            保存
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-slate-700">{label}</div>
      {children}
    </label>
  );
}
