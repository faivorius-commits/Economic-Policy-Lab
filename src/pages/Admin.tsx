
import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Article = {
  id: string;
  title: string | null;
  author_name: string | null;
  content_type: string | null;
  status: string | null;
  is_featured: boolean;
  featured_order: number;
  updated_at: string | null;
  created_at: string | null;
};

type TeamMember = {
  id: string;
  name: string;
  role_title: string;
  bio: string;
  image_url: string | null;
  section: "board" | "member";
  sort_order: number;
  is_active: boolean;
  linkedin_url: string | null;
  instagram_url: string | null;
};

type TeamForm = {
  name: string;
  role_title: string;
  bio: string;
  image_url: string;
  section: "board" | "member";
  sort_order: number;
  linkedin_url: string;
  instagram_url: string;
};

type Tab = "articles" | "highlights" | "teams";

const emptyTeamForm: TeamForm = {
  name: "",
  role_title: "",
  bio: "",
  image_url: "",
  section: "member",
  sort_order: 0,
  linkedin_url: "",
  instagram_url: "",
};

export default function Admin() {
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("articles");
  const [items, setItems] = useState<Article[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [identity, setIdentity] = useState("");
  const [message, setMessage] = useState(
    "Verifying administrator access..."
  );
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [teamForm, setTeamForm] = useState<TeamForm>(emptyTeamForm);

  const loadArticles = useCallback(async () => {
    const { data, error } = await supabase
      .from("articles")
      .select(
        "id,title,author_name,content_type,status,is_featured,featured_order,updated_at,created_at"
      )
      .order("updated_at", { ascending: false });

    if (error) {
      setMessage("Could not load articles: " + error.message);
      return;
    }

    setItems((data ?? []) as Article[]);
    setMessage("");
  }, []);

  const loadTeam = useCallback(async () => {
    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .order("section", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setMessage("Could not load team members: " + error.message);
      return;
    }

    setTeam((data ?? []) as TeamMember[]);
    setMessage("");
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadArticles(), loadTeam()]);
  }, [loadArticles, loadTeam]);

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

      if (
      session.user.email?.trim().toLowerCase() !==
      "members@economicpolicylab.org"
      ) {
      navigate("/", { replace: true });
      return;
}
      
      const { data: profile, error: profileError } = await supabase
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
      await refreshAll();
    }

    void init();

    return () => {
      active = false;
    };
  }, [navigate, refreshAll]);

  async function changeStatus(item: Article, status: string) {
    if (
      status === "deleted" &&
      !window.confirm("Permanently delete this article?")
    ) {
      return;
    }

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
                ? { published_at: new Date().toISOString() }
                : {}),
            })
            .eq("id", item.id);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setMessage("Article updated.");
    await loadArticles();
  }

  async function toggleFeatured(item: Article) {
    const nextValue = !item.is_featured;

    const nextOrder = nextValue
      ? Math.max(
          0,
          ...items.map((article) => article.featured_order || 0)
        ) + 1
      : 0;

    const { error } = await supabase
      .from("articles")
      .update({
        is_featured: nextValue,
        featured_order: nextOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (error) {
      setMessage("Could not update Highlights: " + error.message);
      return;
    }

    setMessage(
      nextValue
        ? "Article added to Highlights."
        : "Article removed from Highlights."
    );

    await loadArticles();
  }

  async function saveFeaturedOrder(
    item: Article,
    rawValue: string
  ) {
    const order = Number(rawValue);

    if (!Number.isInteger(order) || order < 1) {
      setMessage("Highlight order must be a positive whole number.");
      return;
    }

    if (!item.is_featured) {
      setMessage(
        "Add the article to Highlights before setting its order."
      );
      return;
    }

    const { error } = await supabase
      .from("articles")
      .update({
        featured_order: order,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (error) {
      setMessage("Could not save order: " + error.message);
      return;
    }

    setMessage("Highlight order saved.");
    await loadArticles();
  }

  function editTeamMember(member: TeamMember) {
    setEditingId(member.id);

    setTeamForm({
      name: member.name,
      role_title: member.role_title || "",
      bio: member.bio || "",
      image_url: member.image_url || "",
      section: member.section,
      sort_order: member.sort_order || 0,
      linkedin_url: member.linkedin_url || "",
      instagram_url: member.instagram_url || "",
    });

    setTab("teams");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetTeamForm() {
    setEditingId(null);
    setTeamForm(emptyTeamForm);
  }

  async function uploadTeamImage(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Please select an image file.");
      input.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Image must be 5 MB or smaller.");
      input.value = "";
      return;
    }

    setBusy(true);
    setMessage("Uploading team photo...");

    try {
      const safeName = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "-"
      );
      const path = `${crypto.randomUUID()}-${safeName}`;

      const { error } = await supabase.storage
        .from("team-images")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        setMessage("Image upload failed: " + error.message);
        return;
      }

      const { data } = supabase.storage
        .from("team-images")
        .getPublicUrl(path);

      setTeamForm((current) => ({
        ...current,
        image_url: data.publicUrl,
      }));

      setMessage(
        "Photo uploaded. Save the team member to keep the changes."
      );
    } catch {
      setMessage("An unexpected error occurred while uploading.");
    } finally {
      setBusy(false);
      input.value = "";
    }
  }

  async function saveTeamMember(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!teamForm.name.trim() || !teamForm.role_title.trim()) {
      setMessage("Name and position are required.");
      return;
    }

    setBusy(true);

    const payload = {
      name: teamForm.name.trim(),
      role_title: teamForm.role_title.trim(),
      bio: teamForm.bio.trim(),
      image_url: teamForm.image_url.trim() || null,
      section: teamForm.section,
      sort_order: Number(teamForm.sort_order) || 0,
      linkedin_url: teamForm.linkedin_url.trim() || null,
      instagram_url: teamForm.instagram_url.trim() || null,
      updated_at: new Date().toISOString(),
    };

    try {
      const result = editingId
        ? await supabase
            .from("team_members")
            .update(payload)
            .eq("id", editingId)
        : await supabase
            .from("team_members")
            .insert(payload);

      if (result.error) {
        setMessage(
          "Could not save team member: " + result.error.message
        );
        return;
      }

      setMessage(
        editingId
          ? "Team member updated."
          : "Team member added."
      );

      resetTeamForm();
      await loadTeam();
    } catch {
      setMessage("An unexpected error occurred while saving.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleTeamMember(member: TeamMember) {
    const { error } = await supabase
      .from("team_members")
      .update({
        is_active: !member.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id);

    if (error) {
      setMessage("Could not update team member: " + error.message);
      return;
    }

    setMessage(
      member.is_active
        ? "Team member hidden from the public page."
        : "Team member is now visible on the public page."
    );

    await loadTeam();
  }

  async function deleteTeamMember(member: TeamMember) {
    if (
      !window.confirm(
        `Permanently delete ${member.name}? This cannot be undone.`
      )
    ) {
      return;
    }

    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("id", member.id);

    if (error) {
      setMessage("Could not delete team member: " + error.message);
      return;
    }

    if (editingId === member.id) {
      resetTeamForm();
    }

    setMessage("Team member deleted.");
    await loadTeam();
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

  const published = items.filter(
    (item) => item.status === "published"
  );

  const featured = published
    .filter((item) => item.is_featured)
    .sort((a, b) => a.featured_order - b.featured_order);

  return (
    <main className="admin-page">
      <header className="admin-heading">
        <div>
          <p className="eyebrow">
            Economic Policy Lab · Administration
          </p>
          <h1>Editorial dashboard</h1>
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

      <section className="admin-stats">
        <div>
          <span>Total items</span>
          <strong>{items.length}</strong>
        </div>

        <div>
          <span>Pending review</span>
          <strong>
            {items.filter((item) => item.status === "pending").length}
          </strong>
        </div>

        <div>
          <span>Published</span>
          <strong>{published.length}</strong>
        </div>

        <div>
          <span>Highlights</span>
          <strong>{featured.length}</strong>
        </div>
      </section>

      <nav className="editor-tabs" aria-label="Editor sections">
        <button
          type="button"
          className={tab === "articles" ? "editor-tab active" : "editor-tab"}
          onClick={() => setTab("articles")}
        >
          Articles
        </button>

        <button
          type="button"
          className={tab === "highlights" ? "editor-tab active" : "editor-tab"}
          onClick={() => setTab("highlights")}
        >
          Homepage Highlights
        </button>

        <button
          type="button"
          className={tab === "teams" ? "editor-tab active" : "editor-tab"}
          onClick={() => setTab("teams")}
        >
          Our Teams
        </button>
      </nav>

      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}

      {tab === "articles" && (
        <section className="admin-queue">
          <div className="admin-queue-title">
            <h2>Content queue</h2>
            <button
              type="button"
              className="text-button"
              onClick={() => void loadArticles()}
            >
              Refresh
            </button>
          </div>

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
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.content_type || "Article"}</td>
                    <td>{item.title || "Untitled"}</td>
                    <td>{item.author_name || "EPL Member"}</td>
                    <td>
                      <span className="status-pill">
                        {item.status || "draft"}
                      </span>
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <Link
                          className="text-button"
                          to={`/member/write?id=${encodeURIComponent(item.id)}`}
                        >
                          Edit
                        </Link>

                        {item.status === "pending" && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                void changeStatus(item, "published")
                              }
                            >
                              Approve
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void changeStatus(item, "rejected")
                              }
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {item.status === "published" && (
                          <button
                            type="button"
                            onClick={() =>
                              void changeStatus(item, "archived")
                            }
                          >
                            Archive
                          </button>
                        )}

                        {["archived", "rejected"].includes(item.status || "") && (
                          <button
                            type="button"
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
                            onClick={() =>
                              void changeStatus(item, "deleted")
                            }
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {items.length === 0 && (
                  <tr>
                    <td colSpan={5}>No articles found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "highlights" && (
        <section className="admin-queue">
          <div className="admin-queue-title">
            <div>
              <h2>Homepage Highlights</h2>
              <p>
                Select published articles to display in the homepage
                Featured Commentary section.
              </p>
            </div>

            <button
              type="button"
              className="text-button"
              onClick={() => void loadArticles()}
            >
              Refresh
            </button>
          </div>

          <p className="admin-footnote">
            Enable Highlights for an article, then assign its display
            order. A smaller number appears first. Changes are saved
            to Supabase.
          </p>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Contributor</th>
                  <th>Show on homepage</th>
                  <th>Order</th>
                </tr>
              </thead>

              <tbody>
                {published.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title || "Untitled"}</td>
                    <td>{item.author_name || "EPL Member"}</td>
                    <td>
                      <label className="featured-toggle">
                        <input
                          type="checkbox"
                          checked={Boolean(item.is_featured)}
                          onChange={() => void toggleFeatured(item)}
                        />
                        <span>
                          {item.is_featured ? "Featured" : "Not featured"}
                        </span>
                      </label>
                    </td>
                    <td>
                      <input
                        aria-label={`Display order for ${item.title || "article"}`}
                        className="featured-order-input"
                        type="number"
                        min="1"
                        defaultValue={item.featured_order || 1}
                        disabled={!item.is_featured}
                        onBlur={(event) =>
                          void saveFeaturedOrder(item, event.currentTarget.value)
                        }
                      />
                    </td>
                  </tr>
                ))}

                {published.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      No published articles are available for Highlights.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "teams" && (
        <section className="admin-queue">
          <div className="admin-queue-title">
            <div>
              <h2>{editingId ? "Edit team member" : "Add a team member"}</h2>
              <p>
                Manage the people displayed on the public Our Teams page.
              </p>
            </div>

            <Link to="/team" className="text-button">
              View Our Teams
            </Link>
          </div>

          <form className="team-editor-form" onSubmit={saveTeamMember}>
            <label>
              Full name *
              <input
                required
                value={teamForm.name}
                onChange={(event) =>
                  setTeamForm({ ...teamForm, name: event.target.value })
                }
              />
            </label>

            <label>
              Position *
              <input
                required
                value={teamForm.role_title}
                onChange={(event) =>
                  setTeamForm({ ...teamForm, role_title: event.target.value })
                }
                placeholder="e.g. Founder, Overall Head, Research Lead"
              />
            </label>

            <label>
              Team / division
              <select
                value={teamForm.section}
                onChange={(event) =>
                  setTeamForm({
                    ...teamForm,
                    section: event.target.value as "board" | "member",
                  })
                }
              >
                <option value="board">Leadership / Board</option>
                <option value="member">Division / Team member</option>
              </select>
            </label>

            <label>
              Display order
              <input
                type="number"
                value={teamForm.sort_order}
                onChange={(event) =>
                  setTeamForm({
                    ...teamForm,
                    sort_order: Number(event.target.value),
                  })
                }
              />
            </label>

            <label className="team-form-wide">
              Description / biography
              <textarea
                rows={4}
                value={teamForm.bio}
                onChange={(event) =>
                  setTeamForm({ ...teamForm, bio: event.target.value })
                }
                placeholder="Write a short professional description."
              />
            </label>

            <label className="team-form-wide">
              Photo
              <input
                type="file"
                accept="image/*"
                onChange={(event) => void uploadTeamImage(event)}
                disabled={busy}
              />
              <span className="admin-footnote">
                Image files only, maximum 5 MB. Uploading requires admin access.
              </span>
            </label>

            {teamForm.image_url && (
              <div className="team-photo-preview team-form-wide">
                <img src={teamForm.image_url} alt="Team member preview" />

                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setTeamForm({ ...teamForm, image_url: "" })
                  }
                >
                  Remove photo
                </button>
              </div>
            )}

            <label>
              LinkedIn URL (optional)
              <input
                type="url"
                value={teamForm.linkedin_url}
                onChange={(event) =>
                  setTeamForm({
                    ...teamForm,
                    linkedin_url: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Instagram URL (optional)
              <input
                type="url"
                value={teamForm.instagram_url}
                onChange={(event) =>
                  setTeamForm({
                    ...teamForm,
                    instagram_url: event.target.value,
                  })
                }
              />
            </label>

            <div className="team-form-actions team-form-wide">
              <button
                type="submit"
                className="epl-button"
                disabled={busy}
              >
                {busy
                  ? "Saving..."
                  : editingId
                    ? "Save changes"
                    : "Add team member"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="text-button"
                  onClick={resetTeamForm}
                >
                  Cancel editing
                </button>
              )}
            </div>
          </form>

          <div className="admin-queue-title team-list-heading">
            <h2>Existing team members</h2>

            <button
              type="button"
              className="text-button"
              onClick={() => void loadTeam()}
            >
              Refresh
            </button>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Division</th>
                  <th>Visibility</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {team.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="team-admin-person">
                        {member.image_url && (
                          <img src={member.image_url} alt="" />
                        )}

                        <div>
                          <strong>{member.name}</strong>
                          <span>{member.role_title}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      {member.section === "board" ? "Leadership" : "Division"}
                    </td>

                    <td>{member.is_active ? "Visible" : "Hidden"}</td>

                    <td>
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          onClick={() => editTeamMember(member)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => void toggleTeamMember(member)}
                        >
                          {member.is_active ? "Hide" : "Show"}
                        </button>

                        <button
                          type="button"
                          className="danger-action"
                          onClick={() => void deleteTeamMember(member)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {team.length === 0 && (
                  <tr>
                    <td colSpan={4}>No team members have been added yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="admin-footnote">
        Administrator permissions are checked against Supabase profiles.role.
        Row-level security must remain enabled in the database.
      </p>
    </main>
  );
}
