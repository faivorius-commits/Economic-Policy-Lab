
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  label?: string;
};

const buttonStyle: React.CSSProperties = {
  border: "1px solid #d5dce7",
  borderRadius: 7,
  background: "#ffffff",
  color: "#26364a",
  padding: "8px 11px",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  whiteSpace: "nowrap",
  minHeight: 35,
};

const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#24558a",
  color: "#ffffff",
  borderColor: "#24558a",
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
      editor &&
      selection &&
      selection.rangeCount > 0 &&
      editor.contains(
        selection.getRangeAt(0).commonAncestorContainer
      )
    ) {
      savedRange.current =
        selection.getRangeAt(0).cloneRange();
    }
  }

  function restoreSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection) return;

    editor.focus();

    if (savedRange.current) {
      try {
        selection.removeAllRanges();
        selection.addRange(savedRange.current);
      } catch {
        savedRange.current = null;
      }
    }
  }

  function runCommand(
    command: string,
    argument?: string
  ) {
    restoreSelection();

    document.execCommand(command, false, argument);

    updateContent();
    rememberSelection();
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

    document.execCommand(
      "createLink",
      false,
      trimmedUrl
    );

    updateContent();
    rememberSelection();
  }

  function clearFormatting() {
    restoreSelection();

    document.execCommand("removeFormat", false);
    document.execCommand("unlink", false);

    updateContent();
    rememberSelection();
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

      const editor = editorRef.current;

      if (!editor) {
        throw new Error(
          "Article editor is unavailable."
        );
      }

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
            contenteditable="true"
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

      setMessage(
        "Image inserted. You can edit its caption."
      );
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : "Unknown upload error";

      setMessage(
        "Could not upload image: " + detail
      );
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function tool(
    label: string,
    command: string,
    argument?: string,
    extraStyle?: React.CSSProperties
  ) {
    return (
      <button
        key={label}
        type="button"
        title={label}
        aria-label={label}
        style={{
          ...buttonStyle,
          ...extraStyle,
        }}
        onMouseDown={event => {
          rememberSelection();
          event.preventDefault();
        }}
        onClick={() =>
          runCommand(command, argument)
        }
      >
        {label}
      </button>
    );
  }

  function separator() {
    return (
      <span
        aria-hidden="true"
        style={{
          width: 1,
          height: 25,
          background: "#d9e0e9",
          margin: "4px 3px",
          flexShrink: 0,
        }}
      />
    );
  }

  const isError =
    message.startsWith("Could not") ||
    message.startsWith("Please") ||
    message.startsWith("Use") ||
    message.startsWith("The image");

  return (
    <div
      className="rich-text-editor"
      style={{
        width: "100%",
        color: "#26364a",
      }}
    >
      {/* TOOLBAR */}
      {showToolbar && (
        <div
          role="toolbar"
          aria-label="Article formatting tools"
          style={{
            position: "sticky",
            top: 8,
            zIndex: 30,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 6,
            padding: 10,
            border: "1px solid #d8e0eb",
            borderRadius: 10,
            background: "rgba(248, 251, 255, 0.97)",
            backdropFilter: "blur(12px)",
            boxShadow:
              "0 4px 16px rgba(25, 55, 90, 0.08)",
            marginBottom: 12,
          }}
        >
          {/* HISTORY */}
          {tool("↶ Undo", "undo")}
          {tool("↷ Redo", "redo")}

          {separator()}

          {/* PARAGRAPH */}
          <button
            type="button"
            style={buttonStyle}
            onMouseDown={event => {
              rememberSelection();
              event.preventDefault();
            }}
            onClick={() =>
              runCommand("formatBlock", "p")
            }
          >
            Paragraph
          </button>

          <button
            type="button"
            style={buttonStyle}
            onMouseDown={event => {
              rememberSelection();
              event.preventDefault();
            }}
            onClick={() =>
              runCommand("formatBlock", "h2")
            }
          >
            H2
          </button>

          <button
            type="button"
            style={buttonStyle}
            onMouseDown={event => {
              rememberSelection();
              event.preventDefault();
            }}
            onClick={() =>
              runCommand("formatBlock", "h3")
            }
          >
            H3
          </button>

          <button
            type="button"
            style={buttonStyle}
            onMouseDown={event => {
              rememberSelection();
              event.preventDefault();
            }}
            onClick={() =>
              runCommand("formatBlock", "blockquote")
            }
          >
            Quote
          </button>

          {separator()}

          {/* TEXT FORMATTING */}
          {tool("B Bold", "bold", undefined, {
            fontWeight: 800,
          })}

          {tool("I Italic", "italic", undefined, {
            fontStyle: "italic",
          })}

          {tool("U Underline", "underline", undefined, {
            textDecoration: "underline",
          })}

          {tool("S Strike", "strikeThrough", undefined, {
            textDecoration: "line-through",
          })}

          {tool("x²", "superscript")}
          {tool("x₂", "subscript")}

          {separator()}

          {/* TEXT ALIGNMENT */}
          <button
            type="button"
            title="Align left"
            style={buttonStyle}
            onMouseDown={event => {
              rememberSelection();
              event.preventDefault();
            }}
            onClick={() => applyAlignment("Left")}
          >
            ☰ Left
          </button>

          <button
            type="button"
            title="Align center"
            style={buttonStyle}
            onMouseDown={event => {
              rememberSelection();
              event.preventDefault();
            }}
            onClick={() => applyAlignment("Center")}
          >
            ☷ Center
          </button>

          <button
            type="button"
            title="Align right"
            style={buttonStyle}
            onMouseDown={event => {
              rememberSelection();
              event.preventDefault();
            }}
            onClick={() => applyAlignment("Right")}
          >
            ☰ Right
          </button>

          <button
            type="button"
            title="Justify text"
            style={buttonStyle}
            onMouseDown={event => {
              rememberSelection();
              event.preventDefault();
            }}
            onClick={() => applyAlignment("Full")}
          >
            ☷ Justify
          </button>

          {separator()}

          {/* LISTS */}
          {tool("• Bullets", "insertUnorderedList")}
          {tool("1. Numbered", "insertOrderedList")}
          {tool("→ Indent", "indent")}
          {tool("← Outdent", "outdent")}

          {separator()}

          {/* LINKS */}
          <button
            type="button"
            style={buttonStyle}
            onMouseDown={event => {
              rememberSelection();
              event.preventDefault();
            }}
            onClick={insertLink}
          >
            🔗 Link
          </button>

          {tool("Unlink", "unlink")}
          {tool("— Divider", "insertHorizontalRule")}

          <button
            type="button"
            style={buttonStyle}
            onMouseDown={event => {
              rememberSelection();
              event.preventDefault();
            }}
            onClick={clearFormatting}
          >
            Clear Format
          </button>

          {separator()}

          {/* IMAGE UPLOAD */}
          <button
            type="button"
            style={primaryButtonStyle}
            disabled={uploading}
            onMouseDown={event => {
              rememberSelection();
              event.preventDefault();
            }}
            onClick={() =>
              fileInputRef.current?.click()
            }
          >
            {uploading
              ? "Uploading..."
              : "＋ Insert Image"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={event => {
              const file = event.target.files?.[0];

              if (file) {
                void uploadSupportingImage(file);
              }
            }}
          />

          {separator()}

          {/* HIDE TOOLBAR */}
          <button
            type="button"
            title="Hide Toolbar"
            style={{
              ...buttonStyle,
              background: "#edf3fa",
              color: "#24558a",
              fontWeight: 700,
            }}
            onMouseDown={event =>
              event.preventDefault()
            }
            onClick={() => setShowToolbar(false)}
          >
            ⌃ Hide Toolbar
          </button>
        </div>
      )}

      {/* SHOW TOOLBAR FLOATING BUTTON */}
      {!showToolbar && (
        <button
          type="button"
          title="Show Toolbar"
          aria-label="Show Toolbar"
          onClick={() => setShowToolbar(true)}
          style={{
            position: "fixed",
            right: 22,
            bottom: 24,
            zIndex: 100,
            width: 52,
            height: 52,
            borderRadius: "50%",
            border: "none",
            background: "#24558a",
            color: "#ffffff",
            fontSize: 22,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow:
              "0 5px 18px rgba(20, 55, 90, 0.25)",
          }}
        >
          ☰
        </button>
      )}

      {/* STATUS MESSAGE */}
      {message && (
        <p
          role="status"
          style={{
            margin: "8px 0 12px",
            padding: "9px 12px",
            borderRadius: 7,
            background: isError
              ? "#fff1f0"
              : "#edf7f1",
            color: isError
              ? "#b42318"
              : "#315b46",
            fontSize: 13,
          }}
        >
          {message}
        </p>
      )}

      {/* ARTICLE EDITOR */}
      <div
        ref={editorRef}
        className="article-rich-content"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        data-placeholder="Start writing your article here..."
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onInput={() => {
          updateContent();
          rememberSelection();
        }}
        onBlur={() => {
          updateContent();
        }}
        style={{
          minHeight: 520,
          width: "100%",
          boxSizing: "border-box",
          padding: "28px 30px",
          border: "1px solid #d8e0eb",
          borderRadius: 10,
          background: "#ffffff",
          color: "#26364a",
          fontFamily:
            "Georgia, 'Times New Roman', serif",
          fontSize: 16,
          lineHeight: 1.9,
          overflowWrap: "anywhere",
          outline: "none",
        }}
      />

      {/* WORD COUNT */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          padding: "12px 3px",
          color: "#718096",
          fontSize: 12,
        }}
      >
        <span>{wordCount} words</span>

        <span>
          Select text first, then choose a formatting tool.
        </span>
      </div>

      <p
        style={{
          margin: "0 0 12px",
          color: "#718096",
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        Tip: Place your cursor where you want an image
        to appear. You can edit the caption below
        each inserted image.
      </p>
    </div>
  );
}

