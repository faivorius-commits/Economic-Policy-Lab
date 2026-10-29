
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import RichTextEditor from "../components/RichTextEditor";

type ArticleForm = {
  title: string;
  author_name: string;
  excerpt: string;
  category: string;
  content_type: string;
  cover_image_url: string;
  content: string;
  published_at: string;
};

const emptyForm: ArticleForm = {
  title: "",
  author_name: "",
  excerpt: "",
  category: "",
  content_type: "article",
  cover_image_url: "",
  content: "",
  published_at: "",
};

export default function AdminArticleEdit() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = params.get("id");

  const [form, setForm] = useState<ArticleForm>(emptyForm);
  const [message, setMessage] = useState(
    "Checking administrator access…"
  );
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!id) {
        setMessage("Article ID is missing.");
        return;
      }

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
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();

      if (!active) return;

      if (profileError || profile?.role !== "admin") {
        navigate("/login", { replace: true });
        return;
      }

      const { data, error } = await supabase
        .from("articles")
        .select(
          "id,title,author_name,excerpt,category,content_type,cover_image_url,content,published_at"
        )
        .eq("id", id)
        .single();

      if (!active) return;

      if (error || !data) {
        setMessage(
          "Could not load article: " +
            (error?.message || "Not found.")
        );
        return;
      }

      setForm({
        title: data.title || "",
        author_name: data.author_name || "",
        excerpt: data.excerpt || "",
        category: data.category || "",
        content_type: data.content_type || "article",
        cover_image_url: data.cover_image_url || "",
        content: data.content || "",
        published_at: data.published_at
          ? new Date(data.published_at)
              .toISOString()
              .slice(0, 16)
          : "",
      });

      setMessage("");
      setReady(true);
    }

    void load();

    return () => {
      active = false;
    };
  }, [id, navigate]);

  function change<K extends keyof ArticleForm>(
    key: K,
    value: ArticleForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !id ||
      !form.title.trim() ||
      !form.content.replace(/<[^>]*>/g, "").trim()
    ) {
      setMessage(
        "Title and full article content are required."
      );
      return;
    }

    setBusy(true);
    setMessage("Saving changes…");

    const { error } = await supabase
      .from("articles")
      .update({
        title: form.title.trim(),
        author_name: form.author_name.trim(),
        excerpt: form.excerpt.trim(),
        category: form.category.trim(),
        content_type: form.content_type,
        cover_image_url:
          form.cover_image_url.trim() || null,
        content: form.content.trim(),
        published_at: form.published_at
          ? new Date(form.published_at).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    setBusy(false);

    if (error) {
      setMessage(
        "Could not save changes: " + error.message
      );
      return;
    }

    setMessage("Article changes saved successfully.");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  if (!ready) {
    return (
      <main className="admin-page">
        <p>{message}</p>

        <Link className="text-button" to="/admin">
          Back to admin
        </Link>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-heading">
        <div>
          <p className="eyebrow">
            Economic Policy Lab · Administration
          </p>

          <h1>Edit article</h1>

          <p>
            Edit article details, publication date, format
            the text, and insert supporting images into
            the article body.
          </p>
        </div>

        <Link className="text-button" to="/admin">
          Back to dashboard
        </Link>
      </header>

      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}

      <form
        className="team-editor-form"
        onSubmit={save}
      >
        <label>
          Article title *
          <input
            required
            value={form.title}
            onChange={(e) =>
              change("title", e.target.value)
            }
          />
        </label>

        <label>
          Author / contributor
          <input
            value={form.author_name}
            onChange={(e) =>
              change("author_name", e.target.value)
            }
          />
        </label>

        <label>
          Content type
          <select
            value={form.content_type}
            onChange={(e) =>
              change("content_type", e.target.value)
            }
          >
            <option value="article">Article</option>
            <option value="research">Research</option>
            <option value="policy brief">Policy Brief</option>
            <option value="commentary">Commentary</option>
            <option value="report">Report</option>
          </select>
        </label>

        <label>
          Category
          <input
            value={form.category}
            onChange={(e) =>
              change("category", e.target.value)
            }
            placeholder="e.g. Fiscal Policy"
          />
        </label>

        {/* Publication date and time */}
        <section
          className="team-form-wide"
          style={{
            padding: "22px",
            border: "2px solid #4f8fcf",
            borderRadius: "14px",
            background: "rgba(79, 143, 207, 0.09)",
            display: "grid",
            gap: "10px",
            margin: "8px 0 18px",
          }}
        >
          <label
            htmlFor="article-published-at"
            style={{
              display: "block",
              fontSize: "1rem",
              fontWeight: 700,
              marginBottom: "4px",
            }}
          >
            PUBLICATION DATE &amp; TIME
          </label>

          <input
            id="article-published-at"
            name="published_at"
            type="datetime-local"
            value={form.published_at}
            onChange={(e) =>
              change("published_at", e.target.value)
            }
            style={{
              display: "block",
              width: "100%",
              minHeight: "48px",
              padding: "12px 14px",
              border: "1px solid #4f8fcf",
              borderRadius: "9px",
              background: "#ffffff",
              color: "#18324b",
              fontSize: "1rem",
              boxSizing: "border-box",
            }}
          />

          <small
            style={{
              display: "block",
              lineHeight: 1.6,
            }}
          >
            Set the publication date and time for this
            article. Leave blank if you want to hide the
            date.
          </small>
        </section>

        <label className="team-form-wide">
          Summary / excerpt
          <textarea
            rows={3}
            value={form.excerpt}
            onChange={(e) =>
              change("excerpt", e.target.value)
            }
          />
        </label>

        <label className="team-form-wide">
          Cover image URL
          <input
            value={form.cover_image_url}
            onChange={(e) =>
              change("cover_image_url", e.target.value)
            }
            placeholder="https://…"
          />
        </label>

        {form.cover_image_url && (
          <div className="team-photo-preview team-form-wide">
            <img
              src={form.cover_image_url}
              alt="Article cover preview"
            />
          </div>
        )}

        <div className="team-form-wide">
          <label>Full article content *</label>

          <RichTextEditor
            value={form.content}
            onChange={(value) =>
              change("content", value)
            }
            label="Full article content"
          />
        </div>

        <div className="team-form-wide admin-actions">
          <button
            type="submit"
            className="epl-button"
            disabled={busy}
          >
            {busy ? "Saving…" : "Save changes"}
          </button>

          <Link
            to="/admin"
            className="text-button"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
