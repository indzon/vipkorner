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
  MapPin,
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

type PostMedia = {
  id: string;
  position: number;
  caption: string;
  imageKey: string | null;
  imageUrl: string | null;
  mediaType: "image" | "video";
};

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
  media: PostMedia[];
};

type PublicUser = { id: string; username: string; displayName: string; location?: string; bio?: string; imageKey: string | null; imageUrl: string | null };
type Comment = { id: string; postId: string; body: string; createdAt: number; author: PublicUser };
type FollowRequestStatus = "pending" | "approved" | "declined" | "canceled" | null;
type Activity = { id: string; type: "like" | "comment" | "follow" | "message" | "story_reaction" | "follow_request" | "follow_request_approved" | "follow_request_declined"; postId: string | null; message: string; createdAt: number; readAt?: number | null; actorId?: string | null; actorUsername?: string | null; actorDisplayName?: string | null; actorImageKey?: string | null; actorImageUrl?: string | null; requestStatus?: FollowRequestStatus };

type Profile = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  website: string;
  location: string;
  imageKey: string | null;
  imageUrl: string | null;
  heroImageKey: string | null;
  heroImageUrl: string | null;
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
  reaction: string | null;
  reactionCount: number;
  reactionsAllowed: number | boolean;
  author: PublicUser;
};

type DiscoveryUser = PublicUser & { isPublic: number | boolean; following: number | boolean; followsYou: number | boolean; followRequestStatus?: FollowRequestStatus; blocked: number | boolean; followers: number; posts: number; role: string; isSelf: number | boolean };
type MemberProfile = PublicUser & { website?: string; isPublic: number | boolean; following: number | boolean; followsYou: number | boolean; followRequestStatus?: FollowRequestStatus; followers: number; followingCount: number; posts: number; isSelf: number | boolean; heroImageKey?: string | null; heroImageUrl?: string | null };
type ConnectionCounts = { following: number; followers: number };
type ConnectionUser = PublicUser & { connectedAt: number };
type Conversation = { id: string; status: "pending" | "accepted"; requestedBy: string; updatedAt: number; otherId: string; username: string; displayName: string; imageKey: string | null; imageUrl: string | null; lastMessage: string | null; unread: number };
type DirectMessage = { id: string; senderId: string; body: string; createdAt: number };
const STORY_REACTION_EMOJIS = ["❤️", "😂", "🔥", "👏", "😮"] as const;

function profileImage(profile: { imageKey: string | null; imageUrl: string | null; username?: string; displayName?: string }) {
  if (profile.imageKey || profile.imageUrl) return imageSource(profile);
  const initials = ((profile.displayName || profile.username || "E").match(/[a-z0-9]/gi) || ["E"]).slice(0, 2).join("").toUpperCase();
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#6d2b61"/><stop offset="1" stop-color="#ef5778"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g)"/><text x="50" y="58" text-anchor="middle" fill="white" font-family="Arial" font-size="34" font-weight="700">${initials}</text></svg>`)}`;
}

function imageSource(item: { imageKey: string | null; imageUrl: string | null }) {
  return item.imageKey ? `/api/media?key=${encodeURIComponent(item.imageKey)}` : item.imageUrl || "";
}

function postMediaItems(post: Post): PostMedia[] {
  return post.media?.length ? post.media : [{ id: `${post.id}-primary`, position: 0, caption: "", imageKey: post.imageKey, imageUrl: post.imageUrl, mediaType: post.mediaType }];
}

function isVideoFile(file: File) {
  return file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
}

type UploadContentKind = "post" | "story" | "profile" | "profile-hero";

async function readApiResponse<T>(response: Response, fallback: string): Promise<T> {
  const text = await response.text();
  let data: { error?: string } = {};
  try { data = text ? JSON.parse(text) as { error?: string } : {}; } catch { data = {}; }
  if (!response.ok) throw new Error(data.error || (response.status === 413 ? "This upload is too large for one request. Please try again." : text || fallback));
  return data as T;
}

async function uploadMediaInParts(file: File, contentKind: UploadContentKind, caption: string, onProgress: (value: number) => void, captionPosition?: { x: number; y: number }, postMeta?: { postId: string; position: number; itemCaption: string }) {
  const inspected = await inspectMediaUpload(file);
  if (!inspected) throw new Error("This file is not a supported photo or video.");
  if ((contentKind === "profile" || contentKind === "profile-hero") && (inspected.kind !== "image" || inspected.extension === "gif")) throw new Error("Choose a JPG, PNG or WebP image.");
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
    const completeResponse = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete", key: started.key, uploadId: started.uploadId, parts, contentKind, caption, captionX: captionPosition?.x, captionY: captionPosition?.y, ...postMeta }) });
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
  const [activeStoryAuthorId, setActiveStoryAuthorId] = useState<string | null>(null);
  const [view, setView] = useState<"home" | "profile" | "member" | "explore" | "messages">("home");
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
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);
  const [memberProfileError, setMemberProfileError] = useState("");
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

  const startMemberConversation = useCallback(async (userId: string) => {
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", targetId: userId }),
      });
      const data = await readApiResponse<{ id: string }>(response, "Could not start a conversation.");
      setActiveConversationId(data.id);
      setView("messages");
      setSearchOpen(false);
      await loadConversations();
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "Could not start a conversation.");
    }
  }, [loadConversations]);

  const updateConnectionCounts = useCallback((counts: ConnectionCounts) => {
    setProfile((current) => current ? { ...current, ...counts } : current);
  }, []);

  const loadSocialCounts = useCallback(async () => {
    const response = await fetch("/api/social?counts=1");
    if (!response.ok) return;
    const data = await response.json() as { counts?: ConnectionCounts };
    if (data.counts) updateConnectionCounts(data.counts);
  }, [updateConnectionCounts]);

  const openMemberProfile = useCallback(async (userId: string) => {
    if (userId === profile?.id) { setView("profile"); setSearchOpen(false); setQuery(""); return; }
    setProfilePanel(null);
    setMemberProfile(null);
    setMemberProfileError("");
    setView("member");
    setSearchOpen(false);
    setQuery("");
    try {
      const response = await fetch(`/api/social?profile=${encodeURIComponent(userId)}`);
      const data = await readApiResponse<{ profile: MemberProfile }>(response, "Could not load this profile.");
      setMemberProfile(data.profile);
    } catch (reason) {
      setMemberProfileError(reason instanceof Error ? reason.message : "Could not load this profile.");
    }
  }, [profile?.id]);

  useEffect(() => { const readyTimer = window.setTimeout(() => setAccessReady(true), 0); return () => window.clearTimeout(readyTimer); }, []);

  useEffect(() => {
    if (!accessReady) return;
    const loadTimer = window.setTimeout(() => {
      void loadFeed();
      void loadConversations().catch(() => undefined);
    }, 0);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as Event & { prompt?: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => { window.clearTimeout(loadTimer); window.removeEventListener("beforeinstallprompt", onInstall); };
  }, [accessReady, loadConversations, loadFeed]);

  useEffect(() => {
    if (!accessReady) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void loadFeed();
      void loadSocialCounts();
      void loadConversations().catch(() => undefined);
    };
    const interval = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [accessReady, loadConversations, loadFeed, loadSocialCounts]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const filteredPosts = useMemo(() => {
    if (!query.trim()) return posts;
    return posts.filter((post) => post.caption.toLowerCase().includes(query.toLowerCase()));
  }, [posts, query]);

  const unreadMessages = useMemo(
    () => conversations.reduce((total, conversation) => total + Number(conversation.unread || 0), 0),
    [conversations],
  );

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

  async function reactToStory(storyId: string, emoji: string) {
    const response = await fetch("/api/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "react", id: storyId, emoji }),
    });
    const result = await readApiResponse<{ reaction: string | null; reactionCount: number }>(response, "Could not react to this story.");
    setStories((current) => current.map((story) => story.id === storyId ? { ...story, reaction: result.reaction, reactionCount: result.reactionCount } : story));
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
        <button className="brand" onClick={homeNav} aria-label="VipKorner home"><span className="brand-mark">V</span><span>VipKorner</span></button>
        <nav>
          <NavButton icon={<Home />} label="Home" active={view === "home" && !searchOpen} onClick={homeNav} />
          <NavButton icon={<Compass />} label="Explore" active={view === "explore"} onClick={exploreNav} />
          <NavButton icon={<Mail />} label="Messages" badge={unreadMessages} active={view === "messages"} onClick={messagesNav} />
          <NavButton icon={<UserRound />} label="Profile" active={view === "profile"} onClick={profileNav} />
        </nav>
        <div className="nav-footer">
          <button className="install-button" onClick={() => installPrompt?.prompt ? installPrompt.prompt() : setInstallGuideOpen(true)}><Download size={17} /> Install app</button>
          <NavButton icon={<Menu />} label="More" onClick={() => setProfilePanel("settings")} />
        </div>
      </aside>

      <section className="content-column">
        <header className="mobile-header">
          <button className="brand" onClick={homeNav} aria-label="VipKorner home"><span className="brand-mark">V</span><span>VipKorner</span></button>
          <div className="header-actions"><button className="icon-button" onClick={profileNav} aria-label="Profile"><UserRound /></button><button className="icon-button" onClick={messagesNav} aria-label={unreadMessages ? `Messages, ${unreadMessages} unread` : "Messages"}><Send />{unreadMessages > 0 && <i className="message-badge">{unreadMessages > 99 ? "99+" : unreadMessages}</i>}</button></div>
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
            <StoriesTray stories={stories} profile={profile} onAdd={() => setComposer("story")} onOpen={(story) => { setActiveStoryAuthorId(null); setActiveStoryId(story.id); }} />
            <div className="feed-title"><div><span className="eyebrow">YOUR FEED</span><h1>Good afternoon, {profile.displayName.split(" ")[0]}</h1></div><button onClick={() => setComposer("post")}><Plus size={17} /> New post</button></div>
            <section className="feed" aria-label="Posts">
              {loading ? <FeedSkeleton /> : filteredPosts.length ? filteredPosts.map((post) => <PostCard key={post.id} post={post} profile={profile} onToggle={togglePost} onComment={addComment} onCaptionUpdate={updateCaption} onDelete={deletePost} />) : <EmptyState searched={Boolean(query)} onCreate={() => setComposer("post")} />}
            </section>
          </>
        ) : view === "profile" ? (
          <ProfileView posts={posts} profile={profile} onCounts={updateConnectionCounts} onViewProfile={openMemberProfile} onCreate={() => setComposer("post")} onEdit={() => setProfilePanel("edit")} onSettings={() => setProfilePanel("settings")} onActivity={() => setProfilePanel("activity")} onOpenPost={(post) => setActivePostId(post.id)} />
        ) : view === "member" ? <MemberProfileView member={memberProfile} error={memberProfileError} posts={posts} stories={stories} onBack={exploreNav} onMessage={startMemberConversation} onRefresh={openMemberProfile} onOpenStory={(story) => { setActiveStoryAuthorId(story.userId); setActiveStoryId(story.id); }} onOpenPost={(post) => setActivePostId(post.id)} />
        : view === "explore" ? <ExploreView users={discovery} onRefresh={() => loadDiscovery(query)} onCounts={updateConnectionCounts} onViewProfile={openMemberProfile} onViewSelf={profileNav} onMessage={(conversationId) => { setActiveConversationId(conversationId); setView("messages"); void loadConversations(); }} />
        : <MessagesView key={activeConversationId || "messages"} profile={profile} conversations={conversations} initialConversationId={activeConversationId} onRefresh={loadConversations} />}
      </section>

      <aside className="desktop-profile">
        <div className="mini-profile"><img src={profileImage(profile)} alt={profile.displayName} /><div><strong>{profile.username}</strong><span>{profile.displayName}</span></div><button onClick={view === "profile" ? homeNav : profileNav}>{view === "profile" ? "Home" : "View"}</button></div>
        <div className="daily-note"><span className="note-icon"><Sparkles /></span><p>Keep the moments that feel like you.</p><small>Your social space, on your terms</small></div>
        <footer><button>About</button><span>·</span><button>Privacy</button><span>·</span><button>Help</button><p>© 2026 VIPKORNER</p></footer>
      </aside>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button className={view === "home" ? "active" : ""} onClick={homeNav} aria-label="Home"><Home /></button>
        <button className={view === "explore" ? "active" : ""} onClick={exploreNav} aria-label="Explore"><Search /></button>
        <button className={view === "messages" ? "active" : ""} onClick={messagesNav} aria-label={unreadMessages ? `Messages, ${unreadMessages} unread` : "Messages"}><Mail />{unreadMessages > 0 && <i className="message-badge">{unreadMessages > 99 ? "99+" : unreadMessages}</i>}</button>
        <button className={view === "profile" ? "active" : ""} onClick={profileNav} aria-label="Profile"><img src={profileImage(profile)} alt="" /></button>
      </nav>

      {composer && <Composer type={composer} profile={profile} onClose={() => setComposer(null)} onCreated={(message) => { setComposer(null); setToast(message); loadFeed(); }} />}
      {activeStoryId && <StoryViewer key={activeStoryId} stories={activeStoryAuthorId ? stories.filter((story) => story.userId === activeStoryAuthorId) : stories} activeId={activeStoryId} onChange={setActiveStoryId} onViewed={markStoryViewed} onClose={() => { setActiveStoryId(null); setActiveStoryAuthorId(null); }} onDelete={deleteStory} onReact={reactToStory} />}
      {profilePanel === "edit" && <EditProfileModal profile={profile} onClose={() => setProfilePanel(null)} onSaved={(next) => { setProfile(next); setProfilePanel(null); setToast("Profile updated."); }} />}
      {profilePanel === "settings" && <SettingsModal profile={profile} installPrompt={installPrompt} onInstallGuide={() => { setProfilePanel(null); setInstallGuideOpen(true); }} onClose={() => setProfilePanel(null)} onSaved={(next) => { setProfile(next); setProfilePanel(null); setToast("Settings saved."); }} />}
      {profilePanel === "activity" && <ActivityModal activities={activities} posts={posts} onRefresh={loadFeed} onViewProfile={openMemberProfile} onClose={() => setProfilePanel(null)} />}
      {activePost && <MediaViewer post={activePost} profile={profile} onClose={() => setActivePostId(null)} onCaptionUpdate={updateCaption} onDelete={deletePost} onToggle={togglePost} onComment={addComment} />}
      {installGuideOpen && <InstallGuide onClose={() => setInstallGuideOpen(false)} />}
      {toast && <div className="toast" role="status"><Check size={17} /> {toast}</div>}
    </main>
  );
}

function NavButton({ icon, label, badge = 0, active, onClick }: { icon: React.ReactNode; label: string; badge?: number; active?: boolean; onClick: () => void }) {
  return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick} aria-label={badge ? `${label}, ${badge} unread` : label}>{icon}<span>{label}</span>{badge > 0 && <i className="nav-badge">{badge > 99 ? "99+" : badge}</i>}</button>;
}

function StoriesTray({ stories, profile, onAdd, onOpen }: { stories: Story[]; profile: Profile; onAdd: () => void; onOpen: (story: Story) => void }) {
  const visibleStories = Array.from(
    stories
      .filter((story) => !story.viewed)
      .reduce((byAuthor, story) => {
        if (!byAuthor.has(story.author.id)) byAuthor.set(story.author.id, story);
        return byAuthor;
      }, new Map<string, Story>())
      .values(),
  );
  return (
    <section className="stories-section" aria-label="Stories">
      <div className="stories-heading"><span>Stories</span><small>24h moments</small></div>
      <div className="stories-scroll">
        <button className="story-item add-story" onClick={onAdd}>
          <span className="story-ring"><img src={profileImage(profile)} alt="" /><i><Plus size={14} /></i></span><span>Add story</span>
        </button>
        {visibleStories.map((story, index) => (
          <button className="story-item" key={story.id} onClick={() => onOpen(story)}>
            <span className={`story-ring active-story ${story.viewed ? "viewed" : ""}`}>{story.mediaType === "video" ? <><video src={imageSource(story)} muted playsInline preload="metadata" aria-label={`${story.author.username}'s video story`} /><i className="story-video-badge"><Video /></i></> : <img src={imageSource(story)} alt={`${story.author.username}'s story`} />}</span><span>{story.owned && index === 0 ? "Your story" : story.author.username}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function PostCard({ post, profile, onToggle, onComment, onCaptionUpdate, onDelete }: { post: Post; profile: Profile; onToggle: (id: string, action: "like" | "save") => void; onComment: (postId: string, body: string) => Promise<void>; onCaptionUpdate: (postId: string, caption: string) => Promise<void>; onDelete: (postId: string) => Promise<void> }) {
  const mediaItems = postMediaItems(post);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const activeMedia = mediaItems[activeMediaIndex] || mediaItems[0];
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

  function showMedia(index: number) {
    inlineVideoRef.current?.pause();
    setActiveMediaIndex(index);
    setVideoPlaying(false);
    setVideoMuted(true);
  }

  function toggleVideoPlayback() {
    if (activeMedia.mediaType !== "video" || !inlineVideoRef.current) return;
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
      <div className={`post-image-wrap ${activeMedia.mediaType === "video" ? "has-video" : ""}`} onClick={toggleVideoPlayback} onDoubleClick={() => activeMedia.mediaType === "image" && !post.liked && onToggle(post.id, "like")} onKeyDown={(event) => { if (activeMedia.mediaType === "video" && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); toggleVideoPlayback(); } }} tabIndex={activeMedia.mediaType === "video" ? 0 : undefined} role={activeMedia.mediaType === "video" ? "button" : undefined} aria-label={activeMedia.mediaType === "video" ? `${videoPlaying ? "Pause" : "Play"} video: ${activeMedia.caption || post.caption}` : undefined}>
        {activeMedia.mediaType === "video" ? <><video key={activeMedia.id} ref={inlineVideoRef} className="post-image post-video" src={imageSource(activeMedia)} muted={videoMuted} playsInline preload="metadata" aria-label={activeMedia.caption || post.caption} onPlay={() => setVideoPlaying(true)} onPause={() => setVideoPlaying(false)} onEnded={() => setVideoPlaying(false)} />{!videoPlaying && <span className="post-play-indicator" aria-hidden="true"><Play fill="currentColor" /></span>}<button type="button" className="post-audio-toggle" onClick={toggleVideoSound} aria-label={videoMuted ? "Unmute video" : "Mute video"}>{videoMuted ? <VolumeX /> : <Volume2 />}</button></> : <img className="post-image" src={imageSource(activeMedia)} alt={activeMedia.caption || post.caption} />}
        {mediaItems.length > 1 && <><button type="button" className="carousel-arrow carousel-previous" onClick={(event) => { event.stopPropagation(); showMedia((activeMediaIndex - 1 + mediaItems.length) % mediaItems.length); }} aria-label="Previous carousel item"><ChevronLeft /></button><button type="button" className="carousel-arrow carousel-next" onClick={(event) => { event.stopPropagation(); showMedia((activeMediaIndex + 1) % mediaItems.length); }} aria-label="Next carousel item"><ChevronRight /></button><span className="carousel-count">{activeMediaIndex + 1}/{mediaItems.length}</span></>}
      </div>
      {mediaItems.length > 1 && <div className="carousel-dots" aria-label={`Carousel item ${activeMediaIndex + 1} of ${mediaItems.length}`}>{mediaItems.map((item, index) => <button type="button" key={item.id} className={index === activeMediaIndex ? "active" : ""} onClick={() => showMedia(index)} aria-label={`Show item ${index + 1}`} />)}</div>}
      <div className="post-actions"><div><button className={`icon-button ${post.liked ? "liked" : ""}`} onClick={() => onToggle(post.id, "like")} aria-label={post.liked ? "Unlike" : "Like"}><Heart fill={post.liked ? "currentColor" : "none"} /></button><button className="icon-button" onClick={() => setCommentOpen((open) => !open)} aria-label="Comment"><MessageCircle /></button><button className="icon-button" onClick={() => navigator.share?.({ title: "VipKorner", text: post.caption, url: location.href })} aria-label="Share"><Send /></button></div><button className={`icon-button ${post.saved ? "saved" : ""}`} onClick={() => onToggle(post.id, "save")} aria-label={post.saved ? "Unsave" : "Save"}><Bookmark fill={post.saved ? "currentColor" : "none"} /></button></div>
      <div className="post-copy"><strong>{post.likes.toLocaleString()} likes</strong>{editingCaption ? <form className="caption-editor" onSubmit={saveCaption}><textarea autoFocus value={captionDraft} onChange={(event) => setCaptionDraft(event.target.value.slice(0, 500))} rows={2} /><div><button type="button" onClick={() => setEditingCaption(false)}>Cancel</button><button>Save</button></div></form> : <p><b>{post.author.username}</b> {post.caption}</p>}{activeMedia.caption && <p className="post-item-caption"><b>Item {activeMediaIndex + 1}</b> {activeMedia.caption}</p>}{post.comments?.length > 0 && <div className="post-comments">{post.comments.slice(-2).map((item) => <div className="comment-item" key={item.id}><img src={profileImage(item.author)} alt="" /><p><b>{item.author.username}</b> {item.body}</p></div>)}{post.comments.length > 2 && <small>View all {post.comments.length} comments</small>}</div>}<time>{relativeTime(post.createdAt)}</time>{actionError && <span className="inline-error">{actionError}</span>}</div>
      {commentOpen && <form className="comment-row" onSubmit={submitComment}><img src={profileImage(profile)} alt="" /><input autoFocus value={comment} onChange={(event) => setComment(event.target.value.slice(0, 280))} placeholder="Add a comment…" aria-label="Comment" /><button disabled={!comment.trim() || commentBusy}>{commentBusy ? "Posting…" : "Post"}</button></form>}
    </article>
  );
}

function Composer({ type, profile, onClose, onCreated }: { type: "post" | "story"; profile: Profile; onClose: () => void; onCreated: (message: string) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [itemCaptions, setItemCaptions] = useState<string[]>([]);
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
  const previews = useMemo(() => files.map((item) => URL.createObjectURL(item)), [files]);
  const file = files[selectedIndex] || null;
  const preview = previews[selectedIndex] || "";

  useEffect(() => () => { previews.forEach((item) => URL.revokeObjectURL(item)); }, [previews]);

  function selectFiles(nextFiles: File[]) {
    if (!nextFiles.length) return;
    const incoming = type === "story" ? nextFiles.slice(0, 1) : nextFiles.slice(0, 10 - files.length);
    for (const nextFile of incoming) {
      const validVideo = isVideoFile(nextFile);
      const validImage = !validVideo && (nextFile.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(nextFile.name));
      if (!validImage && !validVideo) { setError("Choose only supported photo or video files."); return; }
      if (validImage && nextFile.size > 10 * 1024 * 1024) { setError(`${nextFile.name} is larger than 10 MB.`); return; }
      if (validVideo && nextFile.size > 50 * 1024 * 1024) { setError(`${nextFile.name} is larger than 50 MB.`); return; }
    }
    const next = type === "story" ? incoming : [...files, ...incoming];
    setFiles(next);
    setItemCaptions((current) => type === "story" ? [current[0] || ""] : [...current, ...incoming.map(() => "")]);
    setSelectedIndex(type === "story" ? 0 : Math.max(0, next.length - incoming.length));
    setError(nextFiles.length > incoming.length ? "A post can contain up to 10 items." : "");
    setDragActive(false);
  }

  function handleDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragActive(false);
    selectFiles(Array.from(event.dataTransfer.files || []));
  }

  function removeSelectedFile() {
    setFiles((current) => current.filter((_, index) => index !== selectedIndex));
    setItemCaptions((current) => current.filter((_, index) => index !== selectedIndex));
    setSelectedIndex((current) => Math.max(0, current - 1));
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
    if (!files.length) { setError("Choose a photo or video first."); return; }
    setBusy(true); setError("");
    try {
      if (type === "story") {
        await uploadMediaInParts(files[0], type, caption, setUploadProgress, captionPosition);
      } else {
        const postId = crypto.randomUUID();
        try {
          for (let index = 0; index < files.length; index += 1) {
            await uploadMediaInParts(files[index], "post", caption, (value) => setUploadProgress(Math.round(((index + value / 100) / files.length) * 100)), undefined, { postId, position: index, itemCaption: itemCaptions[index] || "" });
          }
        } catch (reason) {
          await fetch(`/api/posts?id=${encodeURIComponent(postId)}`, { method: "DELETE" }).catch(() => undefined);
          throw reason;
        }
      }
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
        <header><button type="button" className="icon-button composer-close" onClick={onClose} aria-label="Close"><X /></button><div><span>CREATE</span><h2>New {type}</h2></div><button className="share-button" disabled={!files.length || busy}>{busy ? `Uploading ${uploadProgress}%` : "Share"}</button></header>
        <input ref={inputRef} className="file-input" type="file" multiple={type === "post"} accept="image/*,.jpg,.jpeg,.png,.webp,.gif" onChange={(event) => { selectFiles(Array.from(event.target.files || [])); event.target.value = ""; }} />
        <input ref={videoInputRef} className="file-input" type="file" multiple={type === "post"} accept="video/*,.mp4,.webm,.mov,.m4v" onChange={(event) => { selectFiles(Array.from(event.target.files || [])); event.target.value = ""; }} />
        {preview ? (
          <><div ref={previewRef} className={`preview-frame ${type} ${dragActive ? "drag-active" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={handleDrop}>{file && isVideoFile(file) ? <video src={preview} autoPlay loop muted playsInline aria-label={`Selected video ${selectedIndex + 1} of ${files.length}`} /> : <img src={preview} alt={`Selected item ${selectedIndex + 1} of ${files.length}`} />}{type === "story" && caption.trim() && <p className={`story-caption-preview ${captionDragging ? "dragging" : ""}`} style={{ left: `${captionPosition.x}%`, top: `${captionPosition.y}%` }} onPointerDown={updateCaptionPosition} onPointerMove={updateCaptionPosition} onPointerUp={(event) => { event.currentTarget.releasePointerCapture(event.pointerId); setCaptionDragging(false); }} onPointerCancel={() => setCaptionDragging(false)}>{caption}</p>}{type === "post" && files.length > 1 && <><button type="button" className="carousel-arrow carousel-previous" onClick={() => setSelectedIndex((index) => (index - 1 + files.length) % files.length)} aria-label="Previous selected item"><ChevronLeft /></button><button type="button" className="carousel-arrow carousel-next" onClick={() => setSelectedIndex((index) => (index + 1) % files.length)} aria-label="Next selected item"><ChevronRight /></button><span className="carousel-count">{selectedIndex + 1}/{files.length}</span></>}<div className="preview-actions"><button type="button" onClick={() => file && isVideoFile(file) ? videoInputRef.current?.click() : inputRef.current?.click()}>{type === "post" ? "Add media" : `Change ${file && isVideoFile(file) ? "video" : "photo"}`}</button>{type === "post" && <button type="button" className="preview-remove" onClick={removeSelectedFile}><Trash2 /> Remove</button>}</div></div>{type === "post" && <div className="composer-media-strip" aria-label={`${files.length} selected media items`}>{files.map((item, index) => <button type="button" key={`${item.name}-${item.lastModified}-${index}`} className={selectedIndex === index ? "active" : ""} onClick={() => setSelectedIndex(index)}>{isVideoFile(item) ? <video src={previews[index]} muted playsInline /> : <img src={previews[index]} alt="" />}<span>{index + 1}</span></button>)}</div>}</>
        ) : (
          <div className={`upload-drop ${type} ${dragActive ? "drag-active" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={handleDrop}><span><Video /></span><h3>{dragActive ? "Drop it here" : `Choose or drop ${type === "post" ? "up to 10 photos or videos" : "a photo or video"}`}</h3><p>Photos up to 10 MB each · MP4, WebM, MOV or M4V up to 50 MB each</p><div className="upload-choices"><button type="button" onClick={() => inputRef.current?.click()}>Choose photo{type === "post" ? "s" : ""}</button><button type="button" onClick={() => videoInputRef.current?.click()}>Choose video{type === "post" ? "s" : ""}</button></div></div>
        )}
        <div className={`caption-field ${type === "story" ? "story-caption-field" : ""}`}><img src={profileImage(profile)} alt={profile.displayName} /><textarea value={caption} onChange={(event) => setCaption(event.target.value.slice(0, type === "story" ? 280 : 500))} onKeyDown={(event) => { if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return; event.preventDefault(); if (!files.length) { setError("Choose a photo or video first."); return; } if (!busy) event.currentTarget.form?.requestSubmit(); }} placeholder={type === "story" ? "Add a story caption…" : "Write a post caption…"} rows={type === "story" ? 2 : 3} /><small>{caption.length}/{type === "story" ? 280 : 500}</small></div>
        {type === "post" && file && <label className="item-caption-field"><span>Caption for item {selectedIndex + 1} <i>Optional</i></span><textarea value={itemCaptions[selectedIndex] || ""} onChange={(event) => setItemCaptions((current) => current.map((value, index) => index === selectedIndex ? event.target.value.slice(0, 280) : value))} placeholder="Add context for this photo or video…" rows={2} /><small>{(itemCaptions[selectedIndex] || "").length}/280</small></label>}
        {type === "story" && caption.trim() && <div className="story-caption-tools"><div><strong>Caption position</strong><span>Drag the caption on the preview, or choose a preset.</span></div><div><button type="button" onClick={() => setCaptionPosition({ x: 50, y: 22 })}>Top</button><button type="button" onClick={() => setCaptionPosition({ x: 50, y: 52 })}>Middle</button><button type="button" onClick={() => setCaptionPosition({ x: 50, y: 82 })}>Bottom</button></div></div>}
        {type === "story" && <div className="expiry-note"><span>24h</span><p><strong>Made for the moment.</strong>Your story will disappear automatically after 24 hours.</p></div>}
        {error && <p className="form-error">{error}</p>}
      </form>
    </div>
  );
}

function StoryViewer({ stories, activeId, onChange, onViewed, onClose, onDelete, onReact }: { stories: Story[]; activeId: string; onChange: (id: string) => void; onViewed: (id: string) => void; onClose: () => void; onDelete: (id: string) => Promise<void>; onReact: (id: string, emoji: string) => Promise<void> }) {
  const story = stories.find((item) => item.id === activeId);
  const currentIndex = stories.findIndex((item) => item.id === activeId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [error, setError] = useState("");
  const [reactionBusy, setReactionBusy] = useState(false);
  const [reactionError, setReactionError] = useState("");
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

  async function react(emoji: string) {
    setReactionBusy(true);
    setReactionError("");
    try {
      await onReact(story!.id, emoji);
    } catch (reason) {
      setReactionError(reason instanceof Error ? reason.message : "Could not react to this story.");
    } finally {
      setReactionBusy(false);
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
        <footer>{story.caption && <p style={{ left: `${story.captionX}%`, top: `${story.captionY}%` }}>{story.caption}</p>}{!story.owned && Boolean(story.reactionsAllowed) && <div className="story-reactions" aria-label="React to story">{STORY_REACTION_EMOJIS.map((emoji) => <button type="button" key={emoji} className={story.reaction === emoji ? "active" : ""} disabled={reactionBusy} aria-label={`React ${emoji}`} aria-pressed={story.reaction === emoji} onClick={() => void react(emoji)}>{emoji}</button>)}</div>}{reactionError && <span className="story-reaction-error" role="alert">{reactionError}</span>}<span>Story expires automatically within 24 hours{story.reactionCount > 0 ? ` · ${story.reactionCount} reaction${story.reactionCount === 1 ? "" : "s"}` : ""}</span></footer>
        {confirmDelete && <div className="story-delete-confirm"><strong>Delete this story?</strong><p>This removes it immediately instead of waiting for it to expire.</p>{error && <span>{error}</span>}<div><button onClick={() => setConfirmDelete(false)}>Cancel</button><button onClick={removeStory} disabled={deleteBusy}>{deleteBusy ? "Deleting…" : "Delete"}</button></div></div>}
      </div>
    </div>
  );
}

function FollowSuccessFeedback({ username }: { username: string }) {
  return <div className="follow-feedback" role="status" aria-live="polite"><div className="follow-success-mark" aria-hidden="true"><UserPlus /><i /><i /><i /></div><strong>Now following @{username}</strong></div>;
}

function MemberProfileView({ member, error, posts, stories, onBack, onMessage, onRefresh, onOpenStory, onOpenPost }: { member: MemberProfile | null; error: string; posts: Post[]; stories: Story[]; onBack: () => void; onMessage: (userId: string) => Promise<void>; onRefresh: (userId: string) => Promise<void>; onOpenStory: (story: Story) => void; onOpenPost: (post: Post) => void }) {
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [followFeedback, setFollowFeedback] = useState("");
  useEffect(() => {
    if (!followFeedback) return;
    const timeout = window.setTimeout(() => setFollowFeedback(""), 1600);
    return () => window.clearTimeout(timeout);
  }, [followFeedback]);
  if (error) return <section className="member-profile-state"><span><UserRound /></span><h1>Profile unavailable</h1><p>{error}</p><button onClick={onBack}>Back to Explore</button></section>;
  if (!member) return <section className="member-profile-state" role="status"><span><UserRound /></span><h1>Loading profile…</h1></section>;
  const privateAndLocked = !Boolean(member.isPublic) && !Boolean(member.following);
  const visiblePosts = privateAndLocked ? [] : posts.filter((post) => post.userId === member.id);
  const memberStories = privateAndLocked ? [] : stories.filter((story) => story.userId === member.id);
  const unseenStories = memberStories.filter((story) => !story.viewed);
  const requestPending = member.followRequestStatus === "pending";
  const heroImage = member.heroImageKey || member.heroImageUrl
    ? imageSource({ imageKey: member.heroImageKey ?? null, imageUrl: member.heroImageUrl ?? null })
    : profileImage(member);
  async function toggleFollow() {
    setRequestBusy(true); setRequestError("");
    const showFollowFeedback = Boolean(member!.isPublic) && !Boolean(member!.following);
    if (showFollowFeedback) setFollowFeedback(member!.username);
    try {
      const response = await fetch("/api/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "follow", targetId: member!.id }) });
      const result = await readApiResponse<{ following?: boolean; requested?: boolean }>(response, requestPending ? "Could not cancel this follow request." : "Could not update this follow.");
      if (result.following) setFollowFeedback(member!.username);
      await onRefresh(member!.id);
    } catch (reason) { if (showFollowFeedback) setFollowFeedback(""); setRequestError(reason instanceof Error ? reason.message : "Could not update this follow."); }
    finally { setRequestBusy(false); }
  }
  return <section className="profile-page member-profile-page">
    <button className="member-back" onClick={onBack}><ChevronLeft /> Explore</button>
    <header className="profile-hero member-profile-hero">
      <div className="member-profile-banner" aria-hidden="true"><img src={heroImage} alt="" /><i /></div>
      <div className="member-profile-hero-content"><button type="button" className={`member-profile-photo-button ${unseenStories.length ? "has-unseen-story" : ""}`} disabled={!memberStories.length} onClick={() => onOpenStory(unseenStories[0] || memberStories[0])} aria-label={memberStories.length ? `View @${member.username}'s stories` : `@${member.username} has no active stories`}><img className="member-profile-photo" src={profileImage(member)} alt={member.displayName} /></button><div className="profile-info"><div><h1>{member.username}</h1><button type="button" className="icon-button member-message-button" onClick={() => void onMessage(member.id)} aria-label={`Message @${member.username}`}><Mail /></button>{!privateAndLocked && <button type="button" className={`member-follow-button ${member.following ? "following" : ""}`} disabled={requestBusy} onClick={() => void toggleFollow()}>{requestBusy ? "Updating…" : member.following ? <><Check /> Following</> : <><UserPlus /> Follow</>}</button>}</div><div className="profile-stats"><span><strong>{member.posts}</strong> posts</span><span><strong>{member.followers}</strong> followers</span><span><strong>{member.followingCount}</strong> following</span></div><p><strong>{member.displayName}</strong><br />{member.bio || "New to VipKorner."}</p><span className="member-location"><MapPin /> {member.location || "Location not shared"}</span>{member.website && <a href={`https://${member.website.replace(/^https?:\/\//, "")}`}>{member.website}</a>}</div></div>
    </header>
    {privateAndLocked && <div className="member-follow-request"><div><strong>Private profile</strong><span>Only approved followers can see this member’s posts and stories.</span></div><button type="button" className={requestPending ? "requested" : ""} disabled={requestBusy} onClick={() => void toggleFollow()}>{requestBusy ? "Updating…" : requestPending ? "Request sent · Cancel" : "Request to Follow"}</button>{requestError && <p role="alert">{requestError}</p>}</div>}
    {!privateAndLocked && requestError && <p className="member-follow-error" role="alert">{requestError}</p>}
    {visiblePosts.length ? <div className="profile-grid">{visiblePosts.map((post) => <button key={post.id} onClick={() => onOpenPost(post)} aria-label={`Open ${post.mediaType}: ${post.caption}`}>{post.mediaType === "video" ? <><video src={imageSource(post)} muted playsInline preload="metadata" aria-label={post.caption} /><i className="video-badge"><Video /></i></> : <img src={imageSource(post)} alt={post.caption} />}<span><Heart fill="currentColor" size={17} /> {post.likes}</span></button>)}</div> : <div className="saved-empty"><span><ImagePlus /></span><h3>No posts to show</h3><p>{member.isPublic || member.following ? "This member hasn’t shared a post yet." : "This member’s posts are private."}</p></div>}
    {followFeedback && <FollowSuccessFeedback username={followFeedback} />}
  </section>;
}

function ExploreView({ users, onRefresh, onCounts, onMessage, onViewProfile, onViewSelf }: { users: DiscoveryUser[]; onRefresh: () => Promise<void>; onCounts: (counts: ConnectionCounts) => void; onMessage: (conversationId: string) => void; onViewProfile: (userId: string) => void; onViewSelf: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [followFeedback, setFollowFeedback] = useState<string | null>(null);
  const [blockTarget, setBlockTarget] = useState<DiscoveryUser | null>(null);
  useEffect(() => {
    if (!followFeedback) return;
    const timeout = window.setTimeout(() => setFollowFeedback(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [followFeedback]);
  async function action(user: DiscoveryUser, name: "follow" | "block" | "message" | "report", blockConfirmed = false) {
    if (name === "block" && !user.blocked && !blockConfirmed) { setBlockTarget(user); return; }
    setBusyId(user.id); setNotice("");
    const showFollowFeedback = name === "follow" && Boolean(user.isPublic) && !Boolean(user.following);
    if (showFollowFeedback) setFollowFeedback(user.username);
    try {
      if (name === "message") {
        const response = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", targetId: user.id }) });
        const data = await readApiResponse<{ id: string }>(response, "Could not start a conversation.");
        onMessage(data.id); return;
      }
      let reason = "";
      if (name === "report") { reason = window.prompt(`Why are you reporting @${user.username}?`) || ""; if (!reason) return; }
      const response = await fetch("/api/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, targetId: user.id, targetType: "profile", reason }) });
      const result = await readApiResponse<{ counts?: ConnectionCounts; following?: boolean; requested?: boolean }>(response, "Could not update this profile.");
      if (result.counts) onCounts(result.counts);
      if (name === "report") setNotice("Report sent to the administrator.");
      else if (name === "follow" && result.following) setFollowFeedback(user.username);
      else if (name === "follow" && result.requested) setNotice(`Follow request sent to @${user.username}.`);
      await onRefresh();
    } catch (reason) { if (showFollowFeedback) setFollowFeedback(null); setNotice(reason instanceof Error ? reason.message : "Could not complete this action."); }
    finally { setBusyId(null); }
  }
  return <><section className="explore-page"><div className="section-heading"><span className="eyebrow">DISCOVER</span><h1>Find your people</h1><p>Profiles from the VipKorner community.</p></div>{notice && <p className="panel-notice">{notice}</p>}{followFeedback && <FollowSuccessFeedback username={followFeedback} />}<div className="people-grid">{users.length ? users.map((user) => { const requestPending = user.followRequestStatus === "pending"; return <article className="person-card" key={user.id}><button className="person-avatar-button" onClick={user.isSelf ? onViewSelf : () => onViewProfile(user.id)} aria-label={`View @${user.username}'s profile`}><img src={profileImage(user)} alt="" /></button><button className="person-identity" onClick={user.isSelf ? onViewSelf : () => onViewProfile(user.id)}><h2>{user.displayName}</h2><strong>@{user.username}</strong><p>{user.bio || "New to VipKorner."}</p><small>{user.posts} posts · {user.followers} followers{user.isSelf ? " · This is you" : user.followsYou ? " · Follows you" : !user.isPublic ? " · Private" : ""}</small></button><div className="person-actions">{user.isSelf ? <button className="primary" onClick={onViewSelf}><UserRound /> View your profile</button> : <><button className={user.following || requestPending ? "following" : "primary"} disabled={busyId === user.id || Boolean(user.blocked)} onClick={() => action(user, "follow")}>{user.following ? "Following" : requestPending ? "Requested" : <><UserPlus /> {user.isPublic ? "Follow" : "Request"}</>}</button><button disabled={busyId === user.id || Boolean(user.blocked)} onClick={() => action(user, "message")}><Mail /> Message</button><button className={user.blocked ? "danger" : ""} disabled={busyId === user.id} onClick={() => action(user, "block")}><Ban /> {user.blocked ? "Unblock" : "Block"}</button><button disabled={busyId === user.id} onClick={() => action(user, "report")}><Flag /> Report</button></>}</div></article>; }) : <div className="empty-state"><span><Compass /></span><h2>No profiles found</h2><p>Try a different name or username.</p></div>}</div></section>{blockTarget && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="block-confirm-title" onMouseDown={(event) => event.target === event.currentTarget && setBlockTarget(null)}><section className="profile-modal block-confirm-modal"><span className="brand-mark" aria-hidden="true">V</span><h2 id="block-confirm-title">Block @{blockTarget.username}?</h2><p>Following relationships will be removed, and you won’t see or message each other.</p><div><button type="button" onClick={() => setBlockTarget(null)}>Cancel</button><button type="button" className="danger" disabled={busyId === blockTarget.id} onClick={() => { const target = blockTarget; setBlockTarget(null); void action(target, "block", true); }}>Block</button></div></section></div>}</>;
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
    fetch(`/api/messages?conversationId=${encodeURIComponent(activeId)}`).then((response) => readApiResponse<{ messages: DirectMessage[] }>(response, "Could not load this conversation.")).then(async (data) => { setMessages(data.messages); await onRefresh(); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load messages."));
  }, [activeId, onRefresh]);
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
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Install VipKorner" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="profile-modal install-guide"><ModalHeader eyebrow="PWA" title="Install VipKorner" onClose={onClose} /><div className="settings-intro"><span><Download /></span><div><strong>Use VipKorner like an app</strong><p>Installation keeps it one tap away and enables a full-screen app experience.</p></div></div><ol><li><strong>iPhone or iPad</strong><span>Open this site in Safari, tap Share, then choose “Add to Home Screen.”</span></li><li><strong>Android</strong><span>Open the browser menu and choose “Install app” or “Add to Home screen.”</span></li><li><strong>Desktop</strong><span>Use the install icon in the address bar, or open the browser menu and choose “Install VipKorner.”</span></li></ol><p className="install-note">If an install option is missing, open VipKorner in Safari or Chrome first.</p></section></div>;
}

function ProfileView({ posts, profile, onCounts, onViewProfile, onCreate, onEdit, onSettings, onActivity, onOpenPost }: { posts: Post[]; profile: Profile; onCounts: (counts: ConnectionCounts) => void; onViewProfile: (userId: string) => void; onCreate: () => void; onEdit: () => void; onSettings: () => void; onActivity: () => void; onOpenPost: (post: Post) => void }) {
  const [tab, setTab] = useState<"posts" | "saved">("posts");
  const [connections, setConnections] = useState<"followers" | "following" | null>(null);
  const ownPosts = posts.filter((post) => post.owned);
  const visiblePosts = tab === "saved" ? posts.filter((post) => Boolean(post.saved)) : ownPosts;
  return (
    <>
    <section className="profile-page">
      <header className="profile-hero"><button className="profile-photo-button" onClick={onEdit} aria-label="Update profile photo"><img src={profileImage(profile)} alt={profile.displayName} /><span><ImagePlus /></span></button><div className="profile-info"><div><h1>{profile.username}</h1><button onClick={onEdit}>Edit profile</button><button className="icon-button profile-settings" onClick={onSettings} aria-label="Profile settings"><Settings /></button></div><div className="profile-stats"><span><strong>{ownPosts.length}</strong> posts</span><button onClick={() => setConnections("followers")} aria-label={`View ${profile.followers} followers`}><strong>{profile.followers}</strong> followers</button><button onClick={() => setConnections("following")} aria-label={`View ${profile.following} following`}><strong>{profile.following}</strong> following</button></div><p><strong>{profile.displayName}</strong><br />{profile.bio}<br />{profile.website && <a href={`https://${profile.website.replace(/^https?:\/\//, "")}`}>{profile.website}</a>}</p></div></header>
      <div className="profile-actions" aria-label="Profile actions"><button onClick={onActivity}><Bell /><span><strong>Activity</strong><small>See your latest updates</small></span></button><button onClick={onCreate}><Plus /><span><strong>Create</strong><small>Share a new post</small></span></button></div>
      <div className="profile-tabs" role="tablist" aria-label="Profile posts"><button className={tab === "posts" ? "active" : ""} role="tab" aria-selected={tab === "posts"} onClick={() => setTab("posts")}><ImagePlus size={15} /> POSTS</button><button className={tab === "saved" ? "active" : ""} role="tab" aria-selected={tab === "saved"} onClick={() => setTab("saved")}><Bookmark size={15} /> SAVED</button></div>
      {visiblePosts.length ? <div className="profile-grid">{visiblePosts.map((post) => <button key={post.id} onClick={() => onOpenPost(post)} aria-label={`Open ${post.mediaType}: ${post.caption}`}>{post.mediaType === "video" ? <><video src={imageSource(post)} muted playsInline preload="metadata" aria-label={post.caption} /><i className="video-badge"><Video /></i></> : <img src={imageSource(post)} alt={post.caption} />}<span><Heart fill="currentColor" size={17} /> {post.likes}</span></button>)}{tab === "posts" && <button className="grid-add" onClick={onCreate}><Plus /><span>Add a post</span></button>}</div> : <div className="saved-empty"><span><Bookmark /></span><h3>No saved posts yet</h3><p>Tap the bookmark on a post and it will appear here.</p></div>}
    </section>
    {connections && <ConnectionListModal kind={connections} total={connections === "followers" ? profile.followers : profile.following} onCounts={onCounts} onViewProfile={onViewProfile} onClose={() => setConnections(null)} />}
    </>
  );
}

function ConnectionListModal({ kind, total, onCounts, onViewProfile, onClose }: { kind: "followers" | "following"; total: number; onCounts: (counts: ConnectionCounts) => void; onViewProfile: (userId: string) => void; onClose: () => void }) {
  const [people, setPeople] = useState<ConnectionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch(`/api/social?list=${kind}`).then((response) => readApiResponse<{ connections: ConnectionUser[]; counts: ConnectionCounts }>(response, "Could not load this list."))
      .then((data) => { if (!active) return; setPeople(data.connections || []); onCounts(data.counts); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load this list."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind, total, onCounts]);
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={kind === "followers" ? "Your followers" : "People you follow"} onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="profile-modal connections-modal"><ModalHeader eyebrow="YOUR PROFILE" title={kind === "followers" ? `Followers · ${total}` : `Following · ${total}`} onClose={onClose} /><div className="connection-list">{loading ? <p className="connection-status">Loading…</p> : error ? <p className="inline-error">{error}</p> : people.length ? people.map((person) => <button className="connection-person" key={person.id} onClick={() => { onClose(); onViewProfile(person.id); }} aria-label={`View @${person.username}'s profile`}><img src={profileImage(person)} alt="" /><span><strong>{person.displayName}</strong><i>@{person.username}</i>{person.bio && <p>{person.bio}</p>}</span></button>) : <p className="connection-status">{kind === "followers" ? "No followers yet." : "You aren’t following anyone yet."}</p>}</div></section></div>;
}

function MediaViewer({ post, profile, onClose, onCaptionUpdate, onDelete, onToggle, onComment }: { post: Post; profile: Profile; onClose: () => void; onCaptionUpdate: (postId: string, caption: string) => Promise<void>; onDelete: (postId: string) => Promise<void>; onToggle: (id: string, action: "like" | "save") => Promise<void>; onComment: (postId: string, body: string) => Promise<void> }) {
  const mediaItems = postMediaItems(post);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const activeMedia = mediaItems[activeMediaIndex] || mediaItems[0];
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

  function showMedia(index: number) {
    videoRef.current?.pause();
    setActiveMediaIndex(index);
    setFitMode("fit");
    setZoom(1);
    setVideoMuted(true);
  }

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
      <section className={`media-viewer-card ${activeMedia.mediaType === "video" ? "video-viewer-card" : "image-viewer-card"}`}>
        <div className={`media-viewer-stage ${fitMode === "fill" ? "viewer-fill" : "viewer-fit"}`}>{activeMedia.mediaType === "video" ? <><video ref={videoRef} key={activeMedia.id} src={imageSource(activeMedia)} autoPlay muted={videoMuted} controls playsInline preload="auto" onCanPlay={(event) => event.currentTarget.play().catch(() => undefined)} /><button type="button" className="media-audio-toggle" onClick={toggleViewerSound} aria-label={videoMuted ? "Unmute video" : "Mute video"}>{videoMuted ? <VolumeX /> : <Volume2 />}</button></> : <><img key={activeMedia.id} src={imageSource(activeMedia)} alt={activeMedia.caption || post.caption} style={{ transform: `scale(${zoom})` }} /><div className="viewer-media-controls" aria-label="Image display controls"><button type="button" className={fitMode === "fit" ? "active" : ""} aria-pressed={fitMode === "fit"} onClick={() => { setFitMode("fit"); setZoom(1); }}>Fit</button><button type="button" className={fitMode === "fill" ? "active" : ""} aria-pressed={fitMode === "fill"} onClick={() => { setFitMode("fill"); setZoom(1); }}>Fill</button><button type="button" onClick={() => setZoom((value) => Math.min(3, value + .25))} aria-label="Zoom in">+</button><button type="button" onClick={() => setZoom((value) => Math.max(1, value - .25))} aria-label="Zoom out">−</button><button type="button" onClick={() => { setFitMode("fit"); setZoom(1); }}>Reset</button></div></>}{mediaItems.length > 1 && <><button type="button" className="carousel-arrow carousel-previous" onClick={() => showMedia((activeMediaIndex - 1 + mediaItems.length) % mediaItems.length)} aria-label="Previous carousel item"><ChevronLeft /></button><button type="button" className="carousel-arrow carousel-next" onClick={() => showMedia((activeMediaIndex + 1) % mediaItems.length)} aria-label="Next carousel item"><ChevronRight /></button><span className="carousel-count">{activeMediaIndex + 1}/{mediaItems.length}</span></>}</div>
        <aside className="media-viewer-details">
          <header><img src={profileImage(post.author)} alt="" /><div><strong>{post.author.username}</strong><span>{post.author.location}</span></div></header>
          {editing ? <form className="viewer-caption-form" onSubmit={saveCaption}><label htmlFor="viewer-caption">Edit caption</label><textarea id="viewer-caption" autoFocus value={caption} onChange={(event) => setCaption(event.target.value.slice(0, 500))} rows={6} /><small>{caption.length}/500</small><div><button type="button" onClick={() => { setCaption(post.caption); setEditing(false); }}>Cancel</button><button disabled={busy || !caption.trim()}>{busy ? "Saving…" : "Save caption"}</button></div></form> : <div className="viewer-caption"><p><b>{post.author.username}</b> {post.caption}</p>{activeMedia.caption && <p className="post-item-caption"><b>Item {activeMediaIndex + 1}</b> {activeMedia.caption}</p>}<time>{relativeTime(post.createdAt)}</time>{commentOpen && <div className="viewer-comments">{post.comments.length ? post.comments.map((item) => <div className="comment-item" key={item.id}><img src={profileImage(item.author)} alt="" /><p><b>{item.author.username}</b> {item.body}</p></div>) : <p className="viewer-comments-empty">Be the first to comment.</p>}<form onSubmit={submitViewerComment}><img src={profileImage(profile)} alt="" /><input ref={commentInputRef} value={comment} onChange={(event) => setComment(event.target.value.slice(0, 280))} placeholder="Add a comment…" aria-label="Add a comment" /><button disabled={!comment.trim() || commentBusy}>{commentBusy ? "Posting…" : "Post"}</button></form></div>}</div>}
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
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const photoPreview = useMemo(() => photoFile ? URL.createObjectURL(photoFile) : profileImage(profile), [photoFile, profile]);
  const heroPreview = useMemo(() => heroFile ? URL.createObjectURL(heroFile) : profile.heroImageKey || profile.heroImageUrl ? imageSource({ imageKey: profile.heroImageKey, imageUrl: profile.heroImageUrl }) : "", [heroFile, profile]);

  useEffect(() => () => { if (photoFile && photoPreview) URL.revokeObjectURL(photoPreview); }, [photoFile, photoPreview]);
  useEffect(() => () => { if (heroFile && heroPreview) URL.revokeObjectURL(heroPreview); }, [heroFile, heroPreview]);

  const update = (key: keyof Profile, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  function selectProfilePhoto(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.type === "image/gif") { setError("Choose a JPG, PNG or WebP profile photo."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Profile photos must be under 10 MB."); return; }
    setPhotoFile(file); setCropZoom(1); setCropX(50); setCropY(50); setError("");
  }

  function selectHeroImage(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.type === "image/gif") { setError("Choose a JPG, PNG or WebP background image."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Profile background images must be under 10 MB."); return; }
    setHeroFile(file); setError("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      if (photoFile) {
        const croppedPhoto = await cropProfileImage(photoFile, cropZoom, cropX, cropY);
        await uploadMediaInParts(croppedPhoto, "profile", "", setUploadProgress);
      }
      if (heroFile) await uploadMediaInParts(heroFile, "profile-hero", "", setUploadProgress);
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
        <div className="profile-hero-row"><input ref={heroInputRef} className="file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectHeroImage(event.target.files?.[0] || null)} /><div className="profile-hero-preview">{heroPreview ? <img src={heroPreview} alt="Profile background preview" /> : <span><ImagePlus /> Add a profile background</span>}</div><div><strong>Profile background</strong><span>Landscape JPG, PNG or WebP · up to 10 MB</span></div><button type="button" onClick={() => heroInputRef.current?.click()}>{heroPreview ? "Change background" : "Choose background"}</button></div>
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
          <div className="settings-intro"><span><SlidersHorizontal /></span><div><strong>Make VipKorner yours</strong><p>Choose how your profile and uploads behave.</p></div></div>
          <div className="settings-list">
            <SettingRow title="Private account" description="Only approved followers can see your posts and stories." checked={Boolean(draft.privateAccount)} onChange={() => toggle("privateAccount")} />
            <SettingRow title="Story replies" description="Allow quick replies while viewing stories." checked={Boolean(draft.storyReplies)} onChange={() => toggle("storyReplies")} />
            <SettingRow title="High-quality uploads" description="Keep original detail in photos and videos." checked={Boolean(draft.highQualityUploads)} onChange={() => toggle("highQualityUploads")} />
          </div>
          <button className="settings-install" onClick={() => installPrompt?.prompt ? installPrompt.prompt() : onInstallGuide()}><Sparkles /> Install VipKorner on this device</button>
          {profile.role === "admin" && <AdminControls />}
          <a className="settings-signout" href="/api/auth">Sign out of VipKorner</a>
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

function ActivityModal({ activities, posts, onRefresh, onViewProfile, onClose }: { activities: Activity[]; posts: Post[]; onRefresh: () => Promise<void>; onViewProfile: (userId: string) => void; onClose: () => void }) {
  const [requestBusy, setRequestBusy] = useState<string | null>(null);
  const [requestError, setRequestError] = useState("");
  useEffect(() => { fetch("/api/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "read-notifications" }) }).catch(() => undefined); }, []);
  async function respond(activity: Activity, decision: "approve" | "decline") {
    if (!activity.actorId) return;
    setRequestBusy(activity.id); setRequestError("");
    try {
      const response = await fetch("/api/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "follow-request-response", targetId: activity.actorId, decision }) });
      await readApiResponse(response, `Could not ${decision} this follow request.`);
      await onRefresh();
    } catch (reason) { setRequestError(reason instanceof Error ? reason.message : "Could not update this follow request."); }
    finally { setRequestBusy(null); }
  }
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Activity" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="profile-modal activity-modal">
        <ModalHeader eyebrow="PROFILE" title="Activity" onClose={onClose} />
        {requestError && <p className="inline-error" role="alert">{requestError}</p>}
        {activities.length ? <div className="activity-list">{activities.map((activity) => { const post = posts.find((item) => item.id === activity.postId); const actor = { username: activity.actorUsername || "Member", displayName: activity.actorDisplayName || activity.actorUsername || "VipKorner member", imageKey: activity.actorImageKey || null, imageUrl: activity.actorImageUrl || null }; const pendingRequest = activity.type === "follow_request" && activity.requestStatus === "pending"; return <article className={`activity-item ${pendingRequest ? "follow-request-item" : ""}`} key={activity.id}><button className="activity-main" disabled={!activity.actorId} onClick={() => { if (activity.actorId) { onClose(); onViewProfile(activity.actorId); } }} aria-label={activity.actorId ? `View @${actor.username}'s profile: ${activity.message}` : activity.message}><img className="activity-avatar" src={profileImage(actor)} alt="" /><span className="activity-copy"><p>{activity.message}</p><time>{relativeTime(activity.createdAt)}</time></span>{post && (post.mediaType === "video" ? <span className="activity-video"><Video /></span> : <img className="activity-media" src={imageSource(post)} alt="" />)}</button>{pendingRequest && <div className="follow-request-actions"><button type="button" disabled={requestBusy === activity.id} onClick={() => void respond(activity, "approve")}>Approve</button><button type="button" disabled={requestBusy === activity.id} onClick={() => void respond(activity, "decline")}>Decline</button></div>}{activity.type === "follow_request" && !pendingRequest && <span className="follow-request-status">{activity.requestStatus === "approved" ? "Approved" : activity.requestStatus === "declined" ? "Declined" : "Canceled"}</span>}</article>; })}</div> : <div className="activity-empty"><span><Bell /></span><h3>No activity yet</h3><p>Follows, follow requests, messages, likes, and comments will appear here.</p></div>}
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
