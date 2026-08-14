import type { StatusContainer } from "@/lib/types";

const STYLES: Record<StatusContainer, string> = {
  WS: "bg-gray-100 text-gray-700",
  AR: "bg-orange-100 text-orange-700",
  AE: "bg-blue-100 text-blue-700",
  RE: "bg-amber-100 text-amber-700",
  OK: "bg-green-100 text-green-700",
};

export default function StatusBadge({ status }: { status: StatusContainer }) {
  return (
    <span className={`badge ${STYLES[status]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}
