
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Article = {
  id: string | number;
  title: string | null;
  author_name: string | null;
  content_type: string | null;
  status: string | null;
  updated_at: string | null;
  created_at: string | null;
};

export default function Admin() {
  const navigate = useNavigate();

  const [items, setItems] = useState<Article[]>([]);
  const [identity, setIdentity] = useState("");
  const [message, setMessage] = useState(
    "Verifying administrator access..."
  );
  const [ready, setReady] = useState(false);
  const [busyId, setBusyId] = useState<string | number | null>(
    null
  );

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("articles")
      .select(
        "id,title,author_name,content_type,status,updated_at,created_at"
      )
      .order("updated_at", { ascending: false });

    if (error) {
      setMessage(
        "Could not load the editorial queue: " + error.message
      );
      return;
    }

    setItems((data ?? []) as Article[]);
    setMessage("");
  }, []);

  useEffect(() => {
    let active = true;

    async function init() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session) {
        navigate("/login", { replace: true });
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role,display_name")
          .eq("id", session.user.id)
          .maybeSingle();

      if (!active) return;

      if (profileError || profile?.role !== "admin") {
        navigate("/login", { replace: true });
        return;
      }

      setIdentity(
        profile.display_name ||
          session.user.email ||
          "Administrator"
      );

      setReady(true);
      await load();
    }

    void init();

    return () => {
      active = false;
    };
  }, [navigate, load]);

  async function changeStatus(
    item: Article,
    status: string
  ) {
    if (busyId !== null) return;

    if (
      status === "deleted" &&
      !window.confirm(
        `Permanently delete "${item.title || "Untitled"}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setBusyId(item.id);
    setMessage("");

    try {
      const result =
        status === "deleted"
          ? await supabase
              .from("articles")
              .delete()
              .eq("id", item.id)
          : await supabase
              .from("articles")
              .update({
                status,
                updated_at: new Date().toISOString(),
                ...(status === "published"
                  ? {
                      published_at: new Date().toISOString(),
                    }
                  : {}),
              })
              .eq("id", item.id);

      if (result.error) {
        setMessage(
          "Could not update content: " + result.error.message
        );
        return;
      }

      setMessage(
        status === "deleted"
          ? "Content deleted successfully."
          : `Content status changed to ${status}.`
      );

      await load();
    } catch {
      setMessage("An unexpected error occurred.");
    } finally {
      setBusyId(null);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  if (!ready) {
    return (
      <main className="admin-page">
        <p>{message}</p>
      </main>
    );
  }

  const pendingCount = items.filter(
    (item) => item.status === "pending"
  ).length;

  const publishedCount = items.filter(
    (item) => item.status === "published"
  ).length;

  return (
    <main className="admin-page">
      <header className="admin-heading">
        <div>
          <p className="eyebrow">
            Economic Policy Lab · Administration
          </p>

          <h1>Editorial Dashboard</h1>

          <p>Signed in as {identity}</p>
        </div>

        <div className="admin-actions">
          <Link className="text-button" to="/">
            View Website
          </Link>

          <Link className="epl-button" to="/editor">
            + Create Publication
          </Link>

          <button
            type="button"
            className="epl-button"
            onClick={() => void logout()}
          >
            Log Out
          </button>
        </div>
      </header>

      <section className="admin-stats">
        <div>
          <span>Total Items</span>
          <strong>{items.length}</strong>
        </div>

        <div>
          <span>Pending Review</span>
          <strong>{pendingCount}</strong>
        </div>

        <div>
          <span>Published</span>
          <strong>{publishedCount}</strong>
        </div>
      </section>

      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}

      <section className="admin-queue">
        <div className="admin-queue-title">
          <div>
            <h2>Content Queue</h2>
            <p>Review and manage submitted publications.</p>
          </div>

          <button
            type="button"
            className="text-button"
            onClick={() => void load()}
            disabled={busyId !== null}
          >
            Refresh
          </button>
        </div>

        {items.length === 0 ? (
          <p>
            {message
              ? "Unable to display content. Check the message above."
              : "No content found."}
          </p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Contributor</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => {
                  const isBusy = busyId === item.id;

                  return (
                    <tr key={item.id}>
                      <td>{item.content_type || "Article"}</td>

                      <td>
                        <strong>
                          {item.title || "Untitled"}
                        </strong>

                        <div>
                          <Link
                            className="text-button"
                            to={
                              "/editor/" +
                              encodeURIComponent(String(item.id))
                            }
                          >
                            Edit Publication
                          </Link>
                        </div>
                      </td>

                      <td>
                        {item.author_name || "EPL Member"}
                      </td>

                      <td>
                        <span className="status-pill">
                          {item.status || "draft"}
                        </span>
                      </td>

                      <td>
                        <div className="admin-row-actions">
                          {item.status === "pending" && (
                            <>
                              <button
                                type="button"
                                disabled={busyId !== null}
                                onClick={() =>
                                  void changeStatus(
                                    item,
                                    "published"
                                  )
                                }
                              >
                                {isBusy ? "Saving..." : "Approve"}
                              </button>

                              <button
                                type="button"
                                disabled={busyId !== null}
                                onClick={() =>
                                  void changeStatus(
                                    item,
                                    "rejected"
                                  )
                                }
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {item.status === "published" && (
                            <button
                              type="button"
                              disabled={busyId !== null}
                              onClick={() =>
                                void changeStatus(
                                  item,
                                  "archived"
                                )
                              }
                            >
                              Archive
                            </button>
                          )}

                          {["archived", "rejected"].includes(
                            item.status || ""
                          ) && (
                            <button
                              type="button"
                              disabled={busyId !== null}
                              onClick={() =>
                                void changeStatus(item, "draft")
                              }
                            >
                              Restore
                            </button>
                          )}

                          {item.status !== "published" && (
                            <button
                              type="button"
                              className="danger-action"
                              disabled={busyId !== null}
                              onClick={() =>
                                void changeStatus(
                                  item,
                                  "deleted"
                                )
                              }
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="admin-footnote">
        Administrator access is verified through Supabase
        authentication and the profiles.role field. Database
        row-level security must also enforce permissions for
        updates and deletes.
      </p>
    </main>
  );
}
