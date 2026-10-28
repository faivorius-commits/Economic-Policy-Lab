
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Submission = {
  id: string;
  title: string;
  content_type: "article" | "research";
  status: string;
  updated_at: string | null;
  excerpt: string | null;
  author_name: string | null;
};

const ADMIN_EMAIL = "members@economicpolicylab.org";

export default function Member() {
  const navigate = useNavigate();

  const [identity, setIdentity] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [items, setItems] = useState<Submission[]>([]);
  const [message, setMessage] = useState("Loading workspace...");
  const [ready, setReady] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    async (userId: string, isAdmin: boolean) => {
      let query = supabase
        .from("articles")
        .select(
          "id,title,content_type,status,updated_at,excerpt,author_name"
        )
        .order("updated_at", { ascending: false });

      if (!isAdmin) {
        query = query.eq("author_id", userId);
      }

      const { data, error } = await query;

      if (error) {
        setMessage("Could not load submissions: " + error.message);
        return;
      }

      setItems((data ?? []) as Submission[]);
      setMessage("");
    },
    []
  );

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
        setMessage(
          "Could not verify your profile. Please check your Supabase profile."
        );
        return;
      }

      const isAdmin =
        profile.role === "admin" ||
        session.user.email?.trim().toLowerCase() === ADMIN_EMAIL;

      setRole(isAdmin ? "admin" : "member");
      setIdentity(
        profile.display_name || session.user.email || "Member"
      );

      setReady(true);
      await load(session.user.id, isAdmin);
    }

    void init();

    return () => {
      active = false;
    };
  }, [navigate, load]);

  const count = (status: string) =>
    items.filter((item) => item.status === status).length;

  async function reviewSubmission(
    item: Submission,
    status: "published" | "rejected"
  ) {
    if (role !== "admin" || busyId) return;

    const action =
      status === "published" ? "approve and publish" : "reject";

    if (
      !window.confirm(
        `Are you sure you want to ${action} "${item.title || "Untitled submission"}"?`
      )
    ) {
      return;
    }

    setBusyId(item.id);
    setMessage(
      status === "published"
        ? "Publishing submission..."
        : "Rejecting submission..."
    );

    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("articles")
        .update({
          status,
          updated_at: now,
          ...(status === "published" ? { published_at: now } : {}),
        })
        .eq("id", item.id)
        .select("id");

      if (error) {
        setMessage("Could not update submission: " + error.message);
        return;
      }

      if (!data || data.length === 0) {
        setMessage(
          "Submission was not updated. Check your Supabase permissions."
        );
        return;
      }

      setMessage(
        status === "published"
          ? "Submission approved and published successfully."
          : "Submission rejected successfully."
      );

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        await load(session.user.id, true);
      }
    } catch {
      setMessage("An unexpected error occurred while reviewing.");
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
      <main className="member-page">
        <p>{message}</p>
      </main>
    );
  }

  const pendingItems = items.filter(
    (item) => item.status === "pending"
  );

  return (
    <main className="member-page">
      <header className="member-heading">
        <div>
          <p className="eyebrow">
            Economic Policy Lab · Member workspace
          </p>

          <h1>Welcome, {identity}.</h1>

          <p>
            {role === "admin"
              ? "Manage submissions and review content directly from your workspace."
              : "Create, manage, and track your submissions."}
          </p>

          <span className="status-pill">
            {role === "admin"
              ? "Admin + Member access"
              : "Member"}
          </span>
        </div>

        <div className="member-actions">
          {role === "admin" && (
            <Link className="text-button" to="/admin">
              Admin dashboard
            </Link>
          )}

          <Link className="text-button" to="/">
            View website
          </Link>

          <button
            type="button"
            className="text-button"
            onClick={() => void logout()}
          >
            Log out
          </button>
        </div>
      </header>

      <section className="member-stats">
        <div>
          <span>
            {role === "admin" ? "All content" : "Your submissions"}
          </span>
          <strong>{items.length}</strong>
        </div>

        <div>
          <span>Drafts</span>
          <strong>{count("draft")}</strong>
        </div>

        <div>
          <span>Under review</span>
          <strong>{count("pending")}</strong>
        </div>

        <div>
          <span>Published</span>
          <strong>{count("published")}</strong>
        </div>
      </section>

      {/* Admin-only review panel */}
      {role === "admin" && (
        <section className="admin-queue pending-review-panel">
          <div className="admin-queue-title">
            <div>
              <p className="eyebrow">Editorial review</p>
              <h2>Pending Review</h2>
              <p>
                Approve or reject submitted articles and research.
              </p>
            </div>

            <span className="status-pill">
              {pendingItems.length} pending
            </span>
          </div>

          {pendingItems.length > 0 ? (
            <div className="pending-review-list">
              {pendingItems.map((item) => (
                <article
                  className="pending-review-item"
                  key={item.id}
                >
                  <div className="pending-review-info">
                    <span className="status-pill">pending</span>

                    <p className="member-type">
                      {item.content_type === "research"
                        ? "Research"
                        : "Article"}
                    </p>

                    <h3>{item.title || "Untitled submission"}</h3>

                    <p className="member-excerpt">
                      Contributor: {item.author_name || "EPL Member"}
                    </p>

                    {item.excerpt && (
                      <p className="member-excerpt">
                        {item.excerpt}
                      </p>
                    )}

                    <small>
                      Last updated:{" "}
                      {item.updated_at
                        ? new Date(item.updated_at).toLocaleDateString()
                        : "—"}
                    </small>
                  </div>

                  <div className="member-actions pending-review-actions">
                    <Link
                      className="text-button"
                      to={
                        "/member/write?id=" +
                        encodeURIComponent(item.id)
                      }
                    >
                      Edit
                    </Link>

                    <button
                      type="button"
                      className="approve-button"
                      disabled={busyId !== null}
                      onClick={() =>
                        void reviewSubmission(item, "published")
                      }
                    >
                      {busyId === item.id
                        ? "Working..."
                        : "✓ Approve"}
                    </button>

                    <button
                      type="button"
                      className="reject-button"
                      disabled={busyId !== null}
                      onClick={() =>
                        void reviewSubmission(item, "rejected")
                      }
                    >
                      ✕ Reject
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="member-empty">
              <h3>All caught up!</h3>
              <p>
                There are no submissions waiting for review.
              </p>
            </div>
          )}
        </section>
      )}

      <section className="member-list">
        <div className="member-list-heading">
          <div>
            <p className="eyebrow">
              {role === "admin"
                ? "Content management"
                : "Your work"}
            </p>

            <h2>
              {role === "admin"
                ? "All Articles & Research"
                : "Submissions"}
            </h2>
          </div>

          <Link className="epl-button" to="/member/write">
            Create content
          </Link>
        </div>

        {message && (
          <p className="form-message" role="status">
            {message}
          </p>
        )}

        {!items.length && !message && (
          <div className="member-empty">
            <h3>No content yet</h3>
            <p>
              Create an article or research submission to get started.
            </p>

            <Link className="epl-button" to="/member/write">
              Create your first submission
            </Link>
          </div>
        )}

        <div className="member-submissions">
          {items.map((item) => (
            <article
              className="member-submission"
              key={item.id}
            >
              <div>
                <span className="status-pill">
                  {item.status || "draft"}
                </span>

                <p className="member-type">
                  {item.content_type === "research"
                    ? "Research"
                    : "Article"}
                </p>

                <h3>{item.title || "Untitled submission"}</h3>

                {role === "admin" && (
                  <p className="member-excerpt">
                    Author: {item.author_name || "EPL Member"}
                  </p>
                )}

                {item.excerpt && (
                  <p className="member-excerpt">
                    {item.excerpt}
                  </p>
                )}

                <small>
                  Last updated:{" "}
                  {item.updated_at
                    ? new Date(item.updated_at).toLocaleDateString()
                    : "—"}
                </small>
              </div>

              <Link
                className="text-button"
                to={
                  "/member/write?id=" +
                  encodeURIComponent(item.id)
                }
              >
                {role === "admin"
                  ? "Edit content"
                  : item.status === "published"
                    ? "View"
                    : "Edit"}
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
