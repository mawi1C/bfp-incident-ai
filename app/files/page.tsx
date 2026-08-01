import Nav from "@/components/Nav";
import DeleteUploadButton from "@/components/DeleteUploadButton";
import { getSourceFiles } from "@/lib/sourceFilesQueries";

export const metadata = { title: "Manage Uploads — BFP-NCR Incident Dashboard" };
export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const files = await getSourceFiles();
  const totalIncidents = files.reduce((sum, f) => sum + f.row_count, 0);

  return (
    <main className="min-h-screen bg-[#0A0A0B] px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[#2A2A2C] pb-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.2em] text-[#F5751E]">BFP–NCR</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#EDEDEC]">
              Manage Uploads
            </h1>
          </div>
          <Nav active="/files" />
        </div>

        <p className="mb-4 font-mono text-[11px] text-[#5A5A5E]">
          {files.length} file{files.length === 1 ? "" : "s"} on record · {totalIncidents.toLocaleString()} total incidents
        </p>

        {files.length === 0 ? (
          <div className="border border-[#2A2A2C] bg-[#0E0E0F] px-6 py-16 text-center text-sm text-[#8A8A8E]">
            No files uploaded yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-[#2A2A2C] bg-[#0E0E0F] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[#EDEDEC]" title={f.file_name}>
                    {f.file_name}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11px] text-[#6A6A6E]">
                    <span>{f.report_month ?? "month unrecognized"}</span>
                    <span>{f.row_count.toLocaleString()} incidents</span>
                    <span>{new Date(f.uploaded_at).toLocaleDateString()}</span>
                    <a
                      href={f.cloudinary_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#F5751E] hover:underline"
                    >
                      view original
                    </a>
                  </div>
                </div>
                <DeleteUploadButton id={f.id} fileName={f.file_name} rowCount={f.row_count} />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}