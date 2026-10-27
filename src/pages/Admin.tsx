import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Article = { id: string | number; title: string | null; author_name: string | null; content_type: string | null; status: string | null; updated_at: string | null; created_at: string | null };
export default function Admin() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Article[]>([]);
  const [identity, setIdentity] = useState("");
  const [message, setMessage] = useState("Verifying administrator access…");
  const [ready, setReady] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await supabase.from("articles").select("id,title,author_name,content_type,status,updated_at,created_at").order("updated_at", { ascending: false });
    if (error) { setMessage("Could not load the editorial queue: " + error.message); return; }
    setItems((data ?? []) as Article[]); setMessage("");
  }, []);
  useEffect(() => {
    let active = true;
    async function init() {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) { navigate("/login", { replace: true }); return; }
      const { data: profile, error: profileError } = await supabase.from("profiles").select("role,display_name").eq("id", session.user.id).maybeSingle();
      if (!active) return;
      if (profileError || profile?.role !== "admin") { navigate("/login", { replace: true }); return; }
      setIdentity(profile.display_name || session.user.email || "Administrator"); setReady(true); await load();
    }
    void init();
    return () => { active = false; };
  }, [navigate, load]);
  async function changeStatus(item: Article, status: string) {
    if (status === "deleted" && !window.confirm("Permanently delete this item?")) return;
    const result = status === "deleted"
      ? await supabase.from("articles").delete().eq("id", item.id)
      : await supabase.from("articles").update({ status, updated_at: new Date().toISOString(), ...(status === "published" ? { published_at: new Date().toISOString() } : {}) }).eq("id", item.id);
    if (result.error) { setMessage(result.error.message); return; }
    setMessage("Content updated."); await load();
  }
  async function logout() { await supabase.auth.signOut(); navigate("/login", { replace: true }); }
  if (!ready) return <main className="admin-page"><p>{message}</p></main>;
  return <main 
           className="admin-page"><header 
          className="admin-heading"><div><p 
         className="eyebrow">Economic Policy Lab · Administration</p><h1>Editorial dashboard</h1><p>Signed in as {identity}</p></div>
        <div className="admin-actions"><Link className="text-button" to="/">View website</Link><Link 
      className="epl-button" to="/editor">＋ Create publication</Link><button className="epl-button" onClick={logout}>Log out</button></div></header>
    <section className="admin-stats"><div><span>Total items</span><strong>{items.length}</strong></div><div><span>Pending review</span><strong>{items.filter(x=>x.status==="pending").length}</strong></div><div><span>Published</span><strong>{items.filter(x=>x.status==="published").length}</strong></div></section>
    {message && <p className="form-message" role="status">{message}</p>}
    <section className="admin-queue"><div className="admin-queue-title"><h2>Content queue</h2><button className="text-button" onClick={()=>void load()}>Refresh</button></div>
    {items.length===0 && !message ? <p>No content found.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Type</th><th>Title</th><th>Contributor</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{item.content_type || "Article"}</td><td><Link to={"/editor/" + encodeURIComponent(String(item.id))}>{item.title || "Untitled"} · Edit</Link></td><td>{item.author_name || "EPL Member"}</td><td><span className="status-pill">{item.status || "draft"}</span></td><td><div className="admin-row-actions">{item.status==="pending" && <><button onClick={()=>void changeStatus(item,"published")}>Approve</button><button onClick={()=>void changeStatus(item,"rejected")}>Reject</button></>}{item.status==="published" && <button onClick={()=>void changeStatus(item,"archived")}>Archive</button>}{["archived","rejected"].includes(item.status || "") && <button onClick={()=>void changeStatus(item,"draft")}>Restore</button>}{item.status!=="published" && <button className="danger-action" onClick={()=>void changeStatus(item,"deleted")}>Delete</button>}</div></td></tr>)}</tbody></table></div>}
    </section><p className="admin-footnote">Access is checked against the Supabase <code>profiles.role</code> value. Database row-level security must also protect admin-only updates and deletes.</p>
  </main>;
}
