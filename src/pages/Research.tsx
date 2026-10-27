
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type ResearchItem = {
  id: string;
  title: string | null;
  author_name: string | null;
  excerpt: string | null;
  content: string | null;
  category: string | null;
  cover_image_url: string | null;
  published_at: string | null;
};

export default function Research() {
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadResearch() {
      const { data, error } = await supabase
        .from("articles")
        .select(
          "id,title,author_name,excerpt,content,category,cover_image_url,published_at"
        )
        .eq("content_type", "research")
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (error) {
        setError("Research publications could not be loaded.");
      } else {
        setItems((data ?? []) as ResearchItem[]);
      }

      setLoading(false);
    }

    void loadResearch();
  }, []);

  return (
    <main className="research-page">
      <section className="research-hero">
        <p className="eyebrow">ECONOMIC POLICY LAB</p>
        <h1>Research & Analysis</h1>
        <p>
          Exploring economic policy, public institutions, and
          evidence-based approaches to sustainable development.
        </p>
      </section>

      {loading && <p>Loading research...</p>}

      {!loading && error && (
        <p role="alert">{error}</p>
      )}

      {!loading && !error && items.length === 0 && (
        <section className="research-empty">
          <h2>No published research yet</h2>
          <p>
            Research publications will appear here once an
            administrator publishes them.
          </p>
        </section>
      )}

      <section className="research-grid">
        {items.map((item) => (
          <article className="research-card" key={item.id}>
            {item.cover_image_url && (
              <img
                src={item.cover_image_url}
                alt=""
                className="research-cover"
                loading="lazy"
              />
            )}

            <div className="research-card-body">
              {item.category && (
                <span className="research-category">
                  {item.category}
                </span>
              )}

              <h2>{item.title || "Untitled Research"}</h2>

              <p className="research-author">
                {item.author_name || "Economic Policy Lab"}
              </p>

              <p>
                {item.excerpt ||
                  item.content?.slice(0, 180) ||
                  "Research publication"}
              </p>

              <Link
                className="research-read-link"
                to={`/research/${item.id}`}
              >
                Explore research →
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
