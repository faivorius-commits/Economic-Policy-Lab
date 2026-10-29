
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

const MAX_COVER_SIZE = 5 * 1024 * 1024;

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
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [publishedAt, setPublishedAt] = useState("");
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
        setMessage(
          "Could not verify your account permissions."
        );
        return;
      }

      const admin =
        profile?.role === "admin" ||
        session.user.email?.trim().toLowerCase() ===
          "members@economicpolicylab.org";

      setUserId(session.user.id);
      setIsAdmin(admin);

      if (id) {
        let query = supabase
          .from("articles")
          .select("*")
          .eq("id", id);

        if (!admin) {
          query = query.eq(
            "author_id",
            session.user.id
          );
        }

        const { data, error } =
          await query.maybeSingle();

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

        setPublishedAt(
          data.published_at
            ? new Date(data.published_at)
                .toISOString()
                .slice(0, 16)
            : ""
        );

        setBody(data.content || "");

        setOriginalStatus(
          (data.status || "draft") as ArticleStatus
        );
      } else {
        setAuthor(
          profile?.display_name ||
            session.user.email ||
            ""
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

  async function uploadCover() {
    if (!coverFile) {
      setMessage(
        "Please choose an image from your device first."
      );
      return;
    }

    if (!coverFile.type.startsWith("image/")) {
      setMessage("The cover must be an image file.");
      return;
    }

    if (coverFile.size > MAX_COVER_SIZE) {
      setMessage(
        "Image is too large. Please choose an image under 5 MB."
      );
      return;
    }

    setUploadingCover(true);
    setMessage("");

    try {
      const extension =
        coverFile.name.split(".").pop()?.toLowerCase() ||
        "jpg";

      const safeExtension =
        /^[a-z0-9]+$/.test(extension)
          ? extension
          : "jpg";

      const filePath =
        `${userId}/${Date.now()}-cover.${safeExtension}`;

      const { data, error } = await supabase.storage
        .from("article-covers")
        .upload(filePath, coverFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: coverFile.type,
        });

      if (error) throw error;

      const { data: publicUrlData } =
        supabase.storage
          .from("article-covers")
          .getPublicUrl(data.path);

      setCover(publicUrlData.publicUrl);
      setCoverFile(null);
      setMessage(
        "Cover uploaded. Save the article to keep the image attached."
      );
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : "Unknown upload error";

      setMessage(
        `Could not upload cover: ${detail}. Check that the article-covers bucket exists and upload permissions are configured.`
      );
    } finally {
      setUploadingCover(false);
    }
  }

  async function save(mode: "draft" | "pending") {
    if (!author.trim() || !title.trim() || !body.trim()) {
      setMessage(
        "Please enter an author name, title, and body."
      );
      return;
    }

    setBusy(true);
    setMessage("");

    const payload = {
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
      ...(isAdmin
        ? {
            published_at: publishedAt
              ? new Date(publishedAt).toISOString()
              : null,
          }
        : {}),
    };

    const result = id
      ? await (
          isAdmin
            ? supabase
                .from("articles")
                .update(payload)
                .eq("id", id)
            : supabase
                .from("articles")
                .update(payload)
                .eq("id", id)
                .eq("author_id", userId)
        )
      : await supabase
          .from("articles")
          .insert(payload)
          .select("id")
          .single();

    setBusy(false);

    if (result.error) {
      setMessage(
        "Could not save article: " +
          result.error.message
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

    if (
      !id &&
      result.data &&
      "id" in result.data
    ) {
      navigate(
        "/member/write?id=" +
          encodeURIComponent(result.data.id),
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
            ←{" "}
            {isAdmin
              ? "Admin dashboard"
              : "Member workspace"}
          </Link>

          <p className="eyebrow">
            Economic Policy Lab
          </p>

          <h1>
            {id
              ? "Edit article"
              : isAdmin
                ? "Create an article"
                : "Create a submission"}
          </h1>

          <p>
            {isAdmin
              ? "Administrator editing mode."
              : "Prepare your work for editorial review."}
          </p>
        </div>
      </header>

      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}

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
              onChange={(event) =>
                setType(event.target.value)
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
              onChange={(event) =>
                setAuthor(event.target.value)
              }
            />
          </label>

          <label>
            Title

            <input
              required
              maxLength={240}
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
            />
          </label>

          <label>
            Abstract / excerpt

            <textarea
              rows={3}
              value={excerpt}
              onChange={(event) =>
                setExcerpt(event.target.value)
              }
              placeholder="Write a short summary of your article..."
            />
          </label>

          <div className="member-cover-upload">
            <label htmlFor="cover-file">
              Cover image from device
            </label>

            <input
              id="cover-file"
              type="file"
              accept="image/*"
              onChange={(event) =>
                setCoverFile(
                  event.target.files?.[0] || null
                )
              }
            />

            <small>
              Choose an image from your phone gallery.
              Maximum size: 5 MB.
            </small>

            {coverFile && (
              <p className="cover-file-name">
                Selected: {coverFile.name}
              </p>
            )}

            <button
              type="button"
              className="text-button"
              disabled={!coverFile || uploadingCover}
              onClick={() => void uploadCover()}
            >
              {uploadingCover
                ? "Uploading image..."
                : "Upload cover image"}
            </button>

            {cover && (
              <div className="member-cover-preview">
                <p>Cover preview</p>

                <img
                  src={cover}
                  alt="Article cover preview"
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.style.display =
                      "none";
                  }}
                />

                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setCover("");
                    setCoverFile(null);
                  }}
                >
                  Remove cover
                </button>
              </div>
            )}
          </div>

          <label>
            Category

            <input
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
              placeholder="e.g. Economy, Environment, Public Policy"
            />
          </label>

          {isAdmin && (
            <label className="member-form-wide">
              Publication date &amp; time

              <input
                type="datetime-local"
                name="published_at"
                value={publishedAt}
                onChange={(event) =>
                  setPublishedAt(event.target.value)
                }
              />

              <small>
                Choose the publication date and time.
                Leave blank to clear the publication date.
              </small>
            </label>
          )}

          <div className="member-body-field">
            <label>Body</label>

            <RichTextEditor
              value={body}
              onChange={setBody}
              label="Article content"
            />
          </div>
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
                disabled={busy || uploadingCover}
                onClick={() => void save("draft")}
              >
                {busy ? "Saving..." : "Save draft"}
              </button>
            )}

            <button
              className="epl-button"
              disabled={busy || uploadingCover}
              type="submit"
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

