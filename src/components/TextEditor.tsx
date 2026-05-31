interface TextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}

export default function TextEditor({
  value,
  onChange,
  placeholder = "متن خود را اینجا بنویسید...",
  maxLength = 5000,
}: TextEditorProps) {
  return (
    <div className="relative w-full">
      <textarea
        dir="rtl"
        className="w-full min-h-[200px] max-h-[400px] resize-y bg-card border border-slate-700 rounded-lg p-4 text-right font-vazirmatn text-sm leading-relaxed text-slate-400 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
      />
      <span className="absolute bottom-3 left-3 text-[10px] text-slate-600 font-mono">
        {value.length}/{maxLength}
      </span>
    </div>
  );
}
