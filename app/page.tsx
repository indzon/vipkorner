"use client";

import {
  Bell,
  Bookmark,
  Check,
  ChevronLeft,
  Compass,
  Heart,
  Home,
  ImagePlus,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
};

type Profile = {
  username: string;
  displayName: string;
  bio: string;
  website: string;
  location: string;
  privateAccount: number | boolean;
  storyReplies: number | boolean;
  highQualityUploads: number | boolean;
};

type Story = {
  id: string;
  imageKey: string | null;
  imageUrl: string | null;
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
  privateAccount: true,
  storyReplies: true,
  highQualityUploads: true,
};

function imageSource(item: { imageKey: string | null; imageUrl: string | null }) {
  return item.imageKey ? `/api/media?key=${encodeURIComponent(item.imageKey)}` : item.imageUrl || "";
}

function timeAgo(timestamp: number) {
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState<"post" | "story" | null>(null);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [view, setView] = useState<"home" | "profile">("home");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<Event & { prompt?: () => Promise<void> } | null>(null);
  const [profilePanel, setProfilePanel] = useState<"edit" | "settings" | "activity" | null>(null);

  const loadFeed = useCallback(async () => {
    try {
      const response = await fetch("/api/feed");
      if (!response.ok) throw new Error("Could not load feed");
      const data = await response.json() as { posts: Post[]; stories: Story[]; profile: Profile | null };
      setPosts(data.posts);
      setStories(data.stories);
      if (data.profile) setProfile(data.profile);
    } catch {
      setToast("We couldn't refresh the feed. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as Event & { prompt?: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => window.removeEventListener("beforeinstallprompt", onInstall);
  }, [loadFeed]);

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
    } catch {
      loadFeed();
    }
  }

  const profileNav = () => { setView("profile"); setSearchOpen(false); };
  const homeNav = () => { setView("home"); setSearchOpen(false); };

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
            <StoriesTray stories={stories} onAdd={() => setComposer("story")} onOpen={setActiveStory} />
            <div className="feed-title"><div><span className="eyebrow">YOUR FEED</span><h1>Good afternoon, {profile.displayName.split(" ")[0]}</h1></div><button onClick={() => setComposer("post")}><Plus size={17} /> New post</button></div>
            <section className="feed" aria-label="Posts">
              {loading ? <FeedSkeleton /> : filteredPosts.length ? filteredPosts.map((post) => <PostCard key={post.id} post={post} profile={profile} onToggle={togglePost} />) : <EmptyState searched={Boolean(query)} onCreate={() => setComposer("post")} />}
            </section>
          </>
        ) : (
          <ProfileView posts={posts} profile={profile} onCreate={() => setComposer("post")} onEdit={() => setProfilePanel("edit")} onSettings={() => setProfilePanel("settings")} onActivity={() => setProfilePanel("activity")} />
        )}
      </section>

      <aside className="desktop-profile">
        <div className="mini-profile"><img src={PROFILE_IMAGE} alt={profile.displayName} /><div><strong>{profile.username}</strong><span>{profile.displayName}</span></div><button onClick={profileNav}>View</button></div>
        <div className="daily-note"><span className="note-icon"><Sparkles /></span><p>Keep the moments that feel like you.</p><small>Your private creative corner</small></div>
        <footer><button>About</button><span>·</span><button>Privacy</button><span>·</span><button>Help</button><p>© 2026 ESTAGRAM</p></footer>
      </aside>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button className={view === "home" ? "active" : ""} onClick={homeNav} aria-label="Home"><Home /></button>
        <button onClick={() => { setSearchOpen(true); setView("home"); }} aria-label="Search"><Search /></button>
        <button className={view === "profile" ? "active" : ""} onClick={profileNav} aria-label="Profile"><img src={PROFILE_IMAGE} alt="" /></button>
      </nav>

      {composer && <Composer type={composer} profile={profile} onClose={() => setComposer(null)} onCreated={(message) => { setComposer(null); setToast(message); loadFeed(); }} />}
      {activeStory && <StoryViewer story={activeStory} profile={profile} onClose={() => setActiveStory(null)} />}
      {profilePanel === "edit" && <EditProfileModal profile={profile} onClose={() => setProfilePanel(null)} onSaved={(next) => { setProfile(next); setProfilePanel(null); setToast("Profile updated."); }} />}
      {profilePanel === "settings" && <SettingsModal profile={profile} installPrompt={installPrompt} onClose={() => setProfilePanel(null)} onSaved={(next) => { setProfile(next); setProfilePanel(null); setToast("Settings saved."); }} />}
      {profilePanel === "activity" && <ActivityModal onClose={() => setProfilePanel(null)} />}
      {toast && <div className="toast" role="status"><Check size={17} /> {toast}</div>}
    </main>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function StoriesTray({ stories, onAdd, onOpen }: { stories: Story[]; onAdd: () => void; onOpen: (story: Story) => void }) {
  return (
    <section className="stories-section" aria-label="Stories">
      <div className="stories-heading"><span>Stories</span><small>24h moments</small></div>
      <div className="stories-scroll">
        <button className="story-item add-story" onClick={onAdd}>
          <span className="story-ring"><img src={PROFILE_IMAGE} alt="" /><i><Plus size={14} /></i></span><span>Add story</span>
        </button>
        {stories.map((story, index) => (
          <button className="story-item" key={story.id} onClick={() => onOpen(story)}>
            <span className="story-ring active-story"><img src={imageSource(story)} alt="Your story" /></span><span>{index === 0 ? "Today" : `${timeAgo(story.createdAt)} ago`}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function PostCard({ post, profile, onToggle }: { post: Post; profile: Profile; onToggle: (id: string, action: "like" | "save") => void }) {
  const [commentOpen, setCommentOpen] = useState(false);
  return (
    <article className="post-card">
      <header className="post-header"><div className="post-author"><img src={PROFILE_IMAGE} alt="" /><div><strong>{profile.username}</strong><span>{profile.location}</span></div></div><button className="icon-button" aria-label="Post options"><MoreHorizontal /></button></header>
      <div className="post-image-wrap" onDoubleClick={() => !post.liked && onToggle(post.id, "like")}>
        {post.mediaType === "video" ? <video className="post-image post-video" src={imageSource(post)} controls playsInline preload="metadata" aria-label={post.caption} /> : <img className="post-image" src={imageSource(post)} alt={post.caption} />}
      </div>
      <div className="post-actions"><div><button className={`icon-button ${post.liked ? "liked" : ""}`} onClick={() => onToggle(post.id, "like")} aria-label={post.liked ? "Unlike" : "Like"}><Heart fill={post.liked ? "currentColor" : "none"} /></button><button className="icon-button" onClick={() => setCommentOpen((open) => !open)} aria-label="Comment"><MessageCircle /></button><button className="icon-button" onClick={() => navigator.share?.({ title: "Estagram", text: post.caption, url: location.href })} aria-label="Share"><Send /></button></div><button className={`icon-button ${post.saved ? "saved" : ""}`} onClick={() => onToggle(post.id, "save")} aria-label={post.saved ? "Unsave" : "Save"}><Bookmark fill={post.saved ? "currentColor" : "none"} /></button></div>
      <div className="post-copy"><strong>{post.likes.toLocaleString()} likes</strong><p><b>{profile.username}</b> {post.caption}</p><time>{timeAgo(post.createdAt)} ago</time></div>
      {commentOpen && <form className="comment-row" onSubmit={(event) => { event.preventDefault(); setCommentOpen(false); }}><input autoFocus placeholder="Add a comment…" aria-label="Comment" /><button>Post</button></form>}
    </article>
  );
}

function Composer({ type, profile, onClose, onCreated }: { type: "post" | "story"; profile: Profile; onClose: () => void; onCreated: (message: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => file ? URL.createObjectURL(file) : "", [file]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) { setError("Choose a photo first."); return; }
    setBusy(true); setError("");
    const body = new FormData();
    body.set("image", file);
    if (type === "post") body.set("caption", caption);
    try {
      const response = await fetch(type === "post" ? "/api/posts" : "/api/stories", { method: "POST", body });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      onCreated(type === "post" ? "Your post is live." : "Story shared for 24 hours.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Create ${type}`} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="composer" onSubmit={submit}>
        <header><button type="button" className="icon-button composer-close" onClick={onClose} aria-label="Close"><X /></button><div><span>CREATE</span><h2>New {type}</h2></div><button className="share-button" disabled={!file || busy}>{busy ? "Sharing…" : "Share"}</button></header>
        <input ref={inputRef} className="file-input" type="file" accept={type === "post" ? "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" : "image/jpeg,image/png,image/webp,image/gif"} onChange={(event) => setFile(event.target.files?.[0] || null)} />
        {preview ? (
          <button type="button" className={`preview-frame ${type}`} onClick={() => inputRef.current?.click()}>{file?.type.startsWith("video/") ? <video src={preview} muted playsInline aria-label="Selected video preview" /> : <img src={preview} alt="Selected preview" />}<span>Change {file?.type.startsWith("video/") ? "video" : "photo"}</span></button>
        ) : (
          <button type="button" className={`upload-drop ${type}`} onClick={() => inputRef.current?.click()}><span>{type === "post" ? <Video /> : <ImagePlus />}</span><h3>Choose a {type === "post" ? "photo or video" : "photo"}</h3><p>{type === "story" ? "Portrait photos look best in stories." : "Photos up to 10 MB · MP4, WebM or MOV up to 50 MB"}</p><b>Select from device</b></button>
        )}
        {type === "post" && <div className="caption-field"><img src={PROFILE_IMAGE} alt={profile.displayName} /><textarea value={caption} onChange={(event) => setCaption(event.target.value.slice(0, 500))} placeholder="Write a caption…" rows={3} /><small>{caption.length}/500</small></div>}
        {type === "story" && <div className="expiry-note"><span>24h</span><p><strong>Made for the moment.</strong>Your story will disappear automatically after 24 hours.</p></div>}
        {error && <p className="form-error">{error}</p>}
      </form>
    </div>
  );
}

function StoryViewer({ story, profile, onClose }: { story: Story; profile: Profile; onClose: () => void }) {
  useEffect(() => { const id = window.setTimeout(onClose, 6000); return () => window.clearTimeout(id); }, [onClose]);
  return (
    <div className="story-viewer" role="dialog" aria-modal="true" aria-label="Story">
      <div className="story-frame"><div className="story-progress"><span /></div><header><div><img src={PROFILE_IMAGE} alt="" /><strong>{profile.username}</strong><span>{timeAgo(story.createdAt)}</span></div><button onClick={onClose} aria-label="Close story"><X /></button></header><img className="story-full-image" src={imageSource(story)} alt="Your story" /><footer><span>Story expires in {Math.max(1, Math.ceil((story.expiresAt - Date.now()) / 3600000))}h</span></footer></div>
    </div>
  );
}

function ProfileView({ posts, profile, onCreate, onEdit, onSettings, onActivity }: { posts: Post[]; profile: Profile; onCreate: () => void; onEdit: () => void; onSettings: () => void; onActivity: () => void }) {
  return (
    <section className="profile-page">
      <header className="profile-hero"><img src={PROFILE_IMAGE} alt={profile.displayName} /><div className="profile-info"><div><h1>{profile.username}</h1><button onClick={onEdit}>Edit profile</button><button className="icon-button profile-settings" onClick={onSettings} aria-label="Profile settings"><Settings /></button></div><dl><div><dt>{posts.length}</dt><dd>posts</dd></div><div><dt>{posts.reduce((total, post) => total + post.likes, 0).toLocaleString()}</dt><dd>likes</dd></div><div><dt>1</dt><dd>creative space</dd></div></dl><p><strong>{profile.displayName}</strong><br />{profile.bio}<br /><a href={`https://${profile.website.replace(/^https?:\/\//, "")}`}>{profile.website}</a></p></div></header>
      <div className="profile-actions" aria-label="Profile actions"><button onClick={onActivity}><Bell /><span><strong>Activity</strong><small>See your latest updates</small></span></button><button onClick={onCreate}><Plus /><span><strong>Create</strong><small>Share a new post</small></span></button></div>
      <div className="profile-tabs"><span className="active"><ImagePlus size={15} /> POSTS</span><span><Bookmark size={15} /> SAVED</span></div>
      <div className="profile-grid">{posts.map((post) => <button key={post.id}>{post.mediaType === "video" ? <><video src={imageSource(post)} muted playsInline preload="metadata" aria-label={post.caption} /><i className="video-badge"><Video /></i></> : <img src={imageSource(post)} alt={post.caption} />}<span><Heart fill="currentColor" size={17} /> {post.likes}</span></button>)}<button className="grid-add" onClick={onCreate}><Plus /><span>Add a post</span></button></div>
    </section>
  );
}

function EditProfileModal({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: (profile: Profile) => void }) {
  const [draft, setDraft] = useState(profile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const update = (key: keyof Profile, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json() as Profile & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not update profile.");
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
        <div className="profile-photo-row"><img src={PROFILE_IMAGE} alt={draft.displayName} /><div><strong>{draft.username}</strong><span>Your profile photo</span></div></div>
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

function ActivityModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Activity" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="profile-modal activity-modal">
        <ModalHeader eyebrow="PROFILE" title="Activity" onClose={onClose} />
        <div className="activity-empty"><span><Bell /></span><h3>You're all caught up</h3><p>New likes, saves, and story activity will appear here.</p></div>
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
