import ChatWindow from "@/components/ChatWindow";
import PageShell from "@/components/PageShell";

export const metadata = {
  title: "Query Assistant — BFP-NCR Incident Dashboard",
};

export default function ChatPage() {
  return (
    <PageShell>
      <div className="flex flex-col items-center">
        <div className="w-full max-w-2xl">
          <div className="mb-8 border-b border-[#2A2A2C] pb-4">
            <h1 className="text-2xl font-semibold tracking-tight text-[#EDEDEC]">
              Query Assistant
            </h1>
          </div>

          <ChatWindow />
        </div>
      </div>
    </PageShell>
  );
}