
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  label?: string;
};

const buttonStyle: React.CSSProperties = {
  border: "1px solid #d5d9e2",
  borderRadius: 6,
  background: "#fff",
  color: "#202938",
  padding: "8px 11px",
  fontSize: 13,
  cursor: "pointer",
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

  useEffect(() => {
    const editor = editorRef.current;

    if (editor && editor.innerHTML !== value) {
      editor.innerHTML = value || "";
    }
  }, [value]);

  function rememberSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (
      editor &&
      selection &&
      selection.rangeCount > 0 &&
      editor.contains(selection.getRangeAt(0).commonAncestorContainer)
    ) {
      savedRange.current = selection.getRangeAt(0).cloneRange();
    }
  }

  function runCommand(command: string, argument?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, argument);

    const editor = editorRef.current;
    if (editor) {
      onChange(editor.innerHTML);
      rememberSelection();
    }
  }

  async function uploadSupportingImage(file: File) {
    if (!file.type.startsWith("image/")) {
      setMessage("Please choose an image file.");
      return;
    }

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
        throw new Error("Please sign in before uploading an image.");
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
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
        throw new Error("Article editor is unavailable.");
      }

      editor.focus();

      const selection = window.getSelection();

      if (selection && savedRange.current) {
        selection.removeAllRanges();
        selection.addRange(savedRange.current);
      }

      const imageHtml = `
        <figure style="margin: 28px 0; text-align: center;">
          <img
            src="${data.publicUrl}"
            alt="Supporting article image"
            loading="lazy"
            style="display:block; width:100%; max-width:760px; height:auto; margin:0 auto; border-radius:8px;"
          />
          <figcaption
            contenteditable="true"
            style="margin-top:10px; font-size:13px; color:#687386; text-align:center;"
          >Write an image caption or source here.</figcaption>
        </figure>
        <p><br></p>
      `;

      document.execCommand("insertHTML", false, imageHtml);
      onChange(editor.innerHTML);
      rememberSelection();
      setMessage("Image inserted. Edit its caption in the article.");
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Unknown upload error";

      setMessage("Could not upload image: " + detail);
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="rich-text-editor">
      <div
        role="toolbar"
        aria-label="Article formatting tools"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          padding: 10,
          border: "1px solid #d5d9e2",
          borderBottom: 0,
          borderRadius: "8px 8px 0 0",
          background: "#f5f7fa",
        }}
      >
        <button
          type="button"
          style={buttonStyle}
          onMouseDown={e => e.preventDefault()}
          onClick={() => runCommand("formatBlock", "p")}
        >
          Paragraph
        </button>

        <button
          type="button"
          style={buttonStyle}
          onMouseDown={e => e.preventDefault()}
          onClick={() => runCommand("formatBlock", "h2")}
        >
          H2 · Subheading
        </button>

        <button
          type="button"
          style={buttonStyle}
          onMouseDown={e => e.preventDefault()}
          onClick={() => runCommand("formatBlock", "h3")}
        >
          H3 · Subheading
        </button>

        <button
          type="button"
          style={{ ...buttonStyle, fontWeight: 700 }}
          onMouseDown={e => e.preventDefault()}
          onClick={() => runCommand("bold")}
        >
          Bold
        </button>

        <button
          type="button"
          style={{ ...buttonStyle, fontStyle: "italic" }}
          onMouseDown={e => e.preventDefault()}
          onClick={() => runCommand("italic")}
        >
          Italic
        </button>

        <button
          type="button"
          style={buttonStyle}
          onMouseDown={e => e.preventDefault()}
          onClick={() => runCommand("insertUnorderedList")}
        >
          • Bullets
        </button>

        <button
          type="button"
          style={buttonStyle}
          onMouseDown={e => e.preventDefault()}
          onClick={() => runCommand("insertOrderedList")}
        >
          1. Numbered
        </button>

        <button
          type="button"
          style={buttonStyle}
          onMouseDown={e => e.preventDefault()}
          onClick={() => runCommand("insertHorizontalRule")}
        >
          Divider
        </button>

        <button
          type="button"
          style={{
            ...buttonStyle,
            background: "#183f70",
            color: "#fff",
            borderColor: "#183f70",
          }}
          disabled={uploading}
          onMouseDown={e => {
            rememberSelection();
            e.preventDefault();
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? "Uploading..." : "＋ Insert Supporting Image"}
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
      </div>

      {message && (
        <p
          role="status"
          style={{
            margin: "8px 0",
            fontSize: 13,
            color: message.startsWith("Could not") ||
              message.startsWith("Please") ||
              message.startsWith("Use") ||
              message.startsWith("The image")
                ? "#b42318"
                : "#315b46",
          }}
        >
          {message}
        </p>
      )}

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onInput={event => {
          onChange(event.currentTarget.innerHTML);
          rememberSelection();
        }}
        onBlur={event => onChange(event.currentTarget.innerHTML)}
        style={{
          minHeight: 320,
          padding: 16,
          border: "1px solid #d5d9e2",
          borderRadius: "0 0 8px 8px",
          background: "#fff",
          color: "#202938",
          lineHeight: 1.75,
          overflowWrap: "anywhere",
        }}
      />
      <p style={{ fontSize: 12, color: "#687386" }}>
        Place the cursor where you want the image to appear.
        You can edit the caption below each image.
      </p>
    </div>
  );
}
