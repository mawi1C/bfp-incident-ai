import ChatWindow from "@/components/ChatWindow";
import Nav from "@/components/Nav";

export const metadata = {
  title: "Query Assistant — BFP-NCR Incident Dashboard",
};

export default function ChatPage() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-[#0A0A0B] px-6 py-16">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex items-end justify-between border-b border-[#2A2A2C] pb-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.2em] text-[#F5751E]">BFP–NCR</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#EDEDEC]">
              Query Assistant
            </h1>
          </div>
          <Nav active="/chat" />
        </div>

        <ChatWindow />
      </div>
    </main>
  );
}