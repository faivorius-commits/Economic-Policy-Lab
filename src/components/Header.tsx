
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  label?: string;
};

const buttonStyle: React.CSSProperties = {
  border: "1px solid transparent",
  borderRadius: 6,
  background: "transparent",
  color: "#34465c",
  width: 32,
  minWidth: 32,
  height: 32,
  minHeight: 32,
  padding: 0,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  touchAction: "manipulation",
};

export default function RichTextEditor({
  value,
  onChange,
  label = "Article content",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);

  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [showToolbar, setShowToolbar] = useState(true);
  const [activeFormats, setActiveFormats] = useState<
    Record<string, boolean>
  >({});

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
      "superscript",
      "subscript",
      "insertUnorderedList",
      "insertOrderedList",
      "justifyLeft",
      "justifyCenter",
      "justifyRight",
      "justifyFull",
    ];

    const formats: Record<string, boolean> = {};

    commands.forEach(command => {
      try {
        formats[command] = document.queryCommandState(command);
      } catch {
        formats[command] = false;
      }
    });

    const node =
      range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : range.startContainer as HTMLElement;

    const block = node?.closest(
      "p, div, h2, h3, blockquote"
    );

    formats.p =
      block?.tagName === "P" ||
      block?.tagName === "DIV";

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
  });

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
      // Continue with formatting.
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

  function applyBlockFormat(
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

  function insertLink() {
    restoreSelection();

    const url = window.prompt(
      "Enter the website URL:",
      "https://"
    );

    if (!url) return;

    const trimmedUrl = url.trim();

    if (
      !trimmedUrl.startsWith("https://") &&
      !trimmedUrl.startsWith("http://") &&
      !trimmedUrl.startsWith("mailto:")
    ) {
      setMessage("Please enter a valid URL.");
      return;
    }

    runCommand("createLink", trimmedUrl);
  }

  function clearFormatting() {
    restoreSelection();

    document.execCommand("removeFormat", false);
    document.execCommand("unlink", false);

    updateContent();
    rememberSelection();
    refreshToolbarState();
  }

  async function uploadSupportingImage(file: File) {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (!allowedTypes.includes(file.type)) {
      setMessage("Use a JPG, PNG, WEBP, or GIF image.");
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

      const imageHtml = `
        <figure style="margin: 28px 0; text-align: center;">
          <img
            src="${data.publicUrl}"
            alt="Supporting article image"
            loading="lazy"
            style="
              display: block;
              width: 100%;
              max-width: 760px;
              height: auto;
              margin: 0 auto;
              border-radius: 8px;
            "
          />
          <figcaption
            style="
              margin-top: 10px;
              font-size: 13px;
              color: #687386;
              text-align: center;
            "
          >Write an image caption or source here.</figcaption>
        </figure>
        <p><br></p>
      `;

      document.execCommand(
        "insertHTML",
        false,
        imageHtml
      );

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

  function handleToolbarPointerDown(
    event: React.PointerEvent<HTMLButtonElement>
  ) {
    rememberSelection();
    event.preventDefault();
  }

  function tool(
    label: string,
    command: string,
    argument?: string
  ) {
    return (
      <button
        key={label}
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={Boolean(activeFormats[command])}
        style={{
          ...buttonStyle,
          ...(activeFormats[command]
            ? {
                background: "#dceafa",
                color: "#174b7e",
                borderColor: "#8bb5df",
              }
            : {}),
        }}
        onPointerDown={handleToolbarPointerDown}
        onClick={() => runCommand(command, argument)}
      >
        {label}
      </button>
    );
  }

  function blockTool(
    label: string,
    format: "p" | "h2" | "h3" | "blockquote"
  ) {
    const isActive = Boolean(activeFormats[format]);

    return (
      <button
        key={format}
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={isActive}
        style={{
          ...buttonStyle,
          ...(isActive
            ? {
                background: "#dceafa",
                color: "#174b7e",
                borderColor: "#8bb5df",
              }
            : {}),
        }}
        onPointerDown={handleToolbarPointerDown}
        onClick={() => applyBlockFormat(format)}
      >
        {label}
      </button>
    );
  }

  function alignmentTool(
    label: string,
    title: string,
    command: string,
    alignment: "Left" | "Center" | "Right" | "Full"
  ) {
    return (
      <button
        key={command}
        type="button"
        title={title}
        aria-label={title}
        aria-pressed={Boolean(activeFormats[command])}
        style={{
          ...buttonStyle,
          ...(activeFormats[command]
            ? {
                background: "#dceafa",
                color: "#174b7e",
                borderColor: "#8bb5df",
              }
            : {}),
        }}
        onPointerDown={handleToolbarPointerDown}
        onClick={() => applyAlignment(alignment)}
      >
        {label}
      </button>
    );
  }

  const isError =
    message.startsWith("Could not") ||
    message.startsWith("Please") ||
    message.startsWith("Use") ||
    message.startsWith("The image");

  return (
    <div className="rich-text-editor epl-editor">

      {showToolbar && (
        <div className="epl-topbar" role="toolbar">
          <div className="epl-tool-group">
            {tool("↶", "undo")}
            {tool("↷", "redo")}
            {blockTool("P", "p")}
            {blockTool("H2", "h2")}
            {blockTool("H3", "h3")}
          </div>

          <div className="epl-tool-group">
            {tool("B", "bold")}
            {tool("I", "italic")}
            {tool("U", "underline")}
          </div>

          <button
            type="button"
            className="epl-icon-button"
            title="Hide toolbar"
            onClick={() => setShowToolbar(false)}
          >
            ⌃
          </button>
        </div>
      )}

      {!showToolbar && (
        <button
          type="button"
          className="epl-show-tools"
          onClick={() => setShowToolbar(true)}
          title="Show toolbar"
        >
          ☰
        </button>
      )}

      {message && (
        <p
          role="status"
          className={`epl-message ${isError ? "error" : "success"}`}
        >
          {message}
        </p>
      )}

      <div className="epl-workspace">

        {showToolbar && (
          <aside className="epl-side-tools">
            {blockTool("❝", "blockquote")}
            {tool("S", "strikeThrough")}
            {tool("x²", "superscript")}
            {tool("x₂", "subscript")}
          </aside>
        )}

        <main className="epl-writing-area">
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
            onBlur={updateContent}
          />

          <div className="epl-word-count">
            <span>{wordCount} words</span>
            <span>Active tools are highlighted in blue.</span>
          </div>
        </main>

        {showToolbar && (
          <aside className="epl-side-tools">
            {alignmentTool("≡", "Align left", "justifyLeft", "Left")}
            {alignmentTool("☷", "Align center", "justifyCenter", "Center")}
            {alignmentTool("≣", "Align right", "justifyRight", "Right")}
            {alignmentTool("▤", "Justify", "justifyFull", "Full")}

            {tool("•", "insertUnorderedList")}
            {tool("1.", "insertOrderedList")}
            {tool("⇥", "indent")}
            {tool("⇤", "outdent")}

            <button
              type="button"
              className="epl-icon-button"
              title="Insert link"
              onPointerDown={handleToolbarPointerDown}
              onClick={insertLink}
            >
              🔗
            </button>

            <button
              type="button"
              className="epl-icon-button"
              title="Clear formatting"
              onPointerDown={handleToolbarPointerDown}
              onClick={clearFormatting}
            >
              Tx
            </button>
          </aside>
        )}
      </div>

      {showToolbar && (
        <div className="epl-bottom-tools" role="toolbar">
          <button
            type="button"
            className="epl-icon-button"
            title="Insert image"
            disabled={uploading}
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
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) void uploadSupportingImage(file);
            }}
          />

          {tool("—", "insertHorizontalRule")}

          <button
            type="button"
            className="epl-icon-button"
            title="Clear formatting"
            onPointerDown={handleToolbarPointerDown}
            onClick={clearFormatting}
          >
            Tx
          </button>

          <span className="epl-bottom-hint">
            Select text to format
          </span>
        </div>
      )}

      <p className="epl-editor-tip">
        Place your cursor where you want an image to appear.
      </p>
    </div>
  );
}
