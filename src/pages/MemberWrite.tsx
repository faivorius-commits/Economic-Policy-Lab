
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import RichTextEditor from "../components/RichTextEditor";

type ArticleStatus =
  | "draft"
  | "pending"
  | "published"
  | "rejected"
  | "archived";

// Membersihkan HTML agar tag tidak tampil sebagai teks mentah.
function cleanArticleBody(html: string): string {
  if (!html) return "";

  const paragraphs = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|h[1-6]|li)>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return paragraphs;
}

export default function MemberWrite() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = params.get("id");

  const [userId, setUserId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [author, setAuthor] = useState("");
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("article");
  const [cover, setCover] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [originalStatus, setOriginalStatus] =
    useState<ArticleStatus>("draft");
  const [message, setMessage] = useState("Loading...");
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

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role, display_name")
          .eq("id", session.user.id)
          .maybeSingle();

      if (!active) return;

      if (profileError) {
        setMessage("Could not verify your account permissions.");
        return;
      }

      const admin = profile?.role === "admin";

      setUserId(session.user.id);
      setIsAdmin(admin);

      if (id) {
        let query = supabase
          .from("articles")
          .select("*")
          .eq("id", id);

        // Members may edit only their own submissions.
        // Admins may edit any article, subject to Supabase RLS.
        if (!admin) {
          query = query.eq("author_id", session.user.id);
        }

        const { data, error } = await query.maybeSingle();

        if (!active) return;

        if (error || !data) {
          setMessage(
            "Article not found or you do not have permission to edit it."
          );
          return;
        }

        if (!admin && data.status === "published") {
          setMessage(
            "Published submissions cannot be edited here."
          );
          return;
        }

        setOwnerId(data.author_id || "");
        setAuthor(data.author_name || "");
        setTitle(data.title || "");
        setExcerpt(data.excerpt || "");
        setCategory(data.category || "");
        setType(data.content_type || "article");
        setCover(data.cover_image_url || "");

        // Clean HTML before displaying it in the editor.
        setBody(cleanArticleBody(data.content || ""));

        setOriginalStatus(
          (data.status || "draft") as ArticleStatus
        );
      } else {
        setAuthor(
          profile?.display_name || session.user.email || ""
        );
      }

      setMessage("");
      setReady(true);
    }

    void init();

    return () => {
      active = false;
    };
  }, [id, navigate]);

  async function save(mode: "draft" | "pending") {
    if (!author.trim() || !title.trim() || !body.trim()) {
      setMessage("Please enter an author name, title, and body.");
      return;
    }

    setBusy(true);
    setMessage("");

    const payload = {
      // Preserve the original author when an admin edits an article.
      author_id: id && isAdmin ? ownerId : userId,
      author_name: author.trim(),
      title: title.trim(),
      excerpt: excerpt.trim(),
      content: body,
      category: category.trim(),
      cover_image_url: cover.trim() || null,
      content_type: type,
      status: id && isAdmin ? originalStatus : mode,
      updated_at: new Date().toISOString(),
    };

    const result = id
      ? await (isAdmin
          ? supabase
              .from("articles")
              .update(payload)
              .eq("id", id)
          : supabase
              .from("articles")
              .update(payload)
              .eq("id", id)
              .eq("author_id", userId))
      : await supabase
          .from("articles")
          .insert(payload)
          .select("id")
          .single();

    setBusy(false);

    if (result.error) {
      setMessage(
        "Could not save article: " + result.error.message
      );
      return;
    }

    setMessage(
      id
        ? "Article changes saved."
        : mode === "draft"
          ? "Draft saved."
          : "Submitted for editorial review."
    );

    if (isAdmin) {
      navigate("/admin");
      return;
    }

    if (mode === "pending") {
      navigate("/member");
      return;
    }

    if (!id && result.data && "id" in result.data) {
      navigate(
        "/member/write?id=" + encodeURIComponent(result.data.id),
        { replace: true }
      );
    }
  }

  if (!ready) {
    return (
      <main className="member-page">
        <p role="status">{message}</p>
        <Link
          className="back-link"
          to={isAdmin ? "/admin" : "/member"}
        >
          ← Back
        </Link>
      </main>
    );
  }

  return (
    <main className="member-page">
      <header className="member-heading">
        <div>
          <Link
            className="back-link"
            to={isAdmin ? "/admin" : "/member"}
          >
            ← {isAdmin ? "Admin dashboard" : "Member workspace"}
          </Link>

          <p className="eyebrow">Economic Policy Lab</p>
          <h1>{id ? "Edit article" : "Create a submission"}</h1>
          <p>
            {isAdmin
              ? "Administrator editing mode."
              : "Prepare your work for editorial review."}
          </p>
        </div>
      </header>

      {message && <p role="status">{message}</p>}

      <form
        className="member-editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save("pending");
        }}
      >
        <section className="member-form-card">
          <label>
            Content type
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
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
              rows={3}
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
              placeholder="https://..."
            />
          </label>

          <label>
            Category
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            />
          </label>

          <label>
            Body
            <textarea
              required
              rows={18}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write your article or research here..."
            />
          </label>
        </section>

        <div className="member-form-actions">
          <Link
            className="text-button"
            to={isAdmin ? "/admin" : "/member"}
          >
            Cancel
          </Link>

          <div>
            {!isAdmin && (
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => void save("draft")}
              >
                {busy ? "Saving..." : "Save draft"}
              </button>
            )}

            <button className="epl-button" disabled={busy}>
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
