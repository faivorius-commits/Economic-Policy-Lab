import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type ResearchItem = {
  id: string;
  title: string;
  category: string | null;
  author_name: string | null;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  created_at: string;
};

const PAGE_SIZE = 6;

export default function Research() {
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [filter, setFilter] = useState("All Research");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadResearch() {
      setLoading(true);
      setMessage("");

      const { data, error } = await supabase
        .from("articles")
        .select(
          "id,title,category,author_name,excerpt,cover_image_url,published_at,created_at"
        )
        .eq("content_type", "research")
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (!active) return;

      if (error) {
        setMessage("Unable to load research: " + error.message);
        setItems([]);
      } else {
        setItems((data ?? []) as ResearchItem[]);
      }

      setLoading(false);
    }

    void loadResearch();

    return () => {
      active = false;
    };
  }, []);

  const filters = useMemo(() => {
    const categories = Array.from(
      new Set(
        items
          .map((item) => item.category?.trim())
          .filter((category): category is string => Boolean(category))
      )
    );

    return ["All Research", ...categories];
  }, [items]);

  const filteredItems = useMemo(() => {
    if (filter === "All Research") return items;

    return items.filter((item) => item.category === filter);
  }, [filter, items]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredItems.length / PAGE_SIZE)
  );

  const visibleItems = filteredItems.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  function changeFilter(value: string) {
    setFilter(value);
    setPage(1);
  }

  function formatDate(value: string | null, fallback: string) {
    const date = value || fallback;

    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  return (
    <main className="research-page">
      <section className="research-intro">
        <p className="eyebrow">Economic Policy Lab</p>
        <h1>Research Archive</h1>
        <p className="research-description">
          Exploring economic challenges through rigorous research
          and evidence-based policy analysis.
        </p>
      </section>

      <div className="research-toolbar">
        <div
          className="research-filters"
          aria-label="Filter research"
        >
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              className={
                filter === item
                  ? "research-filter selected"
                  : "research-filter"
              }
              aria-pressed={filter === item}
              onClick={() => changeFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <p className="research-count">
          {filteredItems.length}{" "}
          {filteredItems.length === 1
            ? "publication"
            : "publications"}
        </p>
      </div>

      {loading && (
        <p className="status-message">Loading research...</p>
      )}

      {!loading && message && (
        <p className="status-message" role="alert">
          {message}
        </p>
      )}

      {!loading && !message && visibleItems.length > 0 && (
        <section
          className="research-list"
          aria-label="Research publications"
        >
          {visibleItems.map((item) => (
            <article className="research-card" key={item.id}>
              {item.cover_image_url && (
                <img
                  className="research-cover"
                  src={item.cover_image_url}
                  alt=""
                  loading="lazy"
                />
              )}

              <div className="research-card-body">
                <div className="research-meta">
                  <span>{item.category || "Research"}</span>
                  <span>
                    {formatDate(
                      item.published_at,
                      item.created_at
                    )}
                  </span>
                </div>

                <h2>{item.title}</h2>

                <p className="research-authors">
                  {item.author_name || "EPL Research Group"}
                </p>

                {item.excerpt && (
                  <p className="research-summary">
                    {item.excerpt}
                  </p>
                )}

                <div className="research-actions">
                  <Link
                    className="research-button research-button-dark"
                    to={`/content?id=${encodeURIComponent(item.id)}`}
                  >
                    Read Research
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {!loading && !message && visibleItems.length === 0 && (
        <p className="status-message">
          No published research found in this category.
        </p>
      )}

      {pageCount > 1 && (
        <nav
          className="research-pagination"
          aria-label="Research pages"
        >
          <button
            type="button"
            onClick={() =>
              setPage((current) => Math.max(1, current - 1))
            }
            disabled={page === 1}
          >
            Previous
          </button>

          {Array.from(
            { length: pageCount },
            (_, index) => index + 1
          ).map((number) => (
            <button
              key={number}
              type="button"
              className={page === number ? "current" : ""}
              aria-current={
                page === number ? "page" : undefined
              }
              onClick={() => setPage(number)}
            >
              {number}
            </button>
          ))}

          <button
            type="button"
            onClick={() =>
              setPage((current) =>
                Math.min(pageCount, current + 1)
              )
            }
            disabled={page === pageCount}
          >
            Next
          </button>
        </nav>
      )}
    </main>
  );
}
