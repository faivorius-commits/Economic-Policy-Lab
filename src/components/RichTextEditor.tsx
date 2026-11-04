
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { supabase } from "../lib/supabase";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  label?: string;
};

const blue = "#24558a";

const iconButton: CSSProperties = {
  width: 29,
  height: 29,
  minWidth: 29,
  padding: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #e0e5ed",
  borderRadius: 5,
  background: "#fff",
  color: "#34465b",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  touchAction: "manipulation",
};

const topButton: CSSProperties = {
  ...iconButton,
  width: "auto",
  minWidth: 29,
  padding: "0 7px",
};

const activeStyle: CSSProperties = {
  background: "#e8f1fc",
  color: blue,
  borderColor: "#9bbce0",
};

const separator: CSSProperties = {
  width: 18,
  height: 1,
  background: "#dce3ec",
  margin: "3px 0",
  flexShrink: 0,
};

export default function RichTextEditor({
  value,
  onChange,
  label = "Article content",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);

  const [wordCount, setWordCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [active, setActive] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const editor = editorRef.current;

    if (editor && editor.innerHTML !== (value || "")) {
      editor.innerHTML = value || "";
    }

    const temp = document.createElement("div");
    temp.innerHTML = value || "";
    const text = temp.textContent || "";

    setWordCount(
      text.trim() ? text.trim().split(/\s+/).length : 0
    );
  }, [value]);

  function updateContent() {
    const editor = editorRef.current;
    if (!editor) return;

    onChange(editor.innerHTML);

    const text = editor.innerText || "";
    setWordCount(
      text.trim() ? text.trim().split(/\s+/).length : 0
    );
  }

  function rememberSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);

    if (editor.contains(range.commonAncestorContainer)) {
      savedRange.current = range.cloneRange();
    }
  }

  function restoreSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection) return;

    editor.focus({ preventScroll: true });

    if (!savedRange.current) return;

    try {
      if (
        !editor.contains(
          savedRange.current.commonAncestorContainer
        )
      ) {
        savedRange.current = null;
        return;
      }

      selection.removeAllRanges();
      selection.addRange(savedRange.current);
    } catch {
      savedRange.current = null;
    }
  }

  function refreshToolbar() {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);

    if (!editor.contains(range.commonAncestorContainer)) return;

    const commands = [
      "bold",
      "italic",
      "underline",
      "strikeThrough",
      "insertUnorderedList",
      "insertOrderedList",
      "justifyLeft",
      "justifyCenter",
      "justifyRight",
      "justifyFull",
    ];

    const formats: Record<string, boolean> = {};

    commands.forEach((command) => {
      try {
        formats[command] = document.queryCommandState(command);
      } catch {
        formats[command] = false;
      }
    });

    const node =
      range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : (range.startContainer as HTMLElement);

    const block = node?.closest("p, div, h2, h3, blockquote");

    formats.p =
      block?.tagName === "P" || block?.tagName === "DIV";
    formats.h2 = block?.tagName === "H2";
    formats.h3 = block?.tagName === "H3";
    formats.blockquote = block?.tagName === "BLOCKQUOTE";

    setActive(formats);
  }

  useEffect(() => {
    document.addEventListener("selectionchange", refreshToolbar);
    return () =>
      document.removeEventListener("selectionchange", refreshToolbar);
  }, []);

  function runCommand(command: string, argument?: string) {
    if (!editorRef.current) return;

    restoreSelection();

    try {
      document.execCommand("styleWithCSS", false, "false");
    } catch {
      // Continue
    }

    const value =
      command === "formatBlock" && argument
        ? `<${argument}>`
        : argument;

    try {
      document.execCommand(command, false, value);
    } catch (error) {
      console.error(error);
    }

    updateContent();
    rememberSelection();
    refreshToolbar();
  }

  function block(format: "p" | "h2" | "h3" | "blockquote") {
    runCommand("formatBlock", format);
  }

  function alignment(
    format: "Left" | "Center" | "Right" | "Full"
  ) {
    const commands: Record<string, string> = {
      Left: "justifyLeft",
      Center: "justifyCenter",
      Right: "justifyRight",
      Full: "justifyFull",
    };

    runCommand(commands[format]);
  }

  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    rememberSelection();
    event.preventDefault();
  }

  function button(
    title: string,
    command: string,
    symbol: string,
    extra?: CSSProperties
  ) {
    const isActive = Boolean(active[command]);

    return (
      <button
        key={command}
        type="button"
        title={title}
        aria-label={title}
        aria-pressed={isActive}
        style={{
          ...iconButton,
          ...extra,
          ...(isActive ? activeStyle : {}),
        }}
        onPointerDown={pointerDown}
        onClick={() => runCommand(command)}
      >
        {symbol}
      </button>
    );
  }

  function blockButton(
    title: string,
    format: "p" | "h2" | "h3"
  ) {
    return (
      <button
        key={format}
        type="button"
        title={title}
        aria-label={title}
        aria-pressed={Boolean(active[format])}
        style={{
          ...topButton,
          ...(active[format] ? activeStyle : {}),
        }}
        onPointerDown={pointerDown}
        onClick={() => block(format)}
      >
        {format === "p" ? "P" : format.toUpperCase()}
      </button>
    );
  }

  function insertLink() {
    restoreSelection();

    const url = window.prompt("Enter website URL:", "https://");
    if (!url) return;

    const clean = url.trim();

    if (
      !clean.startsWith("https://") &&
      !clean.startsWith("http://") &&
      !clean.startsWith("mailto:")
    ) {
      setMessage("Please enter a valid URL.");
      return;
    }

    runCommand("createLink", clean);
  }

  function clearFormatting() {
    restoreSelection();
    document.execCommand("removeFormat", false);
    document.execCommand("unlink", false);
    updateContent();
    rememberSelection();
    refreshToolbar();
  }

  async function uploadImage(file: File) {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (!allowed.includes(file.type)) {
      setMessage("Use JPG, PNG, WEBP, or GIF.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Image must be 5 MB or smaller.");
      return;
    }

    setUploading(true);
    setMessage("Uploading image...");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please sign in before uploading.");
      }

      const safeName = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "-"
      );

      const path = `${user.id}/${Date.now()}-${safeName}`;

      const { error } = await supabase.storage
        .from("article-images")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (error) throw error;

      const { data } = supabase.storage
        .from("article-images")
        .getPublicUrl(path);

      restoreSelection();

      const figure = document.createElement("figure");
      figure.style.cssText = "margin:26px 0;text-align:center;";

      const img = document.createElement("img");
      img.src = data.publicUrl;
      img.alt = "Supporting article image";
      img.loading = "lazy";
      img.style.cssText =
        "display:block;width:100%;max-width:760px;height:auto;margin:0 auto;border-radius:8px;";

      const caption = document.createElement("figcaption");
      caption.textContent = "Write an image caption or source here.";
      caption.style.cssText =
        "margin-top:9px;font-size:13px;color:#687386;";

      figure.append(img, caption);

      const paragraph = document.createElement("p");
      paragraph.appendChild(document.createElement("br"));

      const selection = window.getSelection();

      if (selection?.rangeCount) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(figure);
        figure.after(paragraph);
      } else {
        editorRef.current?.append(figure, paragraph);
      }

      updateContent();
      rememberSelection();
      setMessage("Image inserted successfully.");
    } catch (error) {
      setMessage(
        "Could not upload image: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const errorMessage =
    message.startsWith("Could not") ||
    message.startsWith("Please") ||
    message.startsWith("Use") ||
    message.startsWith("Image must");

  return (
    <div className="epl-editor" style={{ width: "100%", minWidth: 0 }}>
      {/* TOP TOOLBAR */}
      <div
        role="toolbar"
        aria-label="Text formatting"
        className="epl-editor-top"
        style={{
          position: "sticky",
          top: 4,
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 4,
          padding: "5px 7px",
          marginBottom: 7,
          border: "1px solid #e0e5ed",
          borderRadius: 7,
          background: "rgba(250,252,255,.97)",
          backdropFilter: "blur(10px)",
        }}
      >
        <button
          type="button"
          title="Undo"
          aria-label="Undo"
          style={iconButton}
          onPointerDown={pointerDown}
          onClick={() => runCommand("undo")}
        >
          ↶
        </button>

        <button
          type="button"
          title="Redo"
          aria-label="Redo"
          style={iconButton}
          onPointerDown={pointerDown}
          onClick={() => runCommand("redo")}
        >
          ↷
        </button>

        {blockButton("Paragraph", "p")}
        {blockButton("Heading 2", "h2")}
        {blockButton("Heading 3", "h3")}

        {button("Bold", "bold", "B", { fontWeight: 900 })}
        {button("Italic", "italic", "I", { fontStyle: "italic" })}
        {button("Underline", "underline", "U", {
          textDecoration: "underline",
        })}
      </div>

      {message && (
        <p
          role="status"
          style={{
            fontSize: 12,
            padding: "7px 10px",
            borderRadius: 6,
            background: errorMessage ? "#fff1f0" : "#edf7f1",
            color: errorMessage ? "#b42318" : "#315b46",
          }}
        >
          {message}
        </p>
      )}

      {/* FULL WIDTH WRITING WORKSPACE */}
      <div
        className="epl-editor-workspace"
        style={{
          display: "grid",
          gridTemplateColumns: "30px minmax(0, 1fr) 30px",
          gap: 3,
          width: "100%",
          minWidth: 0,
          alignItems: "start",
        }}
      >
        {/* LEFT TOOLS */}
        <aside
          className="epl-editor-side"
          role="toolbar"
          aria-label="Alignment and list tools"
          style={{
            position: "sticky",
            top: 49,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            padding: "3px 0",
            zIndex: 20,
          }}
        >
          {button("Align left", "justifyLeft", "≡")}
          {button("Align center", "justifyCenter", "☰")}
          {button("Align right", "justifyRight", "≡", {
            transform: "scaleX(-1)",
          })}
          {button("Justify", "justifyFull", "▤")}

          <span style={separator} />

          {button("Bullet list", "insertUnorderedList", "•")}
          {button("Numbered list", "insertOrderedList", "1")}

          <span style={separator} />

          {button("Indent", "indent", "→")}
          {button("Outdent", "outdent", "←")}
        </aside>

        {/* CENTER */}
        <main
          className="epl-writing-column"
          style={{
            width: "100%",
            minWidth: 0,
          }}
        >
          <div
            ref={editorRef}
            className="article-rich-content epl-writing-field"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label={label}
            aria-multiline="true"
            data-placeholder="Start writing your article here..."
            onKeyUp={() => {
              rememberSelection();
              refreshToolbar();
            }}
            onPointerUp={() => {
              rememberSelection();
              refreshToolbar();
            }}
            onFocus={refreshToolbar}
            onInput={() => {
              updateContent();
              rememberSelection();
              refreshToolbar();
            }}
            onBlur={() => {
              updateContent();
              rememberSelection();
            }}
            style={{
              display: "block",
              width: "100%",
              minWidth: 0,
              minHeight: 680,
              boxSizing: "border-box",
              padding: "32px clamp(12px, 3vw, 38px)",
              border: "1px solid #e0e5ed",
              borderRadius: 7,
              outline: "none",
              background: "#fff",
              color: "#26364a",
              fontSize: 16,
              lineHeight: 1.85,
              overflowWrap: "anywhere",
            }}
          />
        </main>

        {/* RIGHT TOOLS */}
        <aside
          className="epl-editor-side"
          role="toolbar"
          aria-label="Insert tools"
          style={{
            position: "sticky",
            top: 49,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            padding: "3px 0",
            zIndex: 20,
          }}
        >
          <button
            type="button"
            title="Insert link"
            aria-label="Insert link"
            style={iconButton}
            onPointerDown={pointerDown}
            onClick={insertLink}
          >
            ↗
          </button>

          <button
            type="button"
            title="Insert image"
            aria-label="Insert image"
            disabled={uploading}
            style={iconButton}
            onPointerDown={pointerDown}
            onClick={() => fileInputRef.current?.click()}
          >
            ▧
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadImage(file);
            }}
          />

          <span style={separator} />

          <button
            type="button"
            title="Blockquote"
            aria-label="Blockquote"
            aria-pressed={Boolean(active.blockquote)}
            style={{
              ...iconButton,
              ...(active.blockquote ? activeStyle : {}),
            }}
            onPointerDown={pointerDown}
            onClick={() => block("blockquote")}
          >
            ❞
          </button>

          {button("Strikethrough", "strikeThrough", "S", {
            textDecoration: "line-through",
          })}

          <span style={separator} />

          <button
            type="button"
            title="Horizontal divider"
            aria-label="Horizontal divider"
            style={iconButton}
            onPointerDown={pointerDown}
            onClick={() => runCommand("insertHorizontalRule")}
          >
            —
          </button>

          <button
            type="button"
            title="Clear formatting"
            aria-label="Clear formatting"
            style={{ ...iconButton, color: "#b54747" }}
            onPointerDown={pointerDown}
            onClick={clearFormatting}
          >
            Tx
          </button>
        </aside>
      </div>

      {/* BOTTOM STATUS */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 15,
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          padding: "8px 10px",
          marginTop: 7,
          border: "1px solid #e0e5ed",
          borderRadius: 6,
          background: "rgba(250,252,255,.97)",
          color: "#718096",
          fontSize: 11,
        }}
      >
        <span>{wordCount} words</span>
        <span>{uploading ? "Uploading..." : "Ready"}</span>
      </div>
    </div>
  );
}
