
import React from "react";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Tulis artikel atau penelitian di sini...",
}: RichTextEditorProps) {
  const editorRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== value) {
      editor.innerHTML = value;
    }
  }, [value]);

  function applyFormat(command: string, argument?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, argument);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar">
        <button type="button" onClick={() => applyFormat("formatBlock", "P")}>
          Paragraph
        </button>
        <button type="button" onClick={() => applyFormat("formatBlock", "H2")}>
          H2
        </button>
        <button type="button" onClick={() => applyFormat("formatBlock", "H3")}>
          H3
        </button>
        <button type="button" onClick={() => applyFormat("bold")}>
          Bold
        </button>
        <button type="button" onClick={() => applyFormat("italic")}>
          Italic
        </button>
        <button type="button" onClick={() => applyFormat("insertUnorderedList")}>
          • List
        </button>
        <button type="button" onClick={() => applyFormat("insertOrderedList")}>
          1. List
        </button>
        <button type="button" onClick={() => applyFormat("insertHorizontalRule")}>
          Divider
        </button>
      </div>

      <div
        ref={editorRef}
        className="rich-text-area"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        role="textbox"
        aria-multiline="true"
      />
    </div>
  );
}
