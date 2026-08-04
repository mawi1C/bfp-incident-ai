import Nav from "@/components/Nav";

export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      <Nav />
      <main className="ml-48 min-h-screen px-6 py-12">{children}</main>
    </div>
  );
}