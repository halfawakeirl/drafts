(() => {
  const KEY = "drafts_posts_v1";

  function loadPosts() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function savePosts(posts) {
    localStorage.setItem(KEY, JSON.stringify(posts));
  }

  function fmtTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString([], { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function sanitizeText(s) {
    return (s || "").trim();
  }

  // Basic safety checks (light + school-safe demo)
  function checkSafety(text) {
    const t = text.toLowerCase();

    if (t.includes("http://") || t.includes("https://") || t.includes("www.")) {
      return "Please remove links (no URLs).";
    }
    if (t.includes("@")) {
      return "Please remove @usernames/handles to keep it anonymous.";
    }
    // Very rough phone-number-ish pattern (8+ digits total)
    const digits = (t.match(/\d/g) || []).length;
    if (digits >= 8) {
      return "Please remove phone-number-like details to protect privacy.";
    }
    return null;
  }

  function makePostCard(post) {
    const wrap = document.createElement("div");
    wrap.className = "post";

    const top = document.createElement("div");
    top.className = "post-top";

    const tag = document.createElement("div");
    tag.className = "tag";
    tag.textContent = post.tag && post.tag !== "unspecified" ? post.tag : "unspecified";

    const time = document.createElement("div");
    time.className = "time";
    time.textContent = fmtTime(post.createdAt);

    top.appendChild(tag);
    top.appendChild(time);

    const msg = document.createElement("p");
    msg.className = "post-text";
    msg.textContent = post.message;

    wrap.appendChild(top);
    wrap.appendChild(msg);

    if (post.thought && post.thought.trim().length > 0) {
      const thought = document.createElement("p");
      thought.className = "post-thought";
      thought.textContent = post.thought;
      wrap.appendChild(thought);
    }

    const actions = document.createElement("div");
    actions.className = "post-actions";

    const btn = document.createElement("button");
    btn.className = "btn relate";
    btn.innerHTML = `I relate <strong>(${post.relates || 0})</strong>`;
    btn.addEventListener("click", () => {
      const posts = loadPosts();
      const idx = posts.findIndex(p => p.id === post.id);
      if (idx !== -1) {
        posts[idx].relates = (posts[idx].relates || 0) + 1;
        savePosts(posts);
        // re-render depending on page
        renderAll();
      }
    });

    actions.appendChild(btn);
    wrap.appendChild(actions);

    return wrap;
  }

  function seedSamples() {
    const posts = loadPosts();
    const samples = [
      { message: "I hope you know I meant it, even when I didn’t say it right.", thought: "I still replay the moment and rewrite it in my head.", tag: "regret" },
      { message: "Thank you. I never sent it because it felt too small, but it wasn’t.", thought: "", tag: "gratitude" },
      { message: "I’m not angry anymore. I just wish we ended better.", thought: "Some endings don’t feel finished.", tag: "closure" },
      { message: "I miss who I was before I started comparing myself to everyone.", thought: "It’s exhausting to perform happiness.", tag: "sadness" }
    ];

    const now = Date.now();
    const newOnes = samples.map((s, i) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : String(now + i),
      message: s.message,
      thought: s.thought,
      tag: s.tag,
      createdAt: new Date(now - i * 3600_000).toISOString(),
      relates: 0
    }));

    savePosts([...newOnes, ...posts]);
  }

  // ===== Rendering per page =====
  function renderHomeStatsAndFeatured() {
    const posts = loadPosts();

    const statPosts = document.getElementById("statPosts");
    const statRelates = document.getElementById("statRelates");
    if (statPosts) statPosts.textContent = String(posts.length);
    if (statRelates) {
      const total = posts.reduce((sum, p) => sum + (p.relates || 0), 0);
      statRelates.textContent = String(total);
    }

    const featured = document.getElementById("featuredList");
    if (featured) {
      featured.innerHTML = "";
      const picks = posts.slice(0, 3);
      if (picks.length === 0) {
        featured.innerHTML = `<p class="muted">No drafts yet. Go to Publishing to write the first one.</p>`;
      } else {
        picks.forEach(p => featured.appendChild(makePostCard(p)));
      }
    }
  }

  function renderArchive() {
    const list = document.getElementById("archiveList");
    if (!list) return;

    const searchInput = document.getElementById("searchInput");
    const filterTag = document.getElementById("filterTag");
    const sortBy = document.getElementById("sortBy");
    const emptyMsg = document.getElementById("emptyMsg");

    const query = (searchInput?.value || "").trim().toLowerCase();
    const tag = filterTag?.value || "all";
    const sort = sortBy?.value || "newest";

    let posts = loadPosts();

    // filter
    posts = posts.filter(p => {
      const hay = `${p.message} ${p.thought || ""}`.toLowerCase();
      const matchQ = query === "" || hay.includes(query);
      const matchTag = tag === "all" || (p.tag || "unspecified") === tag;
      return matchQ && matchTag;
    });

    // sort
    if (sort === "relate") {
      posts.sort((a, b) => (b.relates || 0) - (a.relates || 0));
    } else {
      posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    list.innerHTML = "";
    if (posts.length === 0) {
      if (emptyMsg) emptyMsg.textContent = "No matching drafts yet.";
      return;
    }
    if (emptyMsg) emptyMsg.textContent = "";

    posts.forEach(p => list.appendChild(makePostCard(p)));
  }

  function wireArchiveControls() {
    const list = document.getElementById("archiveList");
    if (!list) return;

    ["searchInput", "filterTag", "sortBy"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", renderArchive);
      if (el) el.addEventListener("change", renderArchive);
    });

    const clearBtn = document.getElementById("clearBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        const s = document.getElementById("searchInput");
        const t = document.getElementById("filterTag");
        const sort = document.getElementById("sortBy");
        if (s) s.value = "";
        if (t) t.value = "all";
        if (sort) sort.value = "newest";
        renderArchive();
      });
    }
  }

  function wirePublishingForm() {
    const postBtn = document.getElementById("postBtn");
    if (!postBtn) return;

    const msgEl = document.getElementById("message");
    const thoughtEl = document.getElementById("thought");
    const tagEl = document.getElementById("tag");
    const formMsg = document.getElementById("formMsg");
    const seedBtn = document.getElementById("seedBtn");

    if (seedBtn) {
      seedBtn.addEventListener("click", () => {
        seedSamples();
        if (formMsg) formMsg.textContent = "Sample drafts added. Check the Archive.";
      });
    }

    postBtn.addEventListener("click", () => {
      const message = sanitizeText(msgEl?.value);
      const thought = sanitizeText(thoughtEl?.value);
      const tag = tagEl?.value || "unspecified";

      if (!message) {
        if (formMsg) formMsg.textContent = "Please write an unsent message first.";
        return;
      }

      const safetyMsg = checkSafety(message + " " + thought);
      if (safetyMsg) {
        if (formMsg) formMsg.textContent = safetyMsg;
        return;
      }

      const posts = loadPosts();
      const post = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        message,
        thought,
        tag,
        createdAt: new Date().toISOString(),
        relates: 0
      };

      savePosts([post, ...posts]);

      if (msgEl) msgEl.value = "";
      if (thoughtEl) thoughtEl.value = "";
      if (tagEl) tagEl.value = "unspecified";
      if (formMsg) formMsg.textContent = "Posted. Your draft is now in the Archive.";

      // optional: jump to archive after posting
      // window.location.href = "archive.html";
    });
  }

  function renderAll() {
    renderHomeStatsAndFeatured();
    renderArchive();
  }

  // ===== Init =====
  document.addEventListener("DOMContentLoaded", () => {
    // If brand new, leave empty — user can seed from Publishing if desired
    wirePublishingForm();
    wireArchiveControls();
    renderAll();
  });
})();
