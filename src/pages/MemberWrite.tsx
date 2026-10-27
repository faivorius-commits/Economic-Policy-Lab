import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { supabase } from "../lib/supabase";

type ContentType = "article" | "research";
type ContentStatus =
  | "draft"
  | "pending"
  | "published"
  | "rejected"
  | "archived";

type ExistingArticle = {
  id: string;
  author_id: string | null;
  author_name: string | null;
  title: string;
  excerpt: string | null;
  content: string;
  category: string | null;
  cover_image_url: string | null;
  content_type: ContentType;
  status: ContentStatus;
};

export default function MemberWrite() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = params.get("id");

  const [userId, setUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const [author, setAuthor] = useState("");
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<ContentType>("article");
  const [cover, setCover] = useState("");
  const [status, setStatus] = useState<ContentStatus>("draft");

  const [message, setMessage] = useState("Loading editor...");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function init() {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        navigate("/login", { replace: true });
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role,display_name")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError || !profile) {
        setMessage("Could not verify your profile.");
        return;
      }

      const admin = profile.role === "admin";

      setUserId(session.user.id);
      setIsAdmin(admin);
      setAuthor(
        profile.display_name || session.user.email || ""
      );

      if (id) {
        let query = supabase
          .from("articles")
          .select("*")
          .eq("id", id);

        // Admin dapat membuka semua konten.
        // Member biasa hanya dapat membuka konten miliknya.
        if (!admin) {
          query = query.eq("author_id", session.user.id);
        }

        const { data, error } = await query.maybeSingle();

        if (!active) return;

        if (error || !data) {
          setMessage(
            "Content could not be loaded. Check your access or Supabase policies."
          );
          return;
        }

        const item = data as ExistingArticle;

        if (!admin && item.status === "published") {
          setMessage(
            "Published content cannot be edited by members."
          );
          return;
        }

        setAuthor(item.author_name || profile.display_name || "");
        setTitle(item.title || "");
        setExcerpt(item.excerpt || "");
        setCategory(item.category || "");
        setBody(item.content || "");
        setType(item.content_type || "article");
        setCover(item.cover_image_url || "");
        setStatus(item.status || "draft");
      }

      setMessage("");
      setReady(true);
    }

    void init();

    return () => {
      active = false;
    };
  }, [id, navigate]);

  async function saveContent(
    nextStatus: ContentStatus
  ) {
    if (!author.trim() || !title.trim() || !body.trim()) {
      setMessage(
        "Please fill in the author name, title, and content body."
      );
      return;
    }

    setBusy(true);
    setMessage("");

    const now = new Date().toISOString();

    const payload = {
      author_name: author.trim(),
      title: title.trim(),
      excerpt: excerpt.trim() || null,
      content: body.trim(),
      category: category.trim() || null,
      cover_image_url: cover.trim() || null,
      content_type: type,
      status: nextStatus,
      updated_at: now,
      ...(nextStatus === "published"
        ? { published_at: now }
        : {}),
    };

    try {
      if (id) {
        let query = supabase
          .from("articles")
          .update(payload)
          .eq("id", id);

        if (!isAdmin) {
          query = query
            .eq("author_id", userId)
            .neq("status", "published");
        }

        const { data, error } = await query
          .select("id")
          .maybeSingle();

        if (error) {
          setMessage("Could not update content: " + error.message);
          return;
        }

        if (!data) {
          setMessage(
            "No content was updated. Check the article ID and Supabase permissions."
          );
          return;
        }
      } else {
        const { data, error } = await supabase
          .from("articles")
          .insert({
            ...payload,
            author_id: userId,
            created_at: now,
          })
          .select("id")
          .single();

        if (error) {
          setMessage("Could not create content: " + error.message);
          return;
        }

        if (!data) {
          setMessage("Content was not created.");
          return;
        }

        setMessage("Content created successfully.");
        navigate(
          "/member/write?id=" + encodeURIComponent(data.id),
          { replace: true }
        );
        return;
      }

      setStatus(nextStatus);

      if (nextStatus === "pending") {
        navigate("/member");
        return;
      }

      setMessage("Changes saved successfully.");
    } catch {
      setMessage("An unexpected error occurred while saving.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <main className="member-page">
        <p role="status">{message}</p>
      </main>
    );
  }

  return (
    <main className="member-page">
      <header className="member-heading">
        <div>
          <Link className="back-link" to="/member">
            ← Member workspace
          </Link>

          <p className="eyebrow">Economic Policy Lab</p>

          <h1>{id ? "Edit content" : "Create content"}</h1>

          <p>
            {isAdmin
              ? "You can manage articles and research as an administrator."
              : "Prepare your submission for editorial review."}
          </p>
        </div>

        {isAdmin && (
          <Link className="text-button" to="/admin">
            Admin dashboard
          </Link>
        )}
      </header>

      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}

      <form
        className="member-editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          void saveContent(isAdmin ? status : "pending");
        }}
      >
        <section className="member-form-card">
          <label>
            Content type
            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value as ContentType)
              }
            >
              <option value="article">Article</option>
              <option value="research">Research</option>
            </select>
          </label>

          <label>
            Author name
            <input
              required
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
            />
          </label>

          <label>
            Title
            <input
              required
              maxLength={240}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label>
            Abstract / excerpt
            <textarea
              rows={4}
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
            />
          </label>

          <label>
            Cover image URL
            <input
              type="url"
              value={cover}
              onChange={(event) => setCover(event.target.value)}
              placeholder="https://example.com/image.jpg"
            />
          </label>

          <label>
            Category
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="e.g. Monetary Policy"
            />
          </label>

          <label>
            Body
            <textarea
              required
              rows={18}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write the complete article or research paper here..."
            />
          </label>

          {isAdmin && (
            <label>
              Publication status
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as ContentStatus)
                }
              >
                <option value="draft">Draft</option>
                <option value="pending">Pending review</option>
                <option value="published">Published</option>
                <option value="rejected">Rejected</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          )}
        </section>

        <div className="member-form-actions">
          <Link className="text-button" to="/member">
            Cancel
          </Link>

          <div>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => void saveContent("draft")}
            >
              {busy ? "Saving..." : "Save draft"}
            </button>

            <button
              type="submit"
              className="epl-button"
              disabled={busy}
            >
              {busy
                ? "Saving..."
                : isAdmin
                  ? "Save changes"
                  : "Submit for review"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
