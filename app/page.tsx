"use client";

import {
  Bell,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Heart,
  Home,
  ImagePlus,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { inspectMediaUpload } from "@/lib/media-upload";

type Post = {
  id: string;
  caption: string;
  imageKey: string | null;
  imageUrl: string | null;
  mediaType: "image" | "video";
  likes: number;
  liked: number | boolean;
  saved: number | boolean;
  createdAt: number;
  comments: Comment[];
};

type Comment = { id: string; postId: string; body: string; createdAt: number };
type Activity = { id: string; type: "like" | "comment"; postId: string | null; message: string; createdAt: number };

type Profile = {
  username: string;
  displayName: string;
  bio: string;
  website: string;
  location: string;
  imageKey: string | null;
  imageUrl: string | null;
  privateAccount: number | boolean;
  storyReplies: number | boolean;
  highQualityUploads: number | boolean;
};

type Story = {
  id: string;
  caption: string;
  imageKey: string | null;
  imageUrl: string | null;
  mediaType: "image" | "video";
  createdAt: number;
  expiresAt: number;
};

const PROFILE_IMAGE = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=88";
const DEFAULT_PROFILE: Profile = {
  username: "emma.wright",
  displayName: "Emma Wright",
  bio: "Little moments, city light, and everything in between. ✨",
  website: "emmawrites.co",
  location: "New York, NY",
  imageKey: null,
  imageUrl: null,
  privateAccount: true,
  storyReplies: true,
  highQualityUploads: true,
};

function profileImage(profile: Profile) {
  return profile.imageKey || profile.imageUrl ? imageSource(profile) : PROFILE_IMAGE;
}

function imageSource(item: { imageKey: string | null; imageUrl: string | null }) {
  return item.imageKey ? `/api/media?key=${encodeURIComponent(item.imageKey)}` : item.imageUrl || "";
}

function isVideoFile(file: File) {
  return file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
}

function timeAgo(timestamp: number) {
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function relativeTime(timestamp: number) {
  const value = timeAgo(timestamp);
  return value === "just now" ? value : `${value} ago`;
}

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState<"post" | "story" | null>(null);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [view, setView] = useState<"home" | "profile">("home");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<Event & { prompt?: () => Promise<void> } | null>(null);
  const [profilePanel, setProfilePanel] = useState<"edit" | "settings" | "activity" | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [accessReady, setAccessReady] = useState(false);

  const activePost = posts.find((post) => post.id === activePostId) || null;

  const loadFeed = useCallback(async () => {
    try {
      const response = await fetch("/api/feed");
      if (!response.ok) throw new Error("Could not load feed");
      const data = await response.json() as { posts: Post[]; stories: Story[]; profile: Profile | null; activities: Activity[] };
      setPosts(data.posts);
      setStories(data.stories);
      if (data.profile) setProfile(data.profile);
      setActivities(data.activities || []);
    } catch {
      setToast("We couldn't refresh the feed. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const confirmedAt = Number(localStorage.getItem("estagram-adult-access") || 0);
    const validForThirtyDays = confirmedAt > 0 && Date.now() - confirmedAt < 30 * 24 * 60 * 60 * 1000;
    if (!validForThirtyDays) {
      location.replace("/login");
      return;
    }
    const readyTimer = window.setTimeout(() => setAccessReady(true), 0);
    return () => window.clearTimeout(readyTimer);
  }, []);

  useEffect(() => {
    if (!accessReady) return;
    const loadTimer = window.setTimeout(() => void loadFeed(), 0);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as Event & { prompt?: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => { window.clearTimeout(loadTimer); window.removeEventListener("beforeinstallprompt", onInstall); };
  }, [accessReady, loadFeed]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const filteredPosts = useMemo(() => {
    if (!query.trim()) return posts;
    return posts.filter((post) => post.caption.toLowerCase().includes(query.toLowerCase()));
  }, [posts, query]);

  async function togglePost(id: string, action: "like" | "save") {
    setPosts((current) => current.map((post) => {
      if (post.id !== id) return post;
      if (action === "like") {
        const liked = Boolean(post.liked);
        return { ...post, liked: !liked, likes: Math.max(0, post.likes + (liked ? -1 : 1)) };
      }
      return { ...post, saved: !Boolean(post.saved) };
    }));
    try {
      await fetch("/api/posts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
      if (action === "like") await loadFeed();
    } catch {
      loadFeed();
    }
  }

  async function addComment(postId: string, body: string) {
    const response = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, body }) });
    const data = await response.json() as Comment & { error?: string };
    if (!response.ok) throw new Error(data.error || "Could not post comment.");
    setPosts((current) => current.map((post) => post.id === postId ? { ...post, comments: [...(post.comments || []), data] } : post));
    await loadFeed();
  }

  async function updateCaption(postId: string, caption: string) {
    const response = await fetch("/api/posts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: postId, action: "caption", caption }) });
    const data = await response.json() as { caption?: string; error?: string };
    if (!response.ok) throw new Error(data.error || "Could not update caption.");
    setPosts((current) => current.map((post) => post.id === postId ? { ...post, caption: data.caption || caption } : post));
  }

  async function deletePost(postId: string) {
    const response = await fetch(`/api/posts?id=${encodeURIComponent(postId)}`, { method: "DELETE" });
    const data = await response.json() as { error?: string };
    if (!response.ok) throw new Error(data.error || "Could not delete post.");
    setPosts((current) => current.filter((post) => post.id !== postId));
    setActivePostId(null);
    setToast("Post deleted.");
  }

  async function deleteStory(storyId: string) {
    const response = await fetch(`/api/stories?id=${encodeURIComponent(storyId)}`, { method: "DELETE" });
    const data = await response.json() as { error?: string };
    if (!response.ok) throw new Error(data.error || "Could not delete story.");
    setStories((current) => current.filter((story) => story.id !== storyId));
    setToast("Story deleted.");
  }

  const profileNav = () => { setView("profile"); setSearchOpen(false); };
  const homeNav = () => { setView("home"); setSearchOpen(false); };

  if (!accessReady) return <div className="auth-check" role="status"><span className="brand-mark">e</span><p>Checking private access…</p></div>;

  return (
    <main className="app-shell">
      <aside className="desktop-nav" aria-label="Primary navigation">
        <button className="brand" onClick={homeNav} aria-label="Estagram home"><span className="brand-mark">e</span><span>estagram</span></button>
        <nav>
          <NavButton icon={<Home />} label="Home" active={view === "home" && !searchOpen} onClick={homeNav} />
          <NavButton icon={<Search />} label="Search" active={searchOpen} onClick={() => setSearchOpen((open) => !open)} />
          <NavButton icon={<Compass />} label="Explore" onClick={() => setToast("Explore is all you — this is your private space.")} />
          <NavButton icon={<UserRound />} label="Profile" active={view === "profile"} onClick={profileNav} />
        </nav>
        <div className="nav-footer">
          {installPrompt && <button className="install-button" onClick={() => installPrompt.prompt?.()}><Sparkles size={17} /> Install app</button>}
          <NavButton icon={<Menu />} label="More" onClick={() => setToast("Your settings are coming soon.")} />
        </div>
      </aside>

      <section className="content-column">
        <header className="mobile-header">
          <button className="brand" onClick={homeNav} aria-label="Estagram home"><span className="brand-mark">e</span><span>estagram</span></button>
          <div className="header-actions"><button className="icon-button" onClick={profileNav} aria-label="Profile"><UserRound /></button><button className="icon-button" onClick={() => setToast("No new messages.")} aria-label="Messages"><Send /></button></div>
        </header>

        {searchOpen && (
          <div className="search-panel">
            <Search size={18} />
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your captions" aria-label="Search posts" />
            {query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={16} /></button>}
          </div>
        )}

        {view === "home" ? (
          <>
            <StoriesTray stories={stories} profile={profile} onAdd={() => setComposer("story")} onOpen={(story) => setActiveStoryId(story.id)} />
            <div className="feed-title"><div><span className="eyebrow">YOUR FEED</span><h1>Good afternoon, {profile.displayName.split(" ")[0]}</h1></div><button onClick={() => setComposer("post")}><Plus size={17} /> New post</button></div>
            <section className="feed" aria-label="Posts">
              {loading ? <FeedSkeleton /> : filteredPosts.length ? filteredPosts.map((post) => <PostCard key={post.id} post={post} profile={profile} onToggle={togglePost} onComment={addComment} onCaptionUpdate={updateCaption} onDelete={deletePost} />) : <EmptyState searched={Boolean(query)} onCreate={() => setComposer("post")} />}
            </section>
          </>
        ) : (
          <ProfileView posts={posts} profile={profile} onCreate={() => setComposer("post")} onEdit={() => setProfilePanel("edit")} onSettings={() => setProfilePanel("settings")} onActivity={() => setProfilePanel("activity")} onOpenPost={(post) => setActivePostId(post.id)} />
        )}
      </section>

      <aside className="desktop-profile">
        <div className="mini-profile"><img src={profileImage(profile)} alt={profile.displayName} /><div><strong>{profile.username}</strong><span>{profile.displayName}</span></div><button onClick={view === "profile" ? homeNav : profileNav}>{view === "profile" ? "Home" : "View"}</button></div>
        <div className="daily-note"><span className="note-icon"><Sparkles /></span><p>Keep the moments that feel like you.</p><small>Your private creative corner</small></div>
        <footer><button>About</button><span>·</span><button>Privacy</button><span>·</span><button>Help</button><p>© 2026 ESTAGRAM</p></footer>
      </aside>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button className={view === "home" ? "active" : ""} onClick={homeNav} aria-label="Home"><Home /></button>
        <button onClick={() => { setSearchOpen(true); setView("home"); }} aria-label="Search"><Search /></button>
        <button className={view === "profile" ? "active" : ""} onClick={profileNav} aria-label="Profile"><img src={profileImage(profile)} alt="" /></button>
      </nav>

      {composer && <Composer type={composer} profile={profile} onClose={() => setComposer(null)} onCreated={(message) => { setComposer(null); setToast(message); loadFeed(); }} />}
      {activeStoryId && <StoryViewer key={activeStoryId} stories={stories} activeId={activeStoryId} profile={profile} onChange={setActiveStoryId} onClose={() => setActiveStoryId(null)} onDelete={deleteStory} />}
      {profilePanel === "edit" && <EditProfileModal profile={profile} onClose={() => setProfilePanel(null)} onSaved={(next) => { setProfile(next); setProfilePanel(null); setToast("Profile updated."); }} />}
      {profilePanel === "settings" && <SettingsModal profile={profile} installPrompt={installPrompt} onClose={() => setProfilePanel(null)} onSaved={(next) => { setProfile(next); setProfilePanel(null); setToast("Settings saved."); }} />}
      {profilePanel === "activity" && <ActivityModal activities={activities} posts={posts} onClose={() => setProfilePanel(null)} />}
      {activePost && <MediaViewer post={activePost} profile={profile} onClose={() => setActivePostId(null)} onCaptionUpdate={updateCaption} onDelete={deletePost} />}
      {toast && <div className="toast" role="status"><Check size={17} /> {toast}</div>}
    </main>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function StoriesTray({ stories, profile, onAdd, onOpen }: { stories: Story[]; profile: Profile; onAdd: () => void; onOpen: (story: Story) => void }) {
  return (
    <section className="stories-section" aria-label="Stories">
      <div className="stories-heading"><span>Stories</span><small>24h moments</small></div>
      <div className="stories-scroll">
        <button className="story-item add-story" onClick={onAdd}>
          <span className="story-ring"><img src={profileImage(profile)} alt="" /><i><Plus size={14} /></i></span><span>Add story</span>
        </button>
        {stories.map((story, index) => (
          <button className="story-item" key={story.id} onClick={() => onOpen(story)}>
            <span className="story-ring active-story">{story.mediaType === "video" ? <><video src={imageSource(story)} muted playsInline preload="metadata" aria-label="Your video story" /><i className="story-video-badge"><Video /></i></> : <img src={imageSource(story)} alt="Your story" />}</span><span>{index === 0 ? "Today" : relativeTime(story.createdAt)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function PostCard({ post, profile, onToggle, onComment, onCaptionUpdate, onDelete }: { post: Post; profile: Profile; onToggle: (id: string, action: "like" | "save") => void; onComment: (postId: string, body: string) => Promise<void>; onCaptionUpdate: (postId: string, caption: string) => Promise<void>; onDelete: (postId: string) => Promise<void> }) {
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(post.caption);
  const [actionError, setActionError] = useState("");
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const inlineVideoRef = useRef<HTMLVideoElement>(null);

  function toggleVideoPlayback() {
    if (post.mediaType !== "video" || !inlineVideoRef.current) return;
    if (inlineVideoRef.current.paused) inlineVideoRef.current.play().catch(() => setActionError("Tap play again to start this video."));
    else inlineVideoRef.current.pause();
  }

  function toggleVideoSound(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const nextMuted = !videoMuted;
    setVideoMuted(nextMuted);
    if (!inlineVideoRef.current) return;
    inlineVideoRef.current.muted = nextMuted;
    if (inlineVideoRef.current.paused) inlineVideoRef.current.play().catch(() => undefined);
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!comment.trim()) return;
    setCommentBusy(true); setActionError("");
    try {
      await onComment(post.id, comment);
      setComment(""); setCommentOpen(false);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not post comment.");
    } finally {
      setCommentBusy(false);
    }
  }

  async function saveCaption(event: FormEvent) {
    event.preventDefault();
    setActionError("");
    try {
      await onCaptionUpdate(post.id, captionDraft);
      setEditingCaption(false); setOptionsOpen(false);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not update caption.");
    }
  }

  return (
    <article className="post-card">
      <header className="post-header"><div className="post-author"><img src={profileImage(profile)} alt="" /><div><strong>{profile.username}</strong><span>{profile.location}</span></div></div><div className="post-menu-wrap"><button className="icon-button" aria-label="Post options" aria-expanded={optionsOpen} onClick={() => setOptionsOpen((open) => !open)}><MoreHorizontal /></button>{optionsOpen && <div className="post-menu"><button onClick={() => { setCaptionDraft(post.caption); setEditingCaption(true); setOptionsOpen(false); }}>Edit caption</button><button onClick={async () => { await navigator.clipboard?.writeText(location.href); setOptionsOpen(false); }}>Copy post link</button><button className="post-menu-danger" onClick={async () => { if (!window.confirm("Delete this post permanently?")) return; setOptionsOpen(false); try { await onDelete(post.id); } catch (reason) { setActionError(reason instanceof Error ? reason.message : "Could not delete post."); } }}>Delete post</button><button onClick={() => setOptionsOpen(false)}>Cancel</button></div>}</div></header>
      <div className={`post-image-wrap ${post.mediaType === "video" ? "has-video" : ""}`} onClick={toggleVideoPlayback} onDoubleClick={() => post.mediaType === "image" && !post.liked && onToggle(post.id, "like")} onKeyDown={(event) => { if (post.mediaType === "video" && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); toggleVideoPlayback(); } }} tabIndex={post.mediaType === "video" ? 0 : undefined} role={post.mediaType === "video" ? "button" : undefined} aria-label={post.mediaType === "video" ? `${videoPlaying ? "Pause" : "Play"} video: ${post.caption}` : undefined}>
        {post.mediaType === "video" ? <><video ref={inlineVideoRef} className="post-image post-video" src={imageSource(post)} muted={videoMuted} playsInline preload="metadata" aria-label={post.caption} onPlay={() => setVideoPlaying(true)} onPause={() => setVideoPlaying(false)} onEnded={() => setVideoPlaying(false)} />{!videoPlaying && <span className="post-play-indicator" aria-hidden="true"><Play fill="currentColor" /></span>}<button type="button" className="post-audio-toggle" onClick={toggleVideoSound} aria-label={videoMuted ? "Unmute video" : "Mute video"}>{videoMuted ? <VolumeX /> : <Volume2 />}</button></> : <img className="post-image" src={imageSource(post)} alt={post.caption} />}
      </div>
      <div className="post-actions"><div><button className={`icon-button ${post.liked ? "liked" : ""}`} onClick={() => onToggle(post.id, "like")} aria-label={post.liked ? "Unlike" : "Like"}><Heart fill={post.liked ? "currentColor" : "none"} /></button><button className="icon-button" onClick={() => setCommentOpen((open) => !open)} aria-label="Comment"><MessageCircle /></button><button className="icon-button" onClick={() => navigator.share?.({ title: "Estagram", text: post.caption, url: location.href })} aria-label="Share"><Send /></button></div><button className={`icon-button ${post.saved ? "saved" : ""}`} onClick={() => onToggle(post.id, "save")} aria-label={post.saved ? "Unsave" : "Save"}><Bookmark fill={post.saved ? "currentColor" : "none"} /></button></div>
      <div className="post-copy"><strong>{post.likes.toLocaleString()} likes</strong>{editingCaption ? <form className="caption-editor" onSubmit={saveCaption}><textarea autoFocus value={captionDraft} onChange={(event) => setCaptionDraft(event.target.value.slice(0, 500))} rows={2} /><div><button type="button" onClick={() => setEditingCaption(false)}>Cancel</button><button>Save</button></div></form> : <p><b>{profile.username}</b> {post.caption}</p>}{post.comments?.length > 0 && <div className="post-comments">{post.comments.slice(-2).map((item) => <div className="comment-item" key={item.id}><img src={profileImage(profile)} alt="" /><p><b>{profile.username}</b> {item.body}</p></div>)}{post.comments.length > 2 && <small>View all {post.comments.length} comments</small>}</div>}<time>{relativeTime(post.createdAt)}</time>{actionError && <span className="inline-error">{actionError}</span>}</div>
      {commentOpen && <form className="comment-row" onSubmit={submitComment}><input autoFocus value={comment} onChange={(event) => setComment(event.target.value.slice(0, 280))} placeholder="Add a comment…" aria-label="Comment" /><button disabled={!comment.trim() || commentBusy}>{commentBusy ? "Posting…" : "Post"}</button></form>}
    </article>
  );
}

function Composer({ type, profile, onClose, onCreated }: { type: "post" | "story"; profile: Profile; onClose: () => void; onCreated: (message: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => file ? URL.createObjectURL(file) : "", [file]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function selectFile(nextFile: File | null) {
    if (!nextFile) return;
    const validVideo = isVideoFile(nextFile);
    const validImage = !validVideo && (nextFile.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(nextFile.name));
    if (!validImage && !validVideo) { setError("Drop a photo or video file."); return; }
    if (validImage && nextFile.size > 10 * 1024 * 1024) { setError("Photos must be under 10 MB."); return; }
    if (validVideo && nextFile.size > 50 * 1024 * 1024) { setError("Videos must be under 50 MB."); return; }
    setFile(nextFile); setError(""); setDragActive(false);
  }

  function handleDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragActive(false);
    selectFile(event.dataTransfer.files?.[0] || null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) { setError("Choose a photo or video first."); return; }
    setBusy(true); setError("");
    let uploadSession: { key: string; uploadId: string } | null = null;
    try {
      const inspected = await inspectMediaUpload(file);
      if (!inspected) throw new Error("This file is not a supported photo or video.");
      const signature = Array.from(new Uint8Array(await file.slice(0, 32).arrayBuffer()));
      const readResponse = async <T,>(response: Response, fallback: string) => {
        const text = await response.text();
        let data: { error?: string } = {};
        try { data = text ? JSON.parse(text) as { error?: string } : {}; } catch { data = {}; }
        if (!response.ok) throw new Error(data.error || (response.status === 413 ? "This upload is too large for one request. Please try again." : text || fallback));
        return data as T;
      };
      const startResponse = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", fileName: file.name, fileType: file.type, fileSize: file.size, signature }) });
      const started = await readResponse<{ key: string; uploadId: string }>(startResponse, "Could not start upload.");
      uploadSession = started;
      const chunkSize = 5 * 1024 * 1024;
      const totalParts = Math.ceil(file.size / chunkSize);
      const parts: { partNumber: number; etag: string }[] = [];
      for (let index = 0; index < totalParts; index += 1) {
        const partNumber = index + 1;
        const partUrl = `/api/uploads?key=${encodeURIComponent(started.key)}&uploadId=${encodeURIComponent(started.uploadId)}&partNumber=${partNumber}`;
        const partResponse = await fetch(partUrl, { method: "PUT", body: file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize)) });
        parts.push(await readResponse<{ partNumber: number; etag: string }>(partResponse, `Could not upload part ${partNumber}.`));
        setUploadProgress(Math.round((partNumber / totalParts) * 90));
      }
      const completeResponse = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete", key: started.key, uploadId: started.uploadId, parts, contentKind: type, caption }) });
      await readResponse(completeResponse, "Could not finish upload.");
      setUploadProgress(100);
      onCreated(type === "post" ? "Your post is live." : "Story shared for 24 hours.");
    } catch (reason) {
      if (uploadSession) fetch(`/api/uploads?key=${encodeURIComponent(uploadSession.key)}&uploadId=${encodeURIComponent(uploadSession.uploadId)}`, { method: "DELETE" }).catch(() => undefined);
      setError(reason instanceof Error ? reason.message : "Something went wrong.");
      setBusy(false);
      setUploadProgress(0);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Create ${type}`} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="composer" onSubmit={submit}>
        <header><button type="button" className="icon-button composer-close" onClick={onClose} aria-label="Close"><X /></button><div><span>CREATE</span><h2>New {type}</h2></div><button className="share-button" disabled={!file || busy}>{busy ? `Uploading ${uploadProgress}%` : "Share"}</button></header>
        <input ref={inputRef} className="file-input" type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.gif" onChange={(event) => selectFile(event.target.files?.[0] || null)} />
        <input ref={videoInputRef} className="file-input" type="file" accept="video/*,.mp4,.webm,.mov,.m4v" onChange={(event) => selectFile(event.target.files?.[0] || null)} />
        {preview ? (
          <button type="button" className={`preview-frame ${type} ${dragActive ? "drag-active" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={handleDrop} onClick={() => file && isVideoFile(file) ? videoInputRef.current?.click() : inputRef.current?.click()}>{file && isVideoFile(file) ? <video src={preview} autoPlay loop muted playsInline aria-label="Selected video preview" /> : <img src={preview} alt="Selected preview" />}<span>Change {file && isVideoFile(file) ? "video" : "photo"}</span></button>
        ) : (
          <div className={`upload-drop ${type} ${dragActive ? "drag-active" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={handleDrop}><span><Video /></span><h3>{dragActive ? "Drop it here" : "Choose or drop a photo or video"}</h3><p>Photos up to 10 MB · MP4, WebM, MOV or M4V up to 50 MB</p><div className="upload-choices"><button type="button" onClick={() => inputRef.current?.click()}>Choose photo</button><button type="button" onClick={() => videoInputRef.current?.click()}>Choose video</button></div></div>
        )}
        <div className={`caption-field ${type === "story" ? "story-caption-field" : ""}`}><img src={profileImage(profile)} alt={profile.displayName} /><textarea value={caption} onChange={(event) => setCaption(event.target.value.slice(0, type === "story" ? 280 : 500))} placeholder={type === "story" ? "Add a story caption…" : "Write a caption…"} rows={type === "story" ? 2 : 3} /><small>{caption.length}/{type === "story" ? 280 : 500}</small></div>
        {type === "story" && <div className="expiry-note"><span>24h</span><p><strong>Made for the moment.</strong>Your story will disappear automatically after 24 hours.</p></div>}
        {error && <p className="form-error">{error}</p>}
      </form>
    </div>
  );
}

function StoryViewer({ stories, activeId, profile, onChange, onClose, onDelete }: { stories: Story[]; activeId: string; profile: Profile; onChange: (id: string) => void; onClose: () => void; onDelete: (id: string) => Promise<void> }) {
  const story = stories.find((item) => item.id === activeId);
  const currentIndex = stories.findIndex((item) => item.id === activeId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  const goNext = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < stories.length - 1) onChange(stories[currentIndex + 1].id);
    else onClose();
  }, [currentIndex, onChange, onClose, stories]);

  useEffect(() => {
    if (!story || story.mediaType === "video" || confirmDelete) return;
    const id = window.setTimeout(goNext, 6000);
    return () => window.clearTimeout(id);
  }, [confirmDelete, goNext, story]);

  useEffect(() => {
    if (story?.mediaType !== "video") return;
    if (confirmDelete) videoRef.current?.pause();
    else videoRef.current?.play().catch(() => undefined);
  }, [confirmDelete, story]);

  if (!story) return null;

  async function removeStory() {
    const fallback = stories[currentIndex + 1] || stories[currentIndex - 1];
    setDeleteBusy(true); setError("");
    try {
      await onDelete(story!.id);
      if (fallback) onChange(fallback.id); else onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete story.");
      setDeleteBusy(false);
    }
  }

  return (
    <div className="story-viewer" role="dialog" aria-modal="true" aria-label="Story">
      <div className="story-frame">
        <div className="story-progress" aria-hidden="true">{stories.map((item, index) => <i key={item.id} className={index < currentIndex ? "done" : index === currentIndex ? "current" : ""}><span style={index === currentIndex && story.mediaType === "video" ? { animationDuration: "30s" } : undefined} /></i>)}</div>
        <header><div><img src={profileImage(profile)} alt="" /><strong>{profile.username}</strong><span>{timeAgo(story.createdAt)}</span></div><div className="story-header-actions"><button onClick={() => setConfirmDelete(true)} aria-label="Delete story"><Trash2 /></button><button onClick={onClose} aria-label="Close story"><X /></button></div></header>
        {story.mediaType === "video" ? <video ref={videoRef} key={story.id} className="story-full-image" src={imageSource(story)} autoPlay muted playsInline onEnded={goNext} aria-label={story.caption || "Your video story"} /> : <img className="story-full-image" src={imageSource(story)} alt={story.caption || "Your story"} />}
        {currentIndex > 0 && <button className="story-nav previous" onClick={() => onChange(stories[currentIndex - 1].id)} aria-label="Previous story"><ChevronLeft /></button>}
        {currentIndex < stories.length - 1 && <button className="story-nav next" onClick={goNext} aria-label="Next story"><ChevronRight /></button>}
        <footer>{story.caption && <p>{story.caption}</p>}<span>Story expires automatically within 24 hours</span></footer>
        {confirmDelete && <div className="story-delete-confirm"><strong>Delete this story?</strong><p>This removes it immediately instead of waiting for it to expire.</p>{error && <span>{error}</span>}<div><button onClick={() => setConfirmDelete(false)}>Cancel</button><button onClick={removeStory} disabled={deleteBusy}>{deleteBusy ? "Deleting…" : "Delete"}</button></div></div>}
      </div>
    </div>
  );
}

function ProfileView({ posts, profile, onCreate, onEdit, onSettings, onActivity, onOpenPost }: { posts: Post[]; profile: Profile; onCreate: () => void; onEdit: () => void; onSettings: () => void; onActivity: () => void; onOpenPost: (post: Post) => void }) {
  const [tab, setTab] = useState<"posts" | "saved">("posts");
  const visiblePosts = tab === "saved" ? posts.filter((post) => Boolean(post.saved)) : posts;
  return (
    <section className="profile-page">
      <header className="profile-hero"><button className="profile-photo-button" onClick={onEdit} aria-label="Update profile photo"><img src={profileImage(profile)} alt={profile.displayName} /><span><ImagePlus /></span></button><div className="profile-info"><div><h1>{profile.username}</h1><button onClick={onEdit}>Edit profile</button><button className="icon-button profile-settings" onClick={onSettings} aria-label="Profile settings"><Settings /></button></div><dl><div><dt>{posts.length}</dt><dd>posts</dd></div><div><dt>{posts.reduce((total, post) => total + post.likes, 0).toLocaleString()}</dt><dd>likes</dd></div><div><dt>1</dt><dd>creative space</dd></div></dl><p><strong>{profile.displayName}</strong><br />{profile.bio}<br /><a href={`https://${profile.website.replace(/^https?:\/\//, "")}`}>{profile.website}</a></p></div></header>
      <div className="profile-actions" aria-label="Profile actions"><button onClick={onActivity}><Bell /><span><strong>Activity</strong><small>See your latest updates</small></span></button><button onClick={onCreate}><Plus /><span><strong>Create</strong><small>Share a new post</small></span></button></div>
      <div className="profile-tabs" role="tablist" aria-label="Profile posts"><button className={tab === "posts" ? "active" : ""} role="tab" aria-selected={tab === "posts"} onClick={() => setTab("posts")}><ImagePlus size={15} /> POSTS</button><button className={tab === "saved" ? "active" : ""} role="tab" aria-selected={tab === "saved"} onClick={() => setTab("saved")}><Bookmark size={15} /> SAVED</button></div>
      {visiblePosts.length ? <div className="profile-grid">{visiblePosts.map((post) => <button key={post.id} onClick={() => onOpenPost(post)} aria-label={`Open ${post.mediaType}: ${post.caption}`}>{post.mediaType === "video" ? <><video src={imageSource(post)} muted playsInline preload="metadata" aria-label={post.caption} /><i className="video-badge"><Video /></i></> : <img src={imageSource(post)} alt={post.caption} />}<span><Heart fill="currentColor" size={17} /> {post.likes}</span></button>)}{tab === "posts" && <button className="grid-add" onClick={onCreate}><Plus /><span>Add a post</span></button>}</div> : <div className="saved-empty"><span><Bookmark /></span><h3>No saved posts yet</h3><p>Tap the bookmark on a post and it will appear here.</p></div>}
    </section>
  );
}

function MediaViewer({ post, profile, onClose, onCaptionUpdate, onDelete }: { post: Post; profile: Profile; onClose: () => void; onCaptionUpdate: (postId: string, caption: string) => Promise<void>; onDelete: (postId: string) => Promise<void> }) {
  const [caption, setCaption] = useState(post.caption);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [videoMuted, setVideoMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (post.mediaType === "video") videoRef.current?.play().catch(() => undefined);
  }, [post.id, post.mediaType, post.imageKey, post.imageUrl]);

  async function saveCaption(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try { await onCaptionUpdate(post.id, caption); setEditing(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update caption."); }
    finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true); setError("");
    try { await onDelete(post.id); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete post."); setBusy(false); }
  }

  function toggleViewerSound() {
    const nextMuted = !videoMuted;
    setVideoMuted(nextMuted);
    if (!videoRef.current) return;
    videoRef.current.muted = nextMuted;
    if (videoRef.current.paused) videoRef.current.play().catch(() => undefined);
  }

  return (
    <div className="media-viewer" role="dialog" aria-modal="true" aria-label="Post media viewer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <button className="media-viewer-close" onClick={onClose} aria-label="Close full-screen media"><X /></button>
      <section className="media-viewer-card">
        <div className="media-viewer-stage">{post.mediaType === "video" ? <><video ref={videoRef} key={`${post.id}-${post.imageKey || post.imageUrl}`} src={imageSource(post)} autoPlay muted={videoMuted} controls playsInline preload="auto" onCanPlay={(event) => event.currentTarget.play().catch(() => undefined)} /><button type="button" className="media-audio-toggle" onClick={toggleViewerSound} aria-label={videoMuted ? "Unmute video" : "Mute video"}>{videoMuted ? <VolumeX /> : <Volume2 />}</button></> : <img src={imageSource(post)} alt={post.caption} />}</div>
        <aside className="media-viewer-details">
          <header><img src={profileImage(profile)} alt="" /><div><strong>{profile.username}</strong><span>{profile.location}</span></div></header>
          {editing ? <form className="viewer-caption-form" onSubmit={saveCaption}><label htmlFor="viewer-caption">Edit caption</label><textarea id="viewer-caption" autoFocus value={caption} onChange={(event) => setCaption(event.target.value.slice(0, 500))} rows={6} /><small>{caption.length}/500</small><div><button type="button" onClick={() => { setCaption(post.caption); setEditing(false); }}>Cancel</button><button disabled={busy || !caption.trim()}>{busy ? "Saving…" : "Save caption"}</button></div></form> : <div className="viewer-caption"><p><b>{profile.username}</b> {post.caption}</p><time>{relativeTime(post.createdAt)}</time></div>}
          <div className="viewer-stats"><span><Heart fill={post.liked ? "currentColor" : "none"} /> {post.likes.toLocaleString()} likes</span><span><MessageCircle /> {post.comments.length} comments</span></div>
          <div className="viewer-actions"><button onClick={() => setEditing(true)}>Edit caption</button>{confirmDelete ? <div className="delete-confirm"><p>Delete this post permanently?</p><button onClick={() => setConfirmDelete(false)}>Cancel</button><button onClick={remove} disabled={busy}>{busy ? "Deleting…" : "Yes, delete"}</button></div> : <button className="danger" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete post</button>}</div>
          {error && <p className="viewer-error">{error}</p>}
        </aside>
      </section>
    </div>
  );
}

function EditProfileModal({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: (profile: Profile) => void }) {
  const [draft, setDraft] = useState(profile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoPreview = useMemo(() => photoFile ? URL.createObjectURL(photoFile) : profileImage(profile), [photoFile, profile]);

  useEffect(() => () => { if (photoFile && photoPreview) URL.revokeObjectURL(photoPreview); }, [photoFile, photoPreview]);

  const update = (key: keyof Profile, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      let data = await response.json() as Profile & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not update profile.");
      if (photoFile) {
        const photoBody = new FormData();
        photoBody.set("image", photoFile);
        const photoResponse = await fetch("/api/profile", { method: "POST", body: photoBody });
        data = await photoResponse.json() as Profile & { error?: string };
        if (!photoResponse.ok) throw new Error(data.error || "Could not update profile photo.");
      }
      onSaved(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update profile.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit profile" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="profile-modal" onSubmit={save}>
        <ModalHeader eyebrow="PROFILE" title="Edit profile" onClose={onClose} action={busy ? "Saving…" : "Save"} disabled={busy} />
        <div className="profile-photo-row"><input ref={photoInputRef} className="file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} /><img src={photoPreview} alt={draft.displayName} /><div><strong>{draft.username}</strong><span>JPG, PNG or WebP · up to 10 MB</span></div><button type="button" onClick={() => photoInputRef.current?.click()}>Change photo</button></div>
        <div className="form-fields">
          <label><span>Name</span><input value={draft.displayName} onChange={(event) => update("displayName", event.target.value)} maxLength={50} required /></label>
          <label><span>Username</span><div className="input-prefix"><i>@</i><input value={draft.username} onChange={(event) => update("username", event.target.value.replace(/\s/g, ""))} maxLength={30} required /></div></label>
          <label><span>Bio</span><textarea value={draft.bio} onChange={(event) => update("bio", event.target.value)} maxLength={160} rows={3} /><small>{draft.bio.length}/160</small></label>
          <label><span>Website</span><input value={draft.website} onChange={(event) => update("website", event.target.value)} maxLength={100} /></label>
          <label><span>Location</span><input value={draft.location} onChange={(event) => update("location", event.target.value)} maxLength={80} /></label>
        </div>
        {error && <p className="form-error profile-error">{error}</p>}
      </form>
    </div>
  );
}

function SettingsModal({ profile, installPrompt, onClose, onSaved }: { profile: Profile; installPrompt: (Event & { prompt?: () => Promise<void> }) | null; onClose: () => void; onSaved: (profile: Profile) => void }) {
  const [draft, setDraft] = useState(profile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toggle = (key: "privateAccount" | "storyReplies" | "highQualityUploads") => setDraft((current) => ({ ...current, [key]: !Boolean(current[key]) }));

  async function save() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json() as Profile & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save settings.");
      onSaved(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save settings.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Profile settings" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="profile-modal settings-modal">
        <ModalHeader eyebrow="YOUR SPACE" title="Settings" onClose={onClose} action={busy ? "Saving…" : "Done"} disabled={busy} onAction={save} />
        <div className="settings-intro"><span><SlidersHorizontal /></span><div><strong>Make Estagram yours</strong><p>Choose how your private creative space behaves.</p></div></div>
        <div className="settings-list">
          <SettingRow title="Private account" description="Only you can access this creative space." checked={Boolean(draft.privateAccount)} onChange={() => toggle("privateAccount")} />
          <SettingRow title="Story replies" description="Allow quick replies while viewing stories." checked={Boolean(draft.storyReplies)} onChange={() => toggle("storyReplies")} />
          <SettingRow title="High-quality uploads" description="Keep original detail in photos and videos." checked={Boolean(draft.highQualityUploads)} onChange={() => toggle("highQualityUploads")} />
        </div>
        {installPrompt && <button className="settings-install" onClick={() => installPrompt.prompt?.()}><Sparkles /> Install Estagram on this device</button>}
        {error && <p className="form-error profile-error">{error}</p>}
      </section>
    </div>
  );
}

function ActivityModal({ activities, posts, onClose }: { activities: Activity[]; posts: Post[]; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Activity" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="profile-modal activity-modal">
        <ModalHeader eyebrow="PROFILE" title="Activity" onClose={onClose} />
        {activities.length ? <div className="activity-list">{activities.map((activity) => { const post = posts.find((item) => item.id === activity.postId); return <div className="activity-item" key={activity.id}><span className={`activity-icon ${activity.type}`}>{activity.type === "like" ? <Heart fill="currentColor" /> : <MessageCircle />}</span><div><p>{activity.message}</p><time>{relativeTime(activity.createdAt)}</time></div>{post && (post.mediaType === "video" ? <span className="activity-video"><Video /></span> : <img src={imageSource(post)} alt="" />)}</div>; })}</div> : <div className="activity-empty"><span><Bell /></span><h3>No activity yet</h3><p>Your likes and comments will appear here.</p></div>}
      </section>
    </div>
  );
}

function ModalHeader({ eyebrow, title, onClose, action, disabled, onAction }: { eyebrow: string; title: string; onClose: () => void; action?: string; disabled?: boolean; onAction?: () => void }) {
  return <header className="modal-header"><button type="button" className="icon-button composer-close" onClick={onClose} aria-label="Close"><X /></button><div><span>{eyebrow}</span><h2>{title}</h2></div>{action ? <button type={onAction ? "button" : "submit"} className="share-button" disabled={disabled} onClick={onAction}>{action}</button> : <i />}</header>;
}

function SettingRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: () => void }) {
  return <div className="setting-row"><div><strong>{title}</strong><p>{description}</p></div><button type="button" className={`toggle ${checked ? "on" : ""}`} role="switch" aria-checked={checked} onClick={onChange}><span /></button></div>;
}

function FeedSkeleton() {
  return <div className="post-card skeleton-card"><div className="skeleton-line" /><div className="skeleton-image" /><div className="skeleton-line short" /></div>;
}

function EmptyState({ searched, onCreate }: { searched: boolean; onCreate: () => void }) {
  return <div className="empty-state"><span><ImagePlus /></span><h2>{searched ? "No matching moments" : "Your feed starts here"}</h2><p>{searched ? "Try another word from one of your captions." : "Share your first photo and make this space yours."}</p>{!searched && <button onClick={onCreate}>Create a post</button>}</div>;
}
