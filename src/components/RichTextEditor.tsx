
import { useEffect, useRef } from "react";

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
  padding: "7px 10px",
  fontSize: 13,
  cursor: "pointer",
};

export default function RichTextEditor({
  value,
  onChange,
  label = "Article content",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== value) {
      editor.innerHTML = value || "";
    }
  }, [value]);

  function runCommand(command: string, argument?: string) {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    document.execCommand(command, false, argument);
    onChange(editor.innerHTML);
  }

  return (
    <div className="rich-text-editor">
      <div
        role="toolbar"
        aria-label="Formatting tools"
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
        <button type="button" style={buttonStyle}
          onMouseDown={e => e.preventDefault()}
          onClick={() => runCommand("formatBlock", "p")}>
          Paragraph
        </button>

        <button type="button" style={buttonStyle}
          onMouseDown={e => e.preventDefault()}
          onClick={() => runCommand("formatBlock", "h2")}>
          H2 · Subheading
        </button>

        <button type="button" style={buttonStyle}
          onMouseDown={e => e.preventDefault()}
          onClick={() => runCommand("formatBlock", "h3")}>
          H3 · Subheading
        </button>

        <button type="button"
          style={{ ...buttonStyle, fontWeight: 700 }}
          onMouseDown={e => e.preventDefault()}
          onClick={() => runCommand("bold")}>
          B
        </button>

        <button type="button"
          style={{ ...buttonStyle, fontStyle: "italic" }}
          onMouseDown={e => e.preventDefault()}
          onClick={() => runCommand("italic")}>
          I
        </button>

        <button type="button" style={buttonStyle}
          onMouseDown={e => e.preventDefault()}
          onClick={() => runCommand("insertUnorderedList")}>
          • Bullets
        </button>

        <button type="button" style={buttonStyle}
          onMouseDown={e => e.preventDefault()}
          onClick={() => runCommand("insertOrderedList")}>
          1. Numbered
        </button>

        <button type="button" style={buttonStyle}
          onMouseDown={e => e.preventDefault()}
          onClick={() => runCommand("insertHorizontalRule")}>
          Divider
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        onInput={e => onChange(e.currentTarget.innerHTML)}
        onBlur={e => onChange(e.currentTarget.innerHTML)}
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
        Select text first, then choose a format.
        Use H2/H3 to add subheadings.
      </p>
    </div>
  );
}
