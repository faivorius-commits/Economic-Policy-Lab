
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type ContentType = "article" | "research";

type Article = {
  id: string;
  title: string | null;
  author_name: string | null;
  excerpt: string | null;
  content: string | null;
  category: string | null;
  cover_image_url: string | null;
  content_type: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
};

type ArticleForm = {
  title: string;
  author_name: string;
  excerpt: string;
  content: string;
  category: string;
  cover_image_url: string;
  content_type: ContentType;
};

const emptyForm: ArticleForm = {
  title: "",
  author_name: "",
  excerpt: "",
  content: "",
  category: "",
  cover_image_url: "",
  content_type: "article",
};

export default function Admin() {
  const navigate = useNavigate();

  const [items, setItems] = useState<Article[]>([]);
  const [identity, setIdentity] = useState("");
  const [message, setMessage] = useState("Checking admin access...");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | ContentType>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ArticleForm>(emptyForm);

  const loadItems = useCallback(async () => {
    const { data, error } = await supabase
      .from("articles")
      .select(
        "id,title,author_name,excerpt,content,category,cover_image_url,content_type,status,created_at,updated_at,published_at"
      )
      .order("updated_at", { ascending: false });

    if (error) {
      setMessage("Unable to load content: " + error.message);
      return;
    }

    setItems((data ?? []) as Article[]);
    setMessage("");
  }, []);

  useEffect(() => {
    let active = true;

    async function checkAdmin() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session) {
        navigate("/login", { replace: true });
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role,display_name")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError || profile?.role !== "admin") {
        setMessage(
          "Administrator access is required. Check your account role in Supabase."
        );
        return;
      }

      setIdentity(
        profile.display_name || session.user.email || "Administrator"
      );

      await loadItems();

      if (active) setReady(true);
    }

    void checkAdmin();

    return () => {
      active = false;
    };
  }, [navigate, loadItems]);

  function startEdit(item: Article) {
    setEditingId(item.id);
    setForm({
      title: item.title || "",
      author_name: item.author_name || "",
      excerpt: item.excerpt || "",
      content: item.content || "",
      category: item.category || "",
      cover_image_url: item.cover_image_url || "",
      content_type:
        item.content_type === "research" ? "research" : "article",
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim() || !form.content.trim()) {
      setMessage("Title and full content are required.");
      return;
    }

    setBusy(true);
    setMessage("");

    const payload = {
      title: form.title.trim(),
      author_name: form.author_name.trim() || identity,
      excerpt: form.excerpt.trim() || null,
      content: form.content.trim(),
      category: form.category.trim() || null,
      cover_image_url: form.cover_image_url.trim() || null,
      content_type: form.content_type,
      updated_at: new Date().toISOString(),
    };

    const result = editingId
      ? await supabase
          .from("articles")
          .update(payload)
          .eq("id", editingId)
      : await supabase.from("articles").insert({
          ...payload,
          author_id: null,
          status: "draft",
        });

    setBusy(false);

    if (result.error) {
      setMessage("Save failed: " + result.error.message);
      return;
    }

    setMessage(
      editingId
        ? "Changes saved successfully."
        : "New content saved as a draft."
    );

    resetForm();
    await loadItems();
  }

  async function changeStatus(item: Article, status: string) {
    const { error } = await supabase
      .from("articles")
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...(status === "published"
          ? { published_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", item.id);

    if (error) {
      setMessage("Status update failed: " + error.message);
      return;
    }

    setMessage("Content status updated.");
    await loadItems();
  }

  async function deleteContent(item: Article) {
    if (!window.confirm(`Delete "${item.title || "Untitled"}"?`)) {
      return;
    }

    const { error } = await supabase
      .from("articles")
      .delete()
      .eq("id", item.id);

    if (error) {
      setMessage("Delete failed: " + error.message);
      return;
    }

    if (editingId === item.id) resetForm();

    setMessage("Content deleted.");
    await loadItems();
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  const visibleItems = items.filter(
    (item) => filter === "all" || item.content_type === filter
  );

  if (!ready) {
    return (
      <main className="admin-page">
        <p>{message}</p>
        <Link to="/login">Return to login</Link>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-heading">
        <div>
          <p className="eyebrow">Economic Policy Lab · Administration</p>
          <h1>Content Management</h1>
          <p>Signed in as {identity}</p>
        </div>

        <div className="admin-actions">
          <Link className="text-button" to="/">
            View website
          </Link>
          <button
            type="button"
            className="epl-button"
            onClick={() => void logout()}
          >
            Log out
          </button>
        </div>
      </header>

      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}

      <section className="admin-queue">
        <h2>{editingId ? "Edit Content" : "Create Content"}</h2>

        <form className="admin-edit-form" onSubmit={saveContent}>
          <label>
            Content type
            <select
              value={form.content_type}
              onChange={(event) =>
                setForm({
                  ...form,
                  content_type: event.target.value as ContentType,
                })
              }
            >
              <option value="article">Article</option>
              <option value="research">Research</option>
            </select>
          </label>

          <label>
            Title
            <input
              required
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
            />
          </label>

          <label>
            Author
            <input
              value={form.author_name}
              onChange={(event) =>
                setForm({ ...form, author_name: event.target.value })
              }
            />
          </label>

          <label>
            Category
            <input
              value={form.category}
              onChange={(event) =>
                setForm({ ...form, category: event.target.value })
              }
              placeholder="Policy Brief, Economics..."
            />
          </label>

          <label>
            Cover image URL
            <input
              type="url"
              value={form.cover_image_url}
              onChange={(event) =>
                setForm({ ...form, cover_image_url: event.target.value })
              }
            />
          </label>

          <label>
            Summary
            <textarea
              rows={3}
              value={form.excerpt}
              onChange={(event) =>
                setForm({ ...form, excerpt: event.target.value })
              }
            />
          </label>

          <label>
            Full content
            <textarea
              required
              rows={10}
              value={form.content}
              onChange={(event) =>
                setForm({ ...form, content: event.target.value })
              }
            />
          </label>

          <div className="admin-row-actions">
            <button type="submit" disabled={busy}>
              {busy
                ? "Saving..."
                : editingId
                  ? "Save Changes"
                  : "Create Draft"}
            </button>

            <button type="button" onClick={resetForm}>
              Clear
            </button>
          </div>
        </form>
      </section>

      <section className="admin-queue">
        <div className="admin-queue-title">
          <h2>Manage Articles & Research</h2>

          <button
            type="button"
            className="text-button"
            onClick={() => void loadItems()}
          >
            Refresh
          </button>
        </div>

        <label>
          Filter content
          <select
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as typeof filter)
            }
          >
            <option value="all">All content</option>
            <option value="article">Articles</option>
            <option value="research">Research</option>
          </select>
        </label>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Title</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {visibleItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.content_type || "article"}</td>
                  <td>{item.title || "Untitled"}</td>
                  <td>{item.status || "draft"}</td>
                  <td>
                    <div className="admin-row-actions">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                      >
                        Edit
                      </button>

                      {item.status !== "published" && (
                        <button
                          type="button"
                          onClick={() =>
                            void changeStatus(item, "published")
                          }
                        >
                          Publish
                        </button>
                      )}

                      {item.status === "published" && (
                        <button
                          type="button"
                          onClick={() =>
                            void changeStatus(item, "draft")
                          }
                        >
                          Unpublish
                        </button>
                      )}

                      <button
                        type="button"
                        className="danger-action"
                        onClick={() => void deleteContent(item)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {visibleItems.length === 0 && (
                <tr>
                  <td colSpan={4}>No content found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
