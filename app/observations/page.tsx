"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { activeBrightStars } from "@/lib/astronomy/bright-stars";

interface ObservationRecord {
  id: number;
  targetSlug: string | null;
  targetName: string;
  objectType: string;
  observedAt: string;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  equipment: string | null;
  notes: string | null;
  createdAt: string;
  photos: ObservationPhoto[];
}

interface ObservationPhoto {
  id: number;
  url: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

interface AccountSummary {
  email: string;
}

type FormState = {
  targetName: string;
  targetSlug: string;
  objectType: string;
  observedAt: string;
  latitude: string;
  longitude: string;
  locationName: string;
  equipment: string;
  notes: string;
};

type PageState = "loading" | "ready" | "error";

const planets = [
  { slug: "moon", name: "月球", type: "planet" },
  { slug: "jupiter", name: "木星", type: "planet" },
  { slug: "venus", name: "金星", type: "planet" },
  { slug: "mars", name: "火星", type: "planet" },
  { slug: "saturn", name: "土星", type: "planet" },
];

const equipmentOptions = ["肉眼", "10x50 双筒望远镜", "80mm 折射望远镜", "150mm 牛顿反射镜", "203mm 施卡望远镜", "天文摄影套装"];

function localDateTimeValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function createInitialForm(): FormState {
  return {
    targetName: "",
    targetSlug: "",
    objectType: "unknown",
    observedAt: localDateTimeValue(),
    latitude: "",
    longitude: "",
    locationName: "",
    equipment: "肉眼",
    notes: "",
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatLocation(record: ObservationRecord) {
  if (record.locationName) return record.locationName;
  if (record.latitude == null || record.longitude == null) return "未记录位置";
  return `${record.latitude.toFixed(2)}°, ${record.longitude.toFixed(2)}°`;
}

function formFromRecord(record: ObservationRecord): FormState {
  return {
    targetName: record.targetName,
    targetSlug: record.targetSlug ?? "",
    objectType: record.objectType,
    observedAt: localDateTimeValue(new Date(record.observedAt)),
    latitude: record.latitude == null ? "" : String(record.latitude),
    longitude: record.longitude == null ? "" : String(record.longitude),
    locationName: record.locationName ?? "",
    equipment: record.equipment ?? "肉眼",
    notes: record.notes ?? "",
  };
}

export default function ObservationsPage() {
  const [records, setRecords] = useState<ObservationRecord[]>([]);
  const [form, setForm] = useState<FormState>(createInitialForm);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [deletingPhotoId, setDeletingPhotoId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [account, setAccount] = useState<AccountSummary | null>(null);

  const objectOptions = useMemo(
    () => [
      ...planets,
      ...activeBrightStars().map((star) => ({
        slug: star.slug,
        name: star.nameZh,
        type: "bright_star",
      })),
    ],
    [],
  );

  const updateForm = useCallback((patch: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  }, []);

  function beginEdit(record: ObservationRecord) {
    setEditingId(record.id);
    setForm(formFromRecord(record));
    setPendingPhotos([]);
    setPhotoInputKey((key) => key + 1);
    setMessage("");
    window.setTimeout(() => {
      document.getElementById("observation-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(createInitialForm());
    setPendingPhotos([]);
    setPhotoInputKey((key) => key + 1);
    setMessage("");
  }

  const fetchRecords = useCallback(async () => {
    setPageState("loading");
    try {
      const response = await fetch("/api/observations", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || json.code !== 0) throw new Error("records unavailable");
      setRecords(json.data.records as ObservationRecord[]);
      setAccount((json.data.account as AccountSummary | null) ?? null);
      setPageState("ready");
    } catch {
      setPageState("error");
      setMessage("记录暂时无法加载，请确认数据库已执行最新 schema");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const authMessage = window.sessionStorage.getItem("auth_message");
      if (authMessage) {
        setMessage(authMessage);
        window.sessionStorage.removeItem("auth_message");
      }
      void fetchRecords();
    }, 0);
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => updateForm({
        latitude: position.coords.latitude.toFixed(6),
        longitude: position.coords.longitude.toFixed(6),
      }),
      () => {},
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 },
    );
    return () => window.clearTimeout(timer);
  }, [fetchRecords, updateForm]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const searchParams = new URLSearchParams(window.location.search);
      const targetName = searchParams.get("targetName");
      if (!targetName) return;
      updateForm({
        targetName,
        targetSlug: searchParams.get("targetSlug") ?? "",
        objectType: searchParams.get("objectType") ?? "unknown",
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [updateForm]);

  function handleTargetChange(value: string) {
    const selected = objectOptions.find((item) => item.name === value);
    updateForm({
      targetName: value,
      targetSlug: selected?.slug ?? "",
      objectType: selected?.type ?? "unknown",
    });
  }

  function handlePhotoSelection(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files).slice(0, 9);
    const invalid = selected.find((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024);
    if (invalid) {
      setPendingPhotos([]);
      setMessage("仅支持 JPG、PNG、WebP，且单张照片不能超过 5MB");
      return;
    }
    setPendingPhotos(selected);
    setMessage(selected.length === 9 && files.length > 9 ? "最多选择 9 张照片" : "");
  }

  async function uploadPhotos(recordId: number, files: File[]): Promise<ObservationPhoto[]> {
    const uploaded: ObservationPhoto[] = [];
    for (const file of files) {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/observations/${recordId}/photos`, { method: "POST", body });
      const json = await response.json();
      if (!response.ok || json.code !== 0 || !json.data?.photo) {
        throw new Error(json.message || "photo upload failed");
      }
      uploaded.push(json.data.photo as ObservationPhoto);
    }
    return uploaded;
  }

  async function handleDeletePhoto(recordId: number, photoId: number) {
    setDeletingPhotoId(photoId);
    try {
      const response = await fetch(`/api/observations/${recordId}/photos/${photoId}`, { method: "DELETE" });
      const json = await response.json();
      if (!response.ok || json.code !== 0) throw new Error("photo delete failed");
      setRecords((current) => current.map((record) => record.id === recordId
        ? { ...record, photos: record.photos.filter((photo) => photo.id !== photoId) }
        : record));
    } catch {
      setMessage("照片删除失败，请稍后重试");
    } finally {
      setDeletingPhotoId(null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!form.targetName.trim()) {
      setMessage("请填写观测目标");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(editingId ? `/api/observations/${editingId}` : "/api/observations", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetName: form.targetName,
          targetSlug: form.targetSlug || null,
          objectType: form.objectType,
          observedAt: form.observedAt,
          latitude: form.latitude || null,
          longitude: form.longitude || null,
          locationName: form.locationName,
          equipment: form.equipment,
          notes: form.notes,
        }),
      });
      const json = await response.json();
      if (!response.ok || json.code !== 0) throw new Error(json.message || "save failed");
      let savedRecord = json.data.record as ObservationRecord;
      let photoUploadFailed = false;
      if (pendingPhotos.length > 0) {
        try {
          const uploadedPhotos = await uploadPhotos(savedRecord.id, pendingPhotos);
          savedRecord = { ...savedRecord, photos: [...savedRecord.photos, ...uploadedPhotos] };
        } catch {
          photoUploadFailed = true;
        }
      }
      if (editingId) {
        setRecords((current) => current.map((record) => record.id === editingId ? savedRecord : record));
      } else {
        setRecords((current) => [savedRecord, ...current]);
      }
      const wasEditing = editingId != null;
      setEditingId(null);
      setPendingPhotos([]);
      setPhotoInputKey((key) => key + 1);
      setForm({ ...createInitialForm(), latitude: form.latitude, longitude: form.longitude, locationName: form.locationName, equipment: form.equipment });
      setMessage(photoUploadFailed
        ? "记录已保存，但照片上传失败，请编辑记录后重试"
        : wasEditing ? "观测记录已更新" : "已保存这次观测");
    } catch {
      setMessage("保存失败，请确认数据库已执行 observation_records 表结构");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/observations/${id}`, { method: "DELETE" });
      const json = await response.json();
      if (!response.ok || json.code !== 0) throw new Error("delete failed");
      setRecords((current) => current.filter((record) => record.id !== id));
    } catch {
      setMessage("删除失败，请稍后重试");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto min-h-[calc(100vh-3rem)] max-w-5xl px-4 py-8 sm:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-accent/55">观测档案</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white/90">记录你真正看过的天空</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/42">
            把目标、时间、地点和设备留下来，慢慢形成自己的观测历史。
          </p>
        </div>
        <Link href="/sky-map" className="inline-flex items-center justify-center rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-xs text-accent/80 transition-colors hover:bg-accent/18">
          打开星图
        </Link>
      </div>

      {message && (
        <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/55" role="status">
          {message}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(19rem,0.72fr)_minmax(0,1.28fr)]">
        <section id="observation-form" className="rounded-xl border border-white/8 bg-surface/55 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-white/80">{editingId ? "编辑观测" : "新增观测"}</h2>
            {account ? (
              <span className="max-w-40 truncate text-[10px] text-accent/55" title={account.email}>
                已同步至 {account.email}
              </span>
            ) : (
              <Link href="/login?mode=register" className="text-[10px] text-white/30 hover:text-accent/70">
                登录后跨设备同步
              </Link>
            )}
          </div>

          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <Field label="观测目标" htmlFor="observation-target">
              <input
                id="observation-target"
                list="observation-targets"
                value={form.targetName}
                onChange={(event) => handleTargetChange(event.target.value)}
                placeholder="例如：北河二、木星、猎户座"
                className="input-field"
                required
              />
              <datalist id="observation-targets">
                {objectOptions.map((item) => <option key={item.slug} value={item.name} />)}
              </datalist>
            </Field>

            <Field label="观测时间" htmlFor="observation-time">
              <input id="observation-time" type="datetime-local" value={form.observedAt} onChange={(event) => updateForm({ observedAt: event.target.value })} className="input-field" required />
            </Field>

            <Field label="设备" htmlFor="observation-equipment">
              <input id="observation-equipment" list="equipment-options" value={form.equipment} onChange={(event) => updateForm({ equipment: event.target.value })} className="input-field" />
              <datalist id="equipment-options">
                {equipmentOptions.map((item) => <option key={item} value={item} />)}
              </datalist>
            </Field>

            <Field label="地点名称" htmlFor="observation-location-name">
              <input id="observation-location-name" value={form.locationName} onChange={(event) => updateForm({ locationName: event.target.value })} placeholder="例如：温州 · 江心屿" className="input-field" />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="纬度" htmlFor="observation-latitude">
                <input id="observation-latitude" type="number" step="0.000001" min="-90" max="90" value={form.latitude} onChange={(event) => updateForm({ latitude: event.target.value })} placeholder="纬度" className="input-field" />
              </Field>
              <Field label="经度" htmlFor="observation-longitude">
                <input id="observation-longitude" type="number" step="0.000001" min="-180" max="180" value={form.longitude} onChange={(event) => updateForm({ longitude: event.target.value })} placeholder="经度" className="input-field" />
              </Field>
            </div>

            <Field label="观测笔记" htmlFor="observation-notes">
              <textarea id="observation-notes" value={form.notes} onChange={(event) => updateForm({ notes: event.target.value })} placeholder="亮度、颜色、云量、看到的细节……" rows={4} className="input-field resize-y" />
            </Field>

            <Field label="观测照片" htmlFor="observation-photos">
              <input
                key={photoInputKey}
                id="observation-photos"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(event) => handlePhotoSelection(event.target.files)}
                className="block w-full cursor-pointer rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/45 file:mr-3 file:rounded-md file:border-0 file:bg-accent/15 file:px-2.5 file:py-1.5 file:text-xs file:text-accent/80"
              />
              <span className="mt-1 block text-[10px] text-white/25">
                最多 9 张，每张不超过 5MB；保存记录后上传。
                {pendingPhotos.length > 0 && ` 已选择 ${pendingPhotos.length} 张`}
              </span>
            </Field>

            <button type="submit" disabled={saving} className="w-full rounded-lg bg-accent/15 px-3 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/25 disabled:cursor-wait disabled:opacity-50">
              {saving ? "保存中…" : editingId ? "更新观测记录" : "保存观测记录"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="w-full rounded-lg border border-white/10 px-3 py-2 text-xs text-white/45 transition-colors hover:bg-white/[0.05] hover:text-white/70"
              >
                取消编辑
              </button>
            )}
          </form>
        </section>

        <section>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-white/80">历史记录</h2>
              <p className="mt-1 text-xs text-white/28">最近 100 条观测</p>
            </div>
            <span className="text-xs tabular-nums text-white/30">{records.length} 条</span>
          </div>

          {pageState === "loading" && (
            <div className="mt-4 space-y-3">
              {[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-white/[0.045]" />)}
            </div>
          )}

          {pageState === "error" && (
            <div className="mt-4 rounded-xl border border-white/8 bg-surface/45 p-6 text-center">
              <p className="text-sm text-white/45">记录服务暂时不可用</p>
              <button type="button" onClick={() => void fetchRecords()} className="mt-3 rounded-lg bg-white/[0.06] px-3 py-2 text-xs text-white/45 hover:bg-white/[0.1]">重新加载</button>
            </div>
          )}

          {pageState === "ready" && records.length === 0 && (
            <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
              <p className="text-sm text-white/45">还没有观测记录</p>
              <p className="mt-2 text-xs leading-relaxed text-white/25">今晚在星图里找到第一个目标后，把它记下来。</p>
            </div>
          )}

          {pageState === "ready" && records.length > 0 && (
            <div className="mt-4 space-y-3">
              {records.map((record) => (
                <article key={record.id} className="rounded-xl border border-white/8 bg-surface/45 p-4 transition-colors hover:border-white/12">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-medium text-white/85">{record.targetName}</h3>
                      <p className="mt-1 text-xs text-accent/60">{formatDate(record.observedAt)}</p>
                  </div>
                  <button
                    type="button"
                    title="编辑记录"
                    aria-label={`编辑 ${record.targetName} 的观测记录`}
                    onClick={() => beginEdit(record)}
                    className="shrink-0 rounded-md px-2 py-2 text-xs text-white/35 transition-colors hover:bg-white/[0.06] hover:text-accent/80"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    title="删除记录"
                      aria-label={`删除 ${record.targetName} 的观测记录`}
                      disabled={deletingId === record.id}
                      onClick={() => void handleDelete(record.id)}
                      className="shrink-0 rounded-md p-2 text-white/25 transition-colors hover:bg-red-400/10 hover:text-red-200/70 disabled:opacity-40"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7l1-3h4l1 3" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/38">
                    <span>{formatLocation(record)}</span>
                    {record.equipment && <span>{record.equipment}</span>}
                  </div>
                  {record.notes && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/52">{record.notes}</p>}
                  {record.photos.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {record.photos.map((photo) => (
                        <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-black/20">
                          <img src={photo.url} alt={photo.originalName} loading="lazy" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            title="删除照片"
                            aria-label={`删除 ${photo.originalName}`}
                            disabled={deletingPhotoId === photo.id}
                            onClick={() => void handleDeletePhoto(record.id, photo.id)}
                            className="absolute right-1 top-1 rounded-md bg-black/65 px-1.5 py-1 text-xs text-white/70 opacity-70 transition-opacity hover:bg-red-400/70 sm:opacity-0 sm:group-hover:opacity-100 disabled:opacity-60"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="text-xs text-white/42">{label}</span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}
