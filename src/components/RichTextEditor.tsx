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

const baseButton: CSSProperties = {
  width: 36,
  height: 36,
  minWidth: 36,
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #dce3ec",
  borderRadius: 7,
  background: "#ffffff",
  color: "#33465d",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  touchAction: "manipulation",
};

const activeButton: CSSProperties = {
  background: "#e5effb",
  borderColor: "#78a6d5",
  color: blue,
};

const topButton: CSSProperties = {
  ...baseButton,
  width: "auto",
  padding: "0 10px",
  fontSize: 12,
};

const sideStyle: CSSProperties = {
  position: "sticky",
  top: 75,
  alignSelf: "start",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 7,
  padding: "9px 5px",
  border: "1px solid #e0e6ee",
  borderRadius: 10,
  background: "rgba(248, 251, 255, 0.97)",
  boxShadow: "0 3px 12px rgba(25, 55, 90, 0.05)",
  zIndex: 10,
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
  const [activeFormats, setActiveFormats] = useState<
    Record<string, boolean>
  >({});

  // Sync content from parent
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

  // Update editor content
  function updateContent() {
    const editor = editorRef.current;
    if (!editor) return;

    onChange(editor.innerHTML);

    const text = editor.innerText || "";

    setWordCount(
      text.trim() ? text.trim().split(/\s+/).length : 0
    );
  }

  // Remember text selection
  function rememberSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (
      !editor ||
      !selection ||
      selection.rangeCount === 0
    ) {
      return;
    }

    const range = selection.getRangeAt(0);

    if (editor.contains(range.commonAncestorContainer)) {
      savedRange.current = range.cloneRange();
    }
  }

  // Restore text selection
  function restoreSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection) return false;

    editor.focus({ preventScroll: true });

    if (!savedRange.current) return false;

    try {
      if (
        !editor.contains(
          savedRange.current.commonAncestorContainer
        )
      ) {
        savedRange.current = null;
        return false;
      }

      selection.removeAllRanges();
      selection.addRange(savedRange.current);

      return true;
    } catch {
      savedRange.current = null;
      return false;
    }
  }

  // Detect active formatting
  function refreshToolbarState() {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);

    if (!editor.contains(range.commonAncestorContainer)) {
      return;
    }

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

    const block = node?.closest(
      "p, div, h2, h3, blockquote"
    );

    formats.p =
      block?.tagName === "P" || block?.tagName === "DIV";
    formats.h2 = block?.tagName === "H2";
    formats.h3 = block?.tagName === "H3";
    formats.blockquote = block?.tagName === "BLOCKQUOTE";

    setActiveFormats(formats);
  }

  useEffect(() => {
    const handleSelectionChange = () => {
      refreshToolbarState();
    };

    document.addEventListener(
      "selectionchange",
      handleSelectionChange
    );

    return () => {
      document.removeEventListener(
        "selectionchange",
        handleSelectionChange
      );
    };
  }, []);

  // Execute formatting commands
  function runCommand(
    command: string,
    argument?: string
  ) {
    const editor = editorRef.current;
    if (!editor) return;

    restoreSelection();

    try {
      document.execCommand(
        "styleWithCSS",
        false,
        "false"
      );
    } catch {
      // Continue
    }

    const commandArgument =
      command === "formatBlock" && argument
        ? `<${argument}>`
        : argument;

    try {
      document.execCommand(
        command,
        false,
        commandArgument
      );
    } catch (error) {
      console.error("Formatting error:", error);
    }

    updateContent();
    rememberSelection();
    refreshToolbarState();
  }

  function applyBlock(
    format: "p" | "h2" | "h3" | "blockquote"
  ) {
    runCommand("formatBlock", format);
  }

  function applyAlignment(
    alignment: "Left" | "Center" | "Right" | "Full"
  ) {
    const commands: Record<string, string> = {
      Left: "justifyLeft",
      Center: "justifyCenter",
      Right: "justifyRight",
      Full: "justifyFull",
    };

    runCommand(commands[alignment]);
  }

  function handleToolbarPointerDown(
    event: PointerEvent<HTMLButtonElement>
  ) {
    rememberSelection();
    event.preventDefault();
  }

  // Reusable small toolbar button
  function tool(
    title: string,
    command: string,
    symbol: string,
    style?: CSSProperties
  ) {
    const active = Boolean(activeFormats[command]);

    return (
      <button
        key={command}
        type="button"
        title={title}
        aria-label={title}
        aria-pressed={active}
        style={{
          ...baseButton,
          ...style,
          ...(active ? activeButton : {}),
        }}
        onPointerDown={handleToolbarPointerDown}
        onClick={() => runCommand(command)}
      >
        {symbol}
      </button>
    );
  }

  function blockTool(
    title: string,
    format: "p" | "h2" | "h3"
  ) {
    const active = Boolean(activeFormats[format]);

    return (
      <button
        key={format}
        type="button"
        title={title}
        aria-label={title}
        aria-pressed={active}
        style={{
          ...topButton,
          ...(active ? activeButton : {}),
        }}
        onPointerDown={handleToolbarPointerDown}
        onClick={() => applyBlock(format)}
      >
        {format === "p" ? "P" : format.toUpperCase()}
      </button>
    );
  }

  // Insert hyperlink
  function insertLink() {
    restoreSelection();

    const url = window.prompt(
      "Enter website URL:",
      "https://"
    );

    if (!url) return;

    const trimmed = url.trim();

    if (
      !trimmed.startsWith("https://") &&
      !trimmed.startsWith("http://") &&
      !trimmed.startsWith("mailto:")
    ) {
      setMessage("Please enter a valid URL.");
      return;
    }

    runCommand("createLink", trimmed);
  }

  // Remove formatting
  function clearFormatting() {
    restoreSelection();

    document.execCommand("removeFormat", false);
    document.execCommand("unlink", false);

    updateContent();
    rememberSelection();
    refreshToolbarState();
  }

  // Upload supporting image to Supabase
  async function uploadSupportingImage(file: File) {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (!allowedTypes.includes(file.type)) {
      setMessage("Use JPG, PNG, WEBP, or GIF images.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("The image must be 5 MB or smaller.");
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
        throw new Error(
          "Please sign in before uploading an image."
        );
      }

      const safeName = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "-"
      );

      const filePath =
        `${user.id}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("article-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("article-images")
        .getPublicUrl(filePath);

      restoreSelection();

      const figure = document.createElement("figure");
      figure.style.cssText =
        "margin:28px 0;text-align:center;";

      const image = document.createElement("img");
      image.src = data.publicUrl;
      image.alt = "Supporting article image";
      image.loading = "lazy";
      image.style.cssText =
        "display:block;width:100%;max-width:760px;height:auto;margin:0 auto;border-radius:8px;";

      const caption = document.createElement("figcaption");
      caption.textContent =
        "Write an image caption or source here.";
      caption.style.cssText =
        "margin-top:10px;font-size:13px;color:#687386;text-align:center;";

      figure.appendChild(image);
      figure.appendChild(caption);

      const paragraph = document.createElement("p");
      paragraph.appendChild(document.createElement("br"));

      const selection = window.getSelection();

      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(figure);
        figure.after(paragraph);

        range.setStartAfter(paragraph);
        range.collapse(true);

        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        editorRef.current?.appendChild(figure);
        editorRef.current?.appendChild(paragraph);
      }

      updateContent();
      rememberSelection();

      setMessage("Image inserted successfully.");
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : "Unknown upload error";

      setMessage("Could not upload image: " + detail);
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const isError =
    message.startsWith("Could not") ||
    message.startsWith("Please") ||
    message.startsWith("Use") ||
    message.startsWith("The image");

  return (
    <div
      className="epl-rich-editor"
      style={{
        width: "100%",
        color: "#26364a",
        boxSizing: "border-box",
      }}
    >
      {/* TOP TOOLBAR */}
      <div
        role="toolbar"
        aria-label="Main formatting tools"
        style={{
          position: "sticky",
          top: 6,
          zIndex: 30,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 6,
          padding: "8px 10px",
          marginBottom: 12,
          border: "1px solid #dce3ec",
          borderRadius: 10,
          background: "rgba(248, 251, 255, 0.97)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 3px 12px rgba(25, 55, 90, 0.06)",
        }}
      >
        <button
          type="button"
          title="Undo"
          aria-label="Undo"
          style={baseButton}
          onPointerDown={handleToolbarPointerDown}
          onClick={() => runCommand("undo")}
        >
          ↶
        </button>

        <button
          type="button"
          title="Redo"
          aria-label="Redo"
          style={baseButton}
          onPointerDown={handleToolbarPointerDown}
          onClick={() => runCommand("redo")}
        >
          ↷
        </button>

        <span style={separatorStyle} />

        {blockTool("Paragraph", "p")}
        {blockTool("Heading 2", "h2")}
        {blockTool("Heading 3", "h3")}

        <span style={separatorStyle} />

        {tool("Bold", "bold", "B", { fontWeight: 900 })}
        {tool("Italic", "italic", "I", { fontStyle: "italic" })}
        {tool("Underline", "underline", "U", {
          textDecoration: "underline",
        })}
      </div>

      {/* MESSAGE */}
      {message && (
        <div
          role="status"
          style={{
            marginBottom: 10,
            padding: "9px 12px",
            borderRadius: 7,
            background: isError ? "#fff1f0" : "#edf7f1",
            color: isError ? "#b42318" : "#315b46",
            fontSize: 12,
          }}
        >
          {message}
        </div>
      )}

      {/* MAIN EDITOR WORKSPACE */}
      <div
        className="epl-editor-workspace"
        style={{
          display: "grid",
          gridTemplateColumns: "48px minmax(0, 1fr) 48px",
          gap: 10,
          alignItems: "start",
          width: "100%",
        }}
      >
        {/* LEFT TOOLBAR */}
        <aside
          role="toolbar"
          aria-label="Alignment and list tools"
          style={sideStyle}
        >
          {tool("Align left", "justifyLeft", "☰")}
          {tool("Align center", "justifyCenter", "≡")}
          {tool("Align right", "justifyRight", "☷")}
          {tool("Justify", "justifyFull", "▤")}

          <span style={separatorStyle} />

          {tool("Bullet list", "insertUnorderedList", "•")}
          {tool("Numbered list", "insertOrderedList", "1.")}

          <span style={separatorStyle} />

          {tool("Indent", "indent", "→")}
          {tool("Outdent", "outdent", "←")}
        </aside>

        {/* WIDE WRITING AREA */}
        <main
          className="epl-writing-column"
          style={{
            minWidth: 0,
            width: "100%",
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
              refreshToolbarState();
            }}
            onPointerUp={() => {
              rememberSelection();
              refreshToolbarState();
            }}
            onFocus={refreshToolbarState}
            onInput={() => {
              updateContent();
              rememberSelection();
              refreshToolbarState();
            }}
            onBlur={() => {
              updateContent();
              rememberSelection();
            }}
            style={{
              width: "100%",
              minHeight: 650,
              boxSizing: "border-box",
              padding: "38px 42px",
              border: "1px solid #dce3ec",
              borderRadius: 10,
              background: "#ffffff",
              outline: "none",
              fontSize: 16,
              lineHeight: 1.85,
              color: "#26364a",
              overflowWrap: "break-word",
            }}
          />
        </main>

        {/* RIGHT TOOLBAR */}
        <aside
          role="toolbar"
          aria-label="Insert and editing tools"
          style={sideStyle}
        >
          <button
            type="button"
            title="Insert link"
            aria-label="Insert link"
            style={baseButton}
            onPointerDown={handleToolbarPointerDown}
            onClick={insertLink}
          >
            ↗
          </button>

          <button
            type="button"
            title="Insert image"
            aria-label="Insert image"
            disabled={uploading}
            style={{
              ...baseButton,
              color: blue,
              opacity: uploading ? 0.5 : 1,
            }}
            onPointerDown={handleToolbarPointerDown}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "…" : "▧"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                void uploadSupportingImage(file);
              }
            }}
          />

          <span style={separatorStyle} />

          <button
            type="button"
            title="Blockquote"
            aria-label="Blockquote"
            aria-pressed={Boolean(activeFormats.blockquote)}
            style={{
              ...baseButton,
              ...(activeFormats.blockquote ? activeButton : {}),
            }}
            onPointerDown={handleToolbarPointerDown}
            onClick={() => applyBlock("blockquote")}
          >
            ❞
          </button>

          {tool("Strikethrough", "strikeThrough", "S", {
            textDecoration: "line-through",
          })}

          <span style={separatorStyle} />

          <button
            type="button"
            title="Horizontal divider"
            aria-label="Horizontal divider"
            style={baseButton}
            onPointerDown={handleToolbarPointerDown}
            onClick={() => runCommand("insertHorizontalRule")}
          >
            —
          </button>

          <button
            type="button"
            title="Remove formatting"
            aria-label="Remove formatting"
            style={{
              ...baseButton,
              color: "#b54747",
            }}
            onPointerDown={handleToolbarPointerDown}
            onClick={clearFormatting}
          >
            Tx
          </button>
        </aside>
      </div>

      {/* BOTTOM STATUS BAR */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 15,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          padding: "11px 14px",
          marginTop: 12,
          border: "1px solid #e0e6ee",
          borderRadius: 8,
          background: "rgba(248, 251, 255, 0.97)",
          color: "#718096",
          fontSize: 12,
        }}
      >
        <span>{wordCount} words</span>
        <span>
          {uploading ? "Uploading image..." : "Editor ready"}
        </span>
      </div>
    </div>
  );
}

const separatorStyle: CSSProperties = {
  width: 1,
  height: 24,
  background: "#dce3ec",
  margin: "0 2px",
  flexShrink: 0,
};
