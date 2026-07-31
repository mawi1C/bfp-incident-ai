interface RankedItem {
  label: string;
  count: number;
}

interface Props {
  items: RankedItem[];
  emptyLabel: string;
}

export default function RankedBarList({ items, emptyLabel }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center font-mono text-xs text-[#5A5A5E]">
        {emptyLabel}
      </div>
    );
  }

  const max = Math.max(...items.map((i) => i.count));

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-xs text-[#C9C9C7]" title={item.label}>
            {item.label}
          </span>
          <div className="h-2.5 flex-1 bg-[#1A1A1B]">
            <div
              className="h-full bg-[#F5751E]"
              style={{ width: `${Math.max((item.count / max) * 100, 3)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right font-mono text-xs text-[#8A8A8E]">
            {item.count}
          </span>
        </div>
      ))}
    </div>
  );
}