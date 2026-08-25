"use client";

import {
  Bell,
  Ban,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Heart,
  Home,
  ImagePlus,
  Download,
  Flag,
  Menu,
  MessageCircle,
  Mail,
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
  UserPlus,
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
  userId: string;
  owned: boolean;
  author: PublicUser;
};

type PublicUser = { id: string; username: string; displayName: string; location?: string; bio?: string; imageKey: string | null; imageUrl: string | null };
type Comment = { id: string; postId: string; body: string; createdAt: number; author: PublicUser };
type Activity = { id: string; type: "like" | "comment" | "follow" | "message"; postId: string | null; message: string; createdAt: number; readAt?: number | null };

type Profile = {
  id: string;
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
  role: "admin" | "user";
  following: number;
  followers: number;
};

type Story = {
  id: string;
  caption: string;
  imageKey: string | null;
  imageUrl: string | null;
  mediaType: "image" | "video";
  createdAt: number;
  expiresAt: number;
  userId: string;
  owned: boolean;
  captionX: number;
  captionY: number;
  viewed: number | boolean;
  author: PublicUser;
};

type DiscoveryUser = PublicUser & { following: number | boolean; followsYou: number | boolean; blocked: number | boolean; followers: number; posts: number; role: string; isSelf: number | boolean };
type Conversation = { id: string; status: "pending" | "accepted"; requestedBy: string; updatedAt: number; otherId: string; username: string; displayName: string; imageKey: string | null; imageUrl: string | null; lastMessage: string | null; unread: number };
type DirectMessage = { id: string; senderId: string; body: string; createdAt: number };

function profileImage(profile: { imageKey: string | null; imageUrl: string | null; username?: string; displayName?: string }) {
  if (profile.imageKey || profile.imageUrl) return imageSource(profile);
  const initials = ((profile.displayName || profile.username || "E").match(/[a-z0-9]/gi) || ["E"]).slice(0, 2).join("").toUpperCase();
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#6d2b61"/><stop offset="1" stop-color="#ef5778"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g)"/><text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-size="34" font-weight="700">${initials}</text></svg>`)}`;
}

function imageSource(item: { imageKey: string | null; imageUrl: string | null }) {
  return item.imageKey ? `/api/media?key=${encodeURIComponent(item.imageKey)}` : item.imageUrl || "";
}

function isVideoFile(file: File) {
  return file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
}

type UploadContentKind = "post" | "story" | "profile";

async function readApiResponse<T>(response: Response, fallback: string): Promise<T> {
  const text = await response.text();
  let data: { error?: string } = {};
  try { data = text ? JSON.parse(text) as { error?: string } : {}; } catch { data = {}; }
  if (!response.ok) throw new Error(data.error || (response.status === 413 ? "This upload is too large for one request. Please try again." : text || fallback));
  return data as T;
}

async function uploadMediaInParts(file: File, contentKind: UploadContentKind, caption: string, onProgress: (value: number) => void, captionPosition?: { x: number; y: number }) {
  const inspected = await inspectMediaUpload(file);
  if (!inspected) throw new Error("This file is not a supported photo or video.");
  if (contentKind === "profile" && (inspected.kind !== "image" || inspected.extension === "gif")) throw new Error("Choose a JPG, PNG or WebP profile photo.");
  const signature = Array.from(new Uint8Array(await file.slice(0, 32).arrayBuffer()));
  const startResponse = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", fileName: file.name, fileType: file.type, fileSize: file.size, signature, contentKind }) });
  const started = await readApiResponse<{ key: string; uploadId: string }>(startResponse, "Could not start upload.");
  try {
    const chunkSize = 5 * 1024 * 1024;
    const totalParts = Math.ceil(file.size / chunkSize);
    const parts: { partNumber: number; etag: string }[] = [];
    for (let index = 0; index < totalParts; index += 1) {
      const partNumber = index + 1;
      const partUrl = `/api/uploads?key=${encodeURIComponent(started.key)}&uploadId=${encodeURIComponent(started.uploadId)}&partNumber=${partNumber}`;
      const partResponse = await fetch(partUrl, { method: "PUT", body: file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize)) });
      parts.push(await readApiResponse<{ partNumber: number; etag: string }>(partResponse, `Could not upload part ${partNumber}.`));
      onProgress(Math.round((partNumber / totalParts) * 90));
    }
    const completeResponse = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete", key: started.key, uploadId: started.uploadId, parts, contentKind, caption, captionX: captionPosition?.x, captionY: captionPosition?.y }) });
    const result = await readApiResponse(completeResponse, "Could not finish upload.");
    onProgress(100);
    return result;
  } catch (error) {
    fetch(`/api/uploads?key=${encodeURIComponent(started.key)}&uploadId=${encodeURIComponent(started.uploadId)}`, { method: "DELETE" }).catch(() => undefined);
    throw error;
  }
}

async function cropProfileImage(file: File, zoom: number, horizontal: number, vertical: number) {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = sourceUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 640;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not crop the photo.");
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
    const sourceX = Math.max(0, (image.naturalWidth - sourceSize) * (horizontal / 100));
    const sourceY = Math.max(0, (image.naturalHeight - sourceSize) * (vertical / 100));
    context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 640, 640);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", .9));
    if (!blob) throw new Error("This browser could not crop the photo.");
    return new File([blob], `profile-${Date.now()}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState<"post" | "story" | null>(null);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [view, setView] = useState<"home" | "profile" | "explore" | "messages">("home");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<Event & { prompt?: () => Promise<void> } | null>(null);
  const [profilePanel, setProfilePanel] = useState<"edit" | "settings" | "activity" | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [accessReady, setAccessReady] = useState(false);
  const [discovery, setDiscovery] = useState<DiscoveryUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const discoveryRequestRef = useRef(0);

  const activePost = posts.find((post) => post.id === activePostId) || null;

  const loadFeed = useCallback(async () => {
    try {
      const response = await fetch("/api/feed");
      if (response.status === 401 || response.status === 403) { location.replace("/login"); return; }
      if (!response.ok) throw new Error("Could not load feed");
      const data = await response.json() as { posts: Post[]; stories: Story[]; profile: Profile | null; activities: Activity[] };
      setPosts(data.posts);
      setStories(data.stories);
      if (!data.profile) { location.replace("/login"); return; }
      setProfile(data.profile);
      setActivities(data.activities || []);
    } catch {
      setToast("We couldn't refresh the feed. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDiscovery = useCallback(async (search = "") => {
    const requestId = ++discoveryRequestRef.current;
    const response = await fetch(`/api/social?q=${encodeURIComponent(search)}`);
    if (response.status === 401 || response.status === 403) { location.replace("/login"); return; }
    const data = await readApiResponse<{ users: DiscoveryUser[] }>(response, "Could not load people.");
    if (requestId === discoveryRequestRef.current) setDiscovery(data.users || []);
  }, []);

  const loadConversations = useCallback(async () => {
    const response = await fetch("/api/messages");
    const data = await readApiResponse<{ conversations: Conversation[] }>(response, "Could not load messages.");
    setConversations(data.conversations || []);
  }, []);

  useEffect(() => { const readyTimer = window.setTimeout(() => setAccessReady(true), 0); return () => window.clearTimeout(readyTimer); }, []);

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

  const markStoryViewed = useCallback((storyId: string) => {
    setStories((current) => current.map((story) => story.id === storyId ? { ...story, viewed: true } : story));
    fetch("/api/stories", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: storyId }) }).catch(() => undefined);
  }, []);

  const profileNav = () => { setView("profile"); setSearchOpen(false); setQuery(""); };
  const homeNav = () => { setView("home"); setSearchOpen(false); setQuery(""); };
  const exploreNav = () => { setView("explore"); setSearchOpen(true); void loadDiscovery(query); };
  const messagesNav = () => { setView("messages"); setSearchOpen(false); void loadConversations(); };

  if (!accessReady || !profile) return <div className="auth-check" role="status"><span className="brand-mark">e</span><p>Loading your space…</p></div>;

  return (
    <main className="app-shell">
      <aside className="desktop-nav" aria-label="Primary navigation">
        <button className="brand" onClick={homeNav} aria-label="Estagram home"><span className="brand-mark">e</span><span>estagram</span></button>
        <nav>
          <NavButton icon={<Home />} label="Home" active={view === "home" && !searchOpen} onClick={homeNav} />
          <NavButton icon={<Compass />} label="Explore" active={view === "explore"} onClick={exploreNav} />
          <NavButton icon={<Mail />} label="Messages" active={view === "messages"} onClick={messagesNav} />
          <NavButton icon={<UserRound />} label="Profile" active={view === "profile"} onClick={profileNav} />
        </nav>
        <div className="nav-footer">
          <button className="install-button" onClick={() => installPrompt?.prompt ? installPrompt.prompt() : setInstallGuideOpen(true)}><Download size={17} /> Install app</button>
          <NavButton icon={<Menu />} label="More" onClick={() => setProfilePanel("settings")} />
        </div>
      </aside>

      <section className="content-column">
        <header className="mobile-header">
          <button className="brand" onClick={homeNav} aria-label="Estagram home"><span className="brand-mark">e</span><span>estagram</span></button>
          <div className="header-actions"><button className="icon-button" onClick={profileNav} aria-label="Profile"><UserRound /></button><button className="icon-button" onClick={messagesNav} aria-label="Messages"><Send /></button></div>
        </header>

        {searchOpen && (
          <div className="search-panel">
            <Search size={18} />
            <input autoFocus value={query} onChange={(event) => { setQuery(event.target.value); if (view === "explore") void loadDiscovery(event.target.value); }} placeholder={view === "explore" ? "Search people" : "Search captions"} aria-label="Search" />
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
        ) : view === "profile" ? (
          <ProfileView posts={posts} profile={profile} onCreate={() => setComposer("post")} onEdit={() => setProfilePanel("edit")} onSettings={() => setProfilePanel("settings")} onActivity={() => setProfilePanel("activity")} onOpenPost={(post) => setActivePostId(post.id)} />
        ) : view === "explore" ? <ExploreView users={discovery} onRefresh={() => loadDiscovery(query)} onViewSelf={profileNav} onMessage={(conversationId) => { setActiveConversationId(conversationId); setView("messages"); void loadConversations(); }} />
        : <MessagesView key={activeConversationId || "messages"} profile={profile} conversations={conversations} initialConversationId={activeConversationId} onRefresh={loadConversations} />}
      </section>

      <aside className="desktop-profile">
        <div className="mini-profile"><img src={profileImage(profile)} alt={profile.displayName} /><div><strong>{profile.username}</strong><span>{profile.displayName}</span></div><button onClick={view === "profile" ? homeNav : profileNav}>{view === "profile" ? "Home" : "View"}</button></div>
        <div className="daily-note"><span className="note-icon"><Sparkles /></span><p>Keep the moments that feel like you.</p><small>Your social space, on your terms</small></div>
        <footer><button>About</button><span>·</span><button>Privacy</button><span>·</span><button>Help</button><p>© 2026 ESTAGRAM</p></footer>
      </aside>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button className={view === "home" ? "active" : ""} onClick={homeNav} aria-label="Home"><Home /></button>
        <button className={view === "explore" ? "active" : ""} onClick={exploreNav} aria-label="Explore"><Search /></button>
        <button className={view === "messages" ? "active" : ""} onClick={messagesNav} aria-label="Messages"><Mail /></button>
        <button className={view === "profile" ? "active" : ""} onClick={profileNav} aria-label="Profile"><img src={profileImage(profile)} alt="" /></button>
      </nav>

      {composer && <Composer type={composer} profile={profile} onClose={() => setComposer(null)} onCreated={(message) => { setComposer(null); setToast(message); loadFeed(); }} />}
      {activeStoryId && <StoryViewer key={activeStoryId} stories={stories} activeId={activeStoryId} onChange={setActiveStoryId} onViewed={markStoryViewed} onClose={() => setActiveStoryId(null)} onDelete={deleteStory} />}
      {profilePanel === "edit" && <EditProfileModal profile={profile} onClose={() => setProfilePanel(null)} onSaved={(next) => { setProfile(next); setProfilePanel(null); setToast("Profile updated."); }} />}
      {profilePanel === "settings" && <SettingsModal profile={profile} installPrompt={installPrompt} onInstallGuide={() => { setProfilePanel(null); setInstallGuideOpen(true); }} onClose={() => setProfilePanel(null)} onSaved={(next) => { setProfile(next); setProfilePanel(null); setToast("Settings saved."); }} />}
      {profilePanel === "activity" && <ActivityModal activities={activities} posts={posts} onClose={() => setProfilePanel(null)} />}
      {activePost && <MediaViewer post={activePost} profile={profile} onClose={() => setActivePostId(null)} onCaptionUpdate={updateCaption} onDelete={deletePost} onToggle={togglePost} onComment={addComment} />}
      {installGuideOpen && <InstallGuide onClose={() => setInstallGuideOpen(false)} />}
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
            <span className={`story-ring active-story ${story.viewed ? "viewed" : ""}`}>{story.mediaType === "video" ? <><video src={imageSource(story)} muted playsInline preload="metadata" aria-label={`${story.author.username}'s video story`} /><i className="story-video-badge"><Video /></i></> : <img src={imageSource(story)} alt={`${story.author.username}'s story`} />}</span><span>{story.owned && index === 0 ? "Your story" : story.author.username}</span>
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

  async function reportPost() {
    const reason = window.prompt("Why are you reporting this post?");
    if (!reason) return;
    const response = await fetch("/api/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "report", targetType: "post", targetId: post.id, reason }) });
    await readApiResponse(response, "Could not submit this report.");
    setOptionsOpen(false); setActionError("Report sent to the administrator.");
  }

  return (
    <article className="post-card">
      <header className="post-header"><div className="post-author"><img src={profileImage(post.author)} alt="" /><div><strong>{post.author.username}</strong><span>{post.author.location}</span></div></div><div className="post-menu-wrap"><button className="icon-button" aria-label="Post options" aria-expanded={optionsOpen} onClick={() => setOptionsOpen((open) => !open)}><MoreHorizontal /></button>{optionsOpen && <div className="post-menu">{post.owned && <button onClick={() => { setCaptionDraft(post.caption); setEditingCaption(true); setOptionsOpen(false); }}>Edit caption</button>}<button onClick={async () => { await navigator.clipboard?.writeText(`${location.origin}/?post=${post.id}`); setOptionsOpen(false); }}>Copy post link</button>{post.owned ? <button className="post-menu-danger" onClick={async () => { if (!window.confirm("Delete this post permanently?")) return; setOptionsOpen(false); try { await onDelete(post.id); } catch (reason) { setActionError(reason instanceof Error ? reason.message : "Could not delete post."); } }}>Delete post</button> : <button className="post-menu-danger" onClick={reportPost}><Flag /> Report post</button>}<button onClick={() => setOptionsOpen(false)}>Cancel</button></div>}</div></header>
      <div className={`post-image-wrap ${post.mediaType === "video" ? "has-video" : ""}`} onClick={toggleVideoPlayback} onDoubleClick={() => post.mediaType === "image" && !post.liked && onToggle(post.id, "like")} onKeyDown={(event) => { if (post.mediaType === "video" && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); toggleVideoPlayback(); } }} tabIndex={post.mediaType === "video" ? 0 : undefined} role={post.mediaType === "video" ? "button" : undefined} aria-label={post.mediaType === "video" ? `${videoPlaying ? "Pause" : "Play"} video: ${post.caption}` : undefined}>
        {post.mediaType === "video" ? <><video ref={inlineVideoRef} className="post-image post-video" src={imageSource(post)} muted={videoMuted} playsInline preload="metadata" aria-label={post.caption} onPlay={() => setVideoPlaying(true)} onPause={() => setVideoPlaying(false)} onEnded={() => setVideoPlaying(false)} />{!videoPlaying && <span className="post-play-indicator" aria-hidden="true"><Play fill="currentColor" /></span>}<button type="button" className="post-audio-toggle" onClick={toggleVideoSound} aria-label={videoMuted ? "Unmute video" : "Mute video"}>{videoMuted ? <VolumeX /> : <Volume2 />}</button></> : <img className="post-image" src={imageSource(post)} alt={post.caption} />}
      </div>
      <div className="post-actions"><div><button className={`icon-button ${post.liked ? "liked" : ""}`} onClick={() => onToggle(post.id, "like")} aria-label={post.liked ? "Unlike" : "Like"}><Heart fill={post.liked ? "currentColor" : "none"} /></button><button className="icon-button" onClick={() => setCommentOpen((open) => !open)} aria-label="Comment"><MessageCircle /></button><button className="icon-button" onClick={() => navigator.share?.({ title: "Estagram", text: post.caption, url: location.href })} aria-label="Share"><Send /></button></div><button className={`icon-button ${post.saved ? "saved" : ""}`} onClick={() => onToggle(post.id, "save")} aria-label={post.saved ? "Unsave" : "Save"}><Bookmark fill={post.saved ? "currentColor" : "none"} /></button></div>
      <div className="post-copy"><strong>{post.likes.toLocaleString()} likes</strong>{editingCaption ? <form className="caption-editor" onSubmit={saveCaption}><textarea autoFocus value={captionDraft} onChange={(event) => setCaptionDraft(event.target.value.slice(0, 500))} rows={2} /><div><button type="button" onClick={() => setEditingCaption(false)}>Cancel</button><button>Save</button></div></form> : <p><b>{post.author.username}</b> {post.caption}</p>}{post.comments?.length > 0 && <div className="post-comments">{post.comments.slice(-2).map((item) => <div className="comment-item" key={item.id}><img src={profileImage(item.author)} alt="" /><p><b>{item.author.username}</b> {item.body}</p></div>)}{post.comments.length > 2 && <small>View all {post.comments.length} comments</small>}</div>}<time>{relativeTime(post.createdAt)}</time>{actionError && <span className="inline-error">{actionError}</span>}</div>
      {commentOpen && <form className="comment-row" onSubmit={submitComment}><img src={profileImage(profile)} alt="" /><input autoFocus value={comment} onChange={(event) => setComment(event.target.value.slice(0, 280))} placeholder="Add a comment…" aria-label="Comment" /><button disabled={!comment.trim() || commentBusy}>{commentBusy ? "Posting…" : "Post"}</button></form>}
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
  const [captionPosition, setCaptionPosition] = useState({ x: 50, y: 82 });
  const [captionDragging, setCaptionDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
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

  function updateCaptionPosition(event: React.PointerEvent<HTMLParagraphElement>) {
    if (!captionDragging && event.type !== "pointerdown") return;
    const frame = previewRef.current?.getBoundingClientRect();
    if (!frame) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.type === "pointerdown") {
      event.currentTarget.setPointerCapture(event.pointerId);
      setCaptionDragging(true);
    }
    setCaptionPosition({
      x: Math.max(10, Math.min(90, ((event.clientX - frame.left) / frame.width) * 100)),
      y: Math.max(12, Math.min(88, ((event.clientY - frame.top) / frame.height) * 100)),
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) { setError("Choose a photo or video first."); return; }
    setBusy(true); setError("");
    try {
      await uploadMediaInParts(file, type, caption, setUploadProgress, type === "story" ? captionPosition : undefined);
      onCreated(type === "post" ? "Your post is live." : "Story shared for 24 hours.");
    } catch (reason) {
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
          <div ref={previewRef} className={`preview-frame ${type} ${dragActive ? "drag-active" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={handleDrop}>{file && isVideoFile(file) ? <video src={preview} autoPlay loop muted playsInline aria-label="Selected video preview" /> : <img src={preview} alt="Selected preview" />}{type === "story" && caption.trim() && <p className={`story-caption-preview ${captionDragging ? "dragging" : ""}`} style={{ left: `${captionPosition.x}%`, top: `${captionPosition.y}%` }} onPointerDown={updateCaptionPosition} onPointerMove={updateCaptionPosition} onPointerUp={(event) => { event.currentTarget.releasePointerCapture(event.pointerId); setCaptionDragging(false); }} onPointerCancel={() => setCaptionDragging(false)}>{caption}</p>}<button type="button" className="preview-change" onClick={() => file && isVideoFile(file) ? videoInputRef.current?.click() : inputRef.current?.click()}>Change {file && isVideoFile(file) ? "video" : "photo"}</button></div>
        ) : (
          <div className={`upload-drop ${type} ${dragActive ? "drag-active" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={handleDrop}><span><Video /></span><h3>{dragActive ? "Drop it here" : "Choose or drop a photo or video"}</h3><p>Photos up to 10 MB · MP4, WebM, MOV or M4V up to 50 MB</p><div className="upload-choices"><button type="button" onClick={() => inputRef.current?.click()}>Choose photo</button><button type="button" onClick={() => videoInputRef.current?.click()}>Choose video</button></div></div>
        )}
        <div className={`caption-field ${type === "story" ? "story-caption-field" : ""}`}><img src={profileImage(profile)} alt={profile.displayName} /><textarea value={caption} onChange={(event) => setCaption(event.target.value.slice(0, type === "story" ? 280 : 500))} onKeyDown={(event) => { if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return; event.preventDefault(); if (!file) { setError("Choose a photo or video first."); return; } if (!busy) event.currentTarget.form?.requestSubmit(); }} placeholder={type === "story" ? "Add a story caption…" : "Write a caption…"} rows={type === "story" ? 2 : 3} /><small>{caption.length}/{type === "story" ? 280 : 500}</small></div>
        {type === "story" && caption.trim() && <div className="story-caption-tools"><div><strong>Caption position</strong><span>Drag the caption on the preview, or choose a preset.</span></div><div><button type="button" onClick={() => setCaptionPosition({ x: 50, y: 22 })}>Top</button><button type="button" onClick={() => setCaptionPosition({ x: 50, y: 52 })}>Middle</button><button type="button" onClick={() => setCaptionPosition({ x: 50, y: 82 })}>Bottom</button></div></div>}
        {type === "story" && <div className="expiry-note"><span>24h</span><p><strong>Made for the moment.</strong>Your story will disappear automatically after 24 hours.</p></div>}
        {error && <p className="form-error">{error}</p>}
      </form>
    </div>
  );
}

function StoryViewer({ stories, activeId, onChange, onViewed, onClose, onDelete }: { stories: Story[]; activeId: string; onChange: (id: string) => void; onViewed: (id: string) => void; onClose: () => void; onDelete: (id: string) => Promise<void> }) {
  const story = stories.find((item) => item.id === activeId);
  const currentIndex = stories.findIndex((item) => item.id === activeId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [error, setError] = useState("");
  const [storyMuted, setStoryMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (story && !story.viewed) onViewed(story.id);
  }, [onViewed, story]);

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
    else {
      if (videoRef.current) videoRef.current.muted = storyMuted;
      videoRef.current?.play().catch(() => undefined);
    }
  }, [confirmDelete, story, storyMuted]);

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
        <header><div><img src={profileImage(story.author)} alt="" /><strong>{story.author.username}</strong><span>{timeAgo(story.createdAt)}</span></div><div className="story-header-actions">{story.mediaType === "video" && <button onClick={() => setStoryMuted((muted) => !muted)} aria-label={storyMuted ? "Turn story sound on" : "Mute story"}>{storyMuted ? <VolumeX /> : <Volume2 />}</button>}{story.owned && <button onClick={() => setConfirmDelete(true)} aria-label="Delete story"><Trash2 /></button>}<button onClick={onClose} aria-label="Close story"><X /></button></div></header>
        {story.mediaType === "video" ? <video ref={videoRef} key={story.id} className="story-full-image" src={imageSource(story)} autoPlay muted={storyMuted} playsInline onClick={() => setStoryMuted((muted) => !muted)} onEnded={goNext} aria-label={story.caption || "Your video story"} /> : <img className="story-full-image" src={imageSource(story)} alt={story.caption || "Your story"} />}
        {currentIndex > 0 && <button className="story-nav previous" onClick={() => onChange(stories[currentIndex - 1].id)} aria-label="Previous story"><ChevronLeft /></button>}
        {currentIndex < stories.length - 1 && <button className="story-nav next" onClick={goNext} aria-label="Next story"><ChevronRight /></button>}
        <footer>{story.caption && <p style={{ left: `${story.captionX}%`, top: `${story.captionY}%` }}>{story.caption}</p>}<span>Story expires automatically within 24 hours</span></footer>
        {confirmDelete && <div className="story-delete-confirm"><strong>Delete this story?</strong><p>This removes it immediately instead of waiting for it to expire.</p>{error && <span>{error}</span>}<div><button onClick={() => setConfirmDelete(false)}>Cancel</button><button onClick={removeStory} disabled={deleteBusy}>{deleteBusy ? "Deleting…" : "Delete"}</button></div></div>}
      </div>
    </div>
  );
}

function ExploreView({ users, onRefresh, onMessage, onViewSelf }: { users: DiscoveryUser[]; onRefresh: () => Promise<void>; onMessage: (conversationId: string) => void; onViewSelf: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  async function action(user: DiscoveryUser, name: "follow" | "block" | "message" | "report") {
    setBusyId(user.id); setNotice("");
    try {
      if (name === "message") {
        const response = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", targetId: user.id }) });
        const data = await readApiResponse<{ id: string }>(response, "Could not start a conversation.");
        onMessage(data.id); return;
      }
      let reason = "";
      if (name === "report") { reason = window.prompt(`Why are you reporting @${user.username}?`) || ""; if (!reason) return; }
      if (name === "block" && !user.blocked && !window.confirm(`Block @${user.username}? Following relationships will be removed and you won't see or message each other.`)) return;
      const response = await fetch("/api/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, targetId: user.id, targetType: "profile", reason }) });
      await readApiResponse(response, "Could not update this profile.");
      setNotice(name === "report" ? "Report sent to the administrator." : "Profile updated.");
      await onRefresh();
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Could not complete this action."); }
    finally { setBusyId(null); }
  }
  return <section className="explore-page"><div className="section-heading"><span className="eyebrow">DISCOVER</span><h1>Find your people</h1><p>Public profiles from the Estagram community.</p></div>{notice && <p className="panel-notice">{notice}</p>}<div className="people-grid">{users.length ? users.map((user) => <article className="person-card" key={user.id}><img src={profileImage(user)} alt="" /><div><h2>{user.displayName}</h2><strong>@{user.username}</strong><p>{user.bio || "New to Estagram."}</p><small>{user.posts} posts · {user.followers} followers{user.isSelf ? " · This is you" : user.followsYou ? " · Follows you" : ""}</small></div><div className="person-actions">{user.isSelf ? <button className="primary" onClick={onViewSelf}><UserRound /> View your profile</button> : <><button className={user.following ? "following" : "primary"} disabled={busyId === user.id || Boolean(user.blocked)} onClick={() => action(user, "follow")}>{user.following ? "Following" : <><UserPlus /> Follow</>}</button><button disabled={busyId === user.id || Boolean(user.blocked)} onClick={() => action(user, "message")}><Mail /> Message</button><button className={user.blocked ? "danger" : ""} disabled={busyId === user.id} onClick={() => action(user, "block")}><Ban /> {user.blocked ? "Unblock" : "Block"}</button><button disabled={busyId === user.id} onClick={() => action(user, "report")}><Flag /> Report</button></>}</div></article>) : <div className="empty-state"><span><Compass /></span><h2>No profiles found</h2><p>Try a different name or username.</p></div>}</div></section>;
}

function MessagesView({ profile, conversations, initialConversationId, onRefresh }: { profile: Profile; conversations: Conversation[]; initialConversationId: string | null; onRefresh: () => Promise<void> }) {
  const [activeId, setActiveId] = useState<string | null>(initialConversationId || conversations[0]?.id || null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = conversations.find((item) => item.id === activeId);
  useEffect(() => {
    if (!activeId) return;
    fetch(`/api/messages?conversationId=${encodeURIComponent(activeId)}`).then((response) => readApiResponse<{ messages: DirectMessage[] }>(response, "Could not load this conversation.")).then((data) => setMessages(data.messages)).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load messages."));
  }, [activeId]);
  async function sendMessage(event: FormEvent) {
    event.preventDefault(); if (!activeId || !body.trim()) return; setBusy(true); setError("");
    try { const response = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", conversationId: activeId, body }) }); const message = await readApiResponse<DirectMessage>(response, "Could not send this message."); setMessages((current) => [...current, message]); setBody(""); await onRefresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not send this message."); } finally { setBusy(false); }
  }
  async function requestAction(action: "accept" | "decline") {
    if (!activeId) return; setBusy(true); setError("");
    try { const response = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, conversationId: activeId }) }); await readApiResponse(response, "Could not update this request."); if (action === "decline") { setActiveId(null); setMessages([]); } await onRefresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update this request."); } finally { setBusy(false); }
  }
  return <section className="messages-page"><aside className="conversation-list"><div className="section-heading"><span className="eyebrow">DIRECT</span><h1>Messages</h1></div>{conversations.map((conversation) => <button key={conversation.id} className={activeId === conversation.id ? "active" : ""} onClick={() => setActiveId(conversation.id)}><img src={profileImage(conversation)} alt="" /><div><strong>{conversation.username}</strong><span>{conversation.lastMessage || (conversation.status === "pending" ? "Message request" : "Start the conversation")}</span></div>{conversation.unread > 0 && <i>{conversation.unread}</i>}</button>)}{!conversations.length && <p className="conversation-empty">Find someone in Explore and tap Message.</p>}</aside><div className="message-thread">{active ? <><header><img src={profileImage(active)} alt="" /><div><strong>@{active.username}</strong><span>{active.status === "pending" ? "Message request" : "Text-only conversation"}</span></div></header>{active.status === "pending" && active.requestedBy !== profile.id && <div className="message-request"><p>@{active.username} wants to message you.</p><button onClick={() => requestAction("decline")} disabled={busy}>Decline</button><button onClick={() => requestAction("accept")} disabled={busy}>Accept</button></div>}<div className="message-scroll">{messages.map((message) => <p key={message.id} className={message.senderId === profile.id ? "mine" : "theirs"}>{message.body}<time>{timeAgo(message.createdAt)}</time></p>)}</div>{error && <p className="inline-error">{error}</p>}<form className="message-composer" onSubmit={sendMessage}><input value={body} onChange={(event) => setBody(event.target.value.slice(0, 2000))} placeholder="Write a message…" disabled={active.status === "pending" && active.requestedBy !== profile.id} /><button disabled={busy || !body.trim()}><Send /></button></form></> : <div className="message-placeholder"><Mail /><h2>Your conversations</h2><p>Select a message or find someone in Explore.</p></div>}</div></section>;
}

function InstallGuide({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Install Estagram" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="profile-modal install-guide"><ModalHeader eyebrow="PWA" title="Install Estagram" onClose={onClose} /><div className="settings-intro"><span><Download /></span><div><strong>Use Estagram like an app</strong><p>Installation keeps it one tap away and enables a full-screen app experience.</p></div></div><ol><li><strong>iPhone or iPad</strong><span>Open this site in Safari, tap Share, then choose “Add to Home Screen.”</span></li><li><strong>Android</strong><span>Open the browser menu and choose “Install app” or “Add to Home screen.”</span></li><li><strong>Desktop</strong><span>Use the install icon in the address bar, or open the browser menu and choose “Install Estagram.”</span></li></ol><p className="install-note">If an install option is missing, open Estagram in Safari or Chrome first.</p></section></div>;
}

function ProfileView({ posts, profile, onCreate, onEdit, onSettings, onActivity, onOpenPost }: { posts: Post[]; profile: Profile; onCreate: () => void; onEdit: () => void; onSettings: () => void; onActivity: () => void; onOpenPost: (post: Post) => void }) {
  const [tab, setTab] = useState<"posts" | "saved">("posts");
  const ownPosts = posts.filter((post) => post.owned);
  const visiblePosts = tab === "saved" ? posts.filter((post) => Boolean(post.saved)) : ownPosts;
  return (
    <section className="profile-page">
      <header className="profile-hero"><button className="profile-photo-button" onClick={onEdit} aria-label="Update profile photo"><img src={profileImage(profile)} alt={profile.displayName} /><span><ImagePlus /></span></button><div className="profile-info"><div><h1>{profile.username}</h1><button onClick={onEdit}>Edit profile</button><button className="icon-button profile-settings" onClick={onSettings} aria-label="Profile settings"><Settings /></button></div><dl><div><dt>{ownPosts.length}</dt><dd>posts</dd></div><div><dt>{profile.followers}</dt><dd>followers</dd></div><div><dt>{profile.following}</dt><dd>following</dd></div></dl><p><strong>{profile.displayName}</strong><br />{profile.bio}<br />{profile.website && <a href={`https://${profile.website.replace(/^https?:\/\//, "")}`}>{profile.website}</a>}</p></div></header>
      <div className="profile-actions" aria-label="Profile actions"><button onClick={onActivity}><Bell /><span><strong>Activity</strong><small>See your latest updates</small></span></button><button onClick={onCreate}><Plus /><span><strong>Create</strong><small>Share a new post</small></span></button></div>
      <div className="profile-tabs" role="tablist" aria-label="Profile posts"><button className={tab === "posts" ? "active" : ""} role="tab" aria-selected={tab === "posts"} onClick={() => setTab("posts")}><ImagePlus size={15} /> POSTS</button><button className={tab === "saved" ? "active" : ""} role="tab" aria-selected={tab === "saved"} onClick={() => setTab("saved")}><Bookmark size={15} /> SAVED</button></div>
      {visiblePosts.length ? <div className="profile-grid">{visiblePosts.map((post) => <button key={post.id} onClick={() => onOpenPost(post)} aria-label={`Open ${post.mediaType}: ${post.caption}`}>{post.mediaType === "video" ? <><video src={imageSource(post)} muted playsInline preload="metadata" aria-label={post.caption} /><i className="video-badge"><Video /></i></> : <img src={imageSource(post)} alt={post.caption} />}<span><Heart fill="currentColor" size={17} /> {post.likes}</span></button>)}{tab === "posts" && <button className="grid-add" onClick={onCreate}><Plus /><span>Add a post</span></button>}</div> : <div className="saved-empty"><span><Bookmark /></span><h3>No saved posts yet</h3><p>Tap the bookmark on a post and it will appear here.</p></div>}
    </section>
  );
}

function MediaViewer({ post, profile, onClose, onCaptionUpdate, onDelete, onToggle, onComment }: { post: Post; profile: Profile; onClose: () => void; onCaptionUpdate: (postId: string, caption: string) => Promise<void>; onDelete: (postId: string) => Promise<void>; onToggle: (id: string, action: "like" | "save") => Promise<void>; onComment: (postId: string, body: string) => Promise<void> }) {
  const [caption, setCaption] = useState(post.caption);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [videoMuted, setVideoMuted] = useState(true);
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [fitMode, setFitMode] = useState<"fit" | "fill">("fit");
  const [zoom, setZoom] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

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

  async function submitViewerComment(event: FormEvent) {
    event.preventDefault();
    if (!comment.trim()) return;
    setCommentBusy(true); setError("");
    try { await onComment(post.id, comment); setComment(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not post comment."); }
    finally { setCommentBusy(false); }
  }

  return (
    <div className="media-viewer" role="dialog" aria-modal="true" aria-label="Post media viewer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <button className="media-viewer-close" onClick={onClose} aria-label="Close full-screen media"><X /></button>
      <section className={`media-viewer-card ${post.mediaType === "video" ? "video-viewer-card" : "image-viewer-card"}`}>
        <div className={`media-viewer-stage ${fitMode === "fill" ? "viewer-fill" : "viewer-fit"}`}>{post.mediaType === "video" ? <><video ref={videoRef} key={`${post.id}-${post.imageKey || post.imageUrl}`} src={imageSource(post)} autoPlay muted={videoMuted} controls playsInline preload="auto" onCanPlay={(event) => event.currentTarget.play().catch(() => undefined)} /><button type="button" className="media-audio-toggle" onClick={toggleViewerSound} aria-label={videoMuted ? "Unmute video" : "Mute video"}>{videoMuted ? <VolumeX /> : <Volume2 />}</button></> : <><img src={imageSource(post)} alt={post.caption} style={{ transform: `scale(${zoom})` }} /><div className="viewer-media-controls" aria-label="Image display controls"><button type="button" className={fitMode === "fit" ? "active" : ""} aria-pressed={fitMode === "fit"} onClick={() => { setFitMode("fit"); setZoom(1); }}>Fit</button><button type="button" className={fitMode === "fill" ? "active" : ""} aria-pressed={fitMode === "fill"} onClick={() => { setFitMode("fill"); setZoom(1); }}>Fill</button><button type="button" onClick={() => setZoom((value) => Math.min(3, value + .25))} aria-label="Zoom in">+</button><button type="button" onClick={() => setZoom((value) => Math.max(1, value - .25))} aria-label="Zoom out">−</button><button type="button" onClick={() => { setFitMode("fit"); setZoom(1); }}>Reset</button></div></>}</div>
        <aside className="media-viewer-details">
          <header><img src={profileImage(post.author)} alt="" /><div><strong>{post.author.username}</strong><span>{post.author.location}</span></div></header>
          {editing ? <form className="viewer-caption-form" onSubmit={saveCaption}><label htmlFor="viewer-caption">Edit caption</label><textarea id="viewer-caption" autoFocus value={caption} onChange={(event) => setCaption(event.target.value.slice(0, 500))} rows={6} /><small>{caption.length}/500</small><div><button type="button" onClick={() => { setCaption(post.caption); setEditing(false); }}>Cancel</button><button disabled={busy || !caption.trim()}>{busy ? "Saving…" : "Save caption"}</button></div></form> : <div className="viewer-caption"><p><b>{post.author.username}</b> {post.caption}</p><time>{relativeTime(post.createdAt)}</time>{commentOpen && <div className="viewer-comments">{post.comments.length ? post.comments.map((item) => <div className="comment-item" key={item.id}><img src={profileImage(item.author)} alt="" /><p><b>{item.author.username}</b> {item.body}</p></div>) : <p className="viewer-comments-empty">Be the first to comment.</p>}<form onSubmit={submitViewerComment}><img src={profileImage(profile)} alt="" /><input ref={commentInputRef} value={comment} onChange={(event) => setComment(event.target.value.slice(0, 280))} placeholder="Add a comment…" aria-label="Add a comment" /><button disabled={!comment.trim() || commentBusy}>{commentBusy ? "Posting…" : "Post"}</button></form></div>}</div>}
          <div className="viewer-stats"><button className={post.liked ? "liked" : ""} onClick={() => onToggle(post.id, "like")} aria-label={post.liked ? "Unlike post" : "Like post"}><Heart fill={post.liked ? "currentColor" : "none"} /> {post.likes.toLocaleString()} likes</button><button onClick={() => { const next = !commentOpen; setCommentOpen(next); if (next) window.setTimeout(() => commentInputRef.current?.focus(), 0); }} aria-expanded={commentOpen}><MessageCircle /> {post.comments.length} comments</button></div>
          {post.owned && <div className="viewer-actions"><button onClick={() => setEditing(true)}>Edit caption</button>{confirmDelete ? <div className="delete-confirm"><p>Delete this post permanently?</p><button onClick={() => setConfirmDelete(false)}>Cancel</button><button onClick={remove} disabled={busy}>{busy ? "Deleting…" : "Yes, delete"}</button></div> : <button className="danger" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete post</button>}</div>}
          {error && <p className="viewer-error">{error}</p>}
        </aside>
      </section>
    </div>
  );
}

function EditProfileModal({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: (profile: Profile) => void }) {
  const [draft, setDraft] = useState(profile);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoPreview = useMemo(() => photoFile ? URL.createObjectURL(photoFile) : profileImage(profile), [photoFile, profile]);

  useEffect(() => () => { if (photoFile && photoPreview) URL.revokeObjectURL(photoPreview); }, [photoFile, photoPreview]);

  const update = (key: keyof Profile, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  function selectProfilePhoto(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.type === "image/gif") { setError("Choose a JPG, PNG or WebP profile photo."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Profile photos must be under 10 MB."); return; }
    setPhotoFile(file); setCropZoom(1); setCropX(50); setCropY(50); setError("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      if (photoFile) {
        const croppedPhoto = await cropProfileImage(photoFile, cropZoom, cropX, cropY);
        await uploadMediaInParts(croppedPhoto, "profile", "", setUploadProgress);
      }
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await readApiResponse<Profile>(response, "Could not update profile.");
      onSaved(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update profile.");
      setBusy(false);
      setUploadProgress(0);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit profile" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="profile-modal" onSubmit={save}>
        <ModalHeader eyebrow="PROFILE" title="Edit profile" onClose={onClose} action={busy && uploadProgress ? `Uploading ${uploadProgress}%` : busy ? "Saving…" : "Save"} disabled={busy} />
        <div className="profile-photo-row"><input ref={photoInputRef} className="file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectProfilePhoto(event.target.files?.[0] || null)} /><img src={photoPreview} alt={draft.displayName} /><div><strong>{draft.username}</strong><span>JPG, PNG or WebP · up to 10 MB</span></div><button type="button" onClick={() => photoInputRef.current?.click()}>Change photo</button></div>
        {photoFile && <section className="profile-cropper" aria-label="Adjust profile photo crop"><div><span>Adjust crop</span><small>Your saved photo will be square.</small></div><div className="profile-crop-preview"><img src={photoPreview} alt="Crop preview" style={{ objectPosition: `${cropX}% ${cropY}%`, transform: `scale(${cropZoom})` }} /></div><label><span>Zoom</span><input type="range" min="1" max="3" step="0.05" value={cropZoom} onChange={(event) => setCropZoom(Number(event.target.value))} /></label><label><span>Horizontal</span><input type="range" min="0" max="100" value={cropX} onChange={(event) => setCropX(Number(event.target.value))} /></label><label><span>Vertical</span><input type="range" min="0" max="100" value={cropY} onChange={(event) => setCropY(Number(event.target.value))} /></label></section>}
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

function SettingsModal({ profile, installPrompt, onInstallGuide, onClose, onSaved }: { profile: Profile; installPrompt: (Event & { prompt?: () => Promise<void> }) | null; onInstallGuide: () => void; onClose: () => void; onSaved: (profile: Profile) => void }) {
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
        <div className="settings-content">
          <div className="settings-intro"><span><SlidersHorizontal /></span><div><strong>Make Estagram yours</strong><p>Choose how your profile and uploads behave.</p></div></div>
          <div className="settings-list">
            <SettingRow title="Private account" description="Hide your profile from public discovery." checked={Boolean(draft.privateAccount)} onChange={() => toggle("privateAccount")} />
            <SettingRow title="Story replies" description="Allow quick replies while viewing stories." checked={Boolean(draft.storyReplies)} onChange={() => toggle("storyReplies")} />
            <SettingRow title="High-quality uploads" description="Keep original detail in photos and videos." checked={Boolean(draft.highQualityUploads)} onChange={() => toggle("highQualityUploads")} />
          </div>
          <button className="settings-install" onClick={() => installPrompt?.prompt ? installPrompt.prompt() : onInstallGuide()}><Sparkles /> Install Estagram on this device</button>
          {profile.role === "admin" && <AdminControls />}
          <a className="settings-signout" href="/signout-with-chatgpt?return_to=%2Flogin">Sign out of Estagram</a>
          {error && <p className="form-error profile-error">{error}</p>}
        </div>
      </section>
    </div>
  );
}

type AdminInvite = { code: string; createdAt: number; claimedAt?: number | null; creatorUsername?: string; claimedUsername?: string; revoked: number };
type AdminData = { registrationMode: string; invites: AdminInvite[]; reports: { id: string; targetType: string; targetId: string; reason: string; status: string; reporterUsername: string }[]; members: { id: string; username: string; displayName: string; status: string }[] };
type InviteFilter = "all" | "available" | "claimed" | "revoked";

function adminDate(value?: number | null) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function AdminControls() {
  const [data, setData] = useState<AdminData | null>(null);
  const [notice, setNotice] = useState("");
  const [inviteFilter, setInviteFilter] = useState<InviteFilter>("all");
  const [busyKey, setBusyKey] = useState("");
  const load = useCallback(async () => { const response = await fetch("/api/social"); const result = await readApiResponse<{ admin: AdminData }>(response, "Could not load admin tools."); setData(result.admin); }, []);
  useEffect(() => { fetch("/api/social").then((response) => readApiResponse<{ admin: AdminData }>(response, "Could not load admin tools.")).then((result) => setData(result.admin)).catch((reason) => setNotice(reason instanceof Error ? reason.message : "Could not load admin tools.")); }, []);
  const visibleInvites = useMemo(() => data?.invites.filter((invite) => inviteFilter === "all" || (inviteFilter === "claimed" ? Boolean(invite.claimedUsername) : inviteFilter === "revoked" ? Boolean(invite.revoked) : !invite.claimedUsername && !invite.revoked)) || [], [data, inviteFilter]);

  async function act(payload: Record<string, unknown>, key = String(payload.action || "admin")) {
    setNotice(""); setBusyKey(key);
    try {
      const response = await fetch("/api/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await readApiResponse<{ code?: string; revoked?: boolean }>(response, "Could not complete this admin action.");
      if (payload.action === "create-invite" && result.code) setNotice(`Invite created: ${result.code}`);
      else if (payload.action === "revoke-invite") setNotice(`Invite ${result.code} deactivated.`);
      else if (payload.action === "reactivate-invite") setNotice(`Invite ${result.code} reactivated.`);
      else setNotice("Admin setting updated.");
      await load();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Could not complete this admin action.");
    } finally { setBusyKey(""); }
  }

  async function copyInvite(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setNotice(`Invite ${code} copied.`);
    } catch {
      window.prompt("Copy this invite code", code);
    }
  }

  function changeInvite(invite: AdminInvite) {
    const revoking = !invite.revoked;
    if (revoking && !window.confirm(`Deactivate invite ${invite.code}? It will stop working immediately.`)) return;
    act({ action: revoking ? "revoke-invite" : "reactivate-invite", code: invite.code }, `invite-${invite.code}`);
  }

  if (!data) return <section className="admin-controls"><p>Loading admin tools…</p></section>;
  return <section className="admin-controls">
    <header><div><span>ADMIN</span><h3>Community controls</h3></div><button type="button" disabled={busyKey === "create-invite"} onClick={() => act({ action: "create-invite" })}>{busyKey === "create-invite" ? "Creating…" : "Create invite"}</button></header>
    <SettingRow title="Open registration" description="Allow adults to join without an invite code." checked={data.registrationMode === "open"} onChange={() => act({ action: "registration-mode", mode: data.registrationMode === "open" ? "invite" : "open" })} />
    {notice && <p className="panel-notice" aria-live="polite">{notice}</p>}
    <details open>
      <summary>Invite codes ({data.invites.length})</summary>
      <div className="invite-toolbar" aria-label="Filter invite codes">{(["all", "available", "claimed", "revoked"] as InviteFilter[]).map((filter) => <button type="button" className={inviteFilter === filter ? "active" : ""} key={filter} onClick={() => setInviteFilter(filter)}>{filter[0].toUpperCase() + filter.slice(1)}</button>)}</div>
      <div className="invite-list">
        {visibleInvites.map((invite) => {
          const status = invite.claimedUsername ? "claimed" : invite.revoked ? "revoked" : "available";
          return <article className="invite-row" key={invite.code}>
            <div className="invite-code-line"><code>{invite.code}</code><span className={`invite-status ${status}`}>{status}</span></div>
            <p className="invite-meta">Created {adminDate(invite.createdAt)} by @{invite.creatorUsername || "admin"}</p>
            {invite.claimedUsername && <p className="invite-meta">Claimed {adminDate(invite.claimedAt)} by @{invite.claimedUsername}</p>}
            <div className="invite-actions"><button type="button" onClick={() => copyInvite(invite.code)}>Copy</button>{!invite.claimedUsername && <button type="button" disabled={busyKey === `invite-${invite.code}`} onClick={() => changeInvite(invite)}>{busyKey === `invite-${invite.code}` ? "Updating…" : invite.revoked ? "Reactivate" : "Deactivate"}</button>}</div>
          </article>;
        })}
        {!visibleInvites.length && <p className="invite-empty">No {inviteFilter === "all" ? "" : `${inviteFilter} `}invite codes.</p>}
      </div>
    </details>
    <details><summary>Reports ({data.reports.filter((item) => item.status === "open").length} open)</summary>{data.reports.map((report) => <article key={report.id}><strong>{report.targetType} report from @{report.reporterUsername}</strong><p>{report.reason}</p>{report.status === "open" && <button type="button" onClick={() => act({ action: "resolve-report", reportId: report.id })}>Mark resolved</button>}</article>)}</details>
    <details><summary>Members ({data.members.length})</summary>{data.members.map((member) => <p key={member.id}><span><b>@{member.username}</b> · {member.displayName}</span><button type="button" onClick={() => act({ action: "suspend", targetId: member.id })}>{member.status === "active" ? "Suspend" : "Restore"}</button></p>)}</details>
  </section>;
}

function ActivityModal({ activities, posts, onClose }: { activities: Activity[]; posts: Post[]; onClose: () => void }) {
  useEffect(() => { fetch("/api/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "read-notifications" }) }).catch(() => undefined); }, []);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Activity" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="profile-modal activity-modal">
        <ModalHeader eyebrow="PROFILE" title="Activity" onClose={onClose} />
        {activities.length ? <div className="activity-list">{activities.map((activity) => { const post = posts.find((item) => item.id === activity.postId); return <div className="activity-item" key={activity.id}><span className={`activity-icon ${activity.type}`}>{activity.type === "like" ? <Heart fill="currentColor" /> : activity.type === "follow" ? <UserPlus /> : activity.type === "message" ? <Mail /> : <MessageCircle />}</span><div><p>{activity.message}</p><time>{relativeTime(activity.createdAt)}</time></div>{post && (post.mediaType === "video" ? <span className="activity-video"><Video /></span> : <img src={imageSource(post)} alt="" />)}</div>; })}</div> : <div className="activity-empty"><span><Bell /></span><h3>No activity yet</h3><p>Follows, messages, likes, and comments will appear here.</p></div>}
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
