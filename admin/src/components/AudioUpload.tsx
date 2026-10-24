"use client";

// Upload a recorded reading (MP3 or M4A) for one lesson or day, in one language.
// The file goes straight from this browser to the private 'audio' storage bucket,
// so big files are fine (up to the Supabase limit, 50 MB on the free plan).

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveAudio, removeAudio } from "@/app/actions";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function AudioUpload({ book, itemKey, lang, current, reader }: {
  book: string; itemKey: string; lang: "en" | "yo"; current?: string | null; reader?: string;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [who, setWho] = useState(reader ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const upload = async () => {
    if (!file) return;
    if (!/audio\//.test(file.type)) return setMsg("Choose an audio file (MP3 or M4A).");
    setBusy(true);
    setMsg("Uploading... keep this page open.");
    const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
    const path = `${book}/${itemKey}-${lang}-${Date.now()}.${ext}`;
    const { error } = await supabaseBrowser().storage.from("audio").upload(path, file, { contentType: file.type, upsert: true });
    if (error) {
      setBusy(false);
      return setMsg(`Upload failed: ${error.message}`);
    }
    const fd = new FormData();
    fd.set("book", book); fd.set("key", itemKey); fd.set("lang", lang); fd.set("path", path); fd.set("reader", who);
    const res = await saveAudio(null, fd);
    setBusy(false);
    setMsg(res?.error ?? res?.ok ?? "");
    setFile(null);
    router.refresh();
  };

  const remove = async () => {
    if (!window.confirm("Remove this recording?")) return;
    const fd = new FormData();
    fd.set("book", book); fd.set("key", itemKey); fd.set("lang", lang);
    const res = await removeAudio(null, fd);
    setMsg(res?.error ?? res?.ok ?? "");
    router.refresh();
  };

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="mb-2 text-sm font-semibold">{lang === "en" ? "English" : "Yorùbá"} recording</div>
      {current ? (
        <div className="mb-2 flex items-center gap-3 text-sm">
          <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-bold text-green-800">Uploaded</span>
          {reader ? <span className="text-muted">Read by {reader}</span> : null}
          <button type="button" onClick={remove} className="text-church-red underline">Remove</button>
        </div>
      ) : <p className="mb-2 text-xs text-muted">None yet. Members hear the phone&apos;s reading voice instead.</p>}
      <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mb-2 block text-sm" />
      <input value={who} onChange={(e) => setWho(e.target.value)} className="input mb-2" placeholder="Read by (name, optional)" />
      <button type="button" onClick={upload} disabled={!file || busy} className="btn disabled:opacity-50">{busy ? "Uploading..." : current ? "Replace recording" : "Upload recording"}</button>
      {msg && <p className="mt-2 text-sm text-muted">{msg}</p>}
    </div>
  );
}
