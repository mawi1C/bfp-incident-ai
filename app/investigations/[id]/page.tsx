import Link from "next/link";
import { notFound } from "next/navigation";
import PageShell from "@/components/PageShell";
import EditInvestigationForm from "@/components/EditInvestigationForm";
import ManualMatchPicker from "@/components/ManualMatchPicker";
import DeleteInvestigationButton from "@/components/DeleteInvestigationButton";
import { getInvestigationRecordById } from "@/lib/investigationsQueries";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function InvestigationDetailPage({ params }: PageProps) {
    const { id } = await params;
    const record = await getInvestigationRecordById(id);

    if (!record) notFound();

    let linkedIncident = null;
    if (record.incident_id) {
        const { data } = await supabaseAdmin
            .from("incidents")
            .select("id, date_of_response, station, location, cause_of_fire")
            .eq("id", record.incident_id)
            .single();
        linkedIncident = data;
    }

    const totalInjured =
        record.injured_firefighter_male +
        record.injured_firefighter_female +
        record.injured_civilian_male +
        record.injured_civilian_female;
    const totalFatalities =
        record.fatalities_firefighter_male +
        record.fatalities_firefighter_female +
        record.fatalities_civilian_male +
        record.fatalities_civilian_female;

    return (
        <PageShell>
            <div className="mx-auto max-w-3xl">
                <Link href="/investigations" className="font-mono text-[11px] text-[#6A6A6E] hover:text-[#F5751E]">
                    ← case records
                </Link>

                <div className="mb-6 mt-2 flex items-start justify-between border-b border-[#2A2A2C] pb-4">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight text-[#EDEDEC]">
                            {record.exact_location ?? "Untitled case"}
                        </h1>
                        <p className="mt-1 font-mono text-[11px] text-[#6A6A6E]">
                            {record.date_of_fire ?? "no date"} · {record.city_municipality ?? "—"} ·{" "}
                            {record.match_status === "matched" ? (
                                <span className="text-[#3EBD6B]">matched</span>
                            ) : (
                                <span className="text-[#F5A623]">unmatched</span>
                            )}
                        </p>
                    </div>
                    <DeleteInvestigationButton id={record.id} location={record.exact_location} />
                </div>

                {/* Read-only summary */}
                <div className="mb-4 grid grid-cols-2 gap-3 border border-[#2A2A2C] bg-[#0E0E0F] p-4 text-sm text-[#EDEDEC] sm:grid-cols-3">
                    <Field label="PROPERTY TYPE" value={[record.property_general_category, record.property_sub_category].filter(Boolean).join(" / ") || "—"} />
                    <Field label="OWNER" value={record.name_of_owner ?? "—"} />
                    <Field label="OCCUPANT" value={record.name_of_occupant ?? "—"} />
                    <Field label="STOREYS" value={record.number_of_storeys?.toString() ?? "—"} />
                    <Field label="STRUCTURES AFFECTED" value={record.number_of_affected_structures?.toString() ?? "—"} />
                    <Field
                        label="EST. COST OF DAMAGE"
                        value={record.estimated_cost_of_damage != null ? `₱${record.estimated_cost_of_damage.toLocaleString()}` : "—"}
                    />
                    <Field label="INJURED (TOTAL)" value={totalInjured.toString()} accent={totalInjured > 0 ? "#E5484D" : undefined} />
                    <Field label="FATALITIES (TOTAL)" value={totalFatalities.toString()} accent={totalFatalities > 0 ? "#E5484D" : undefined} />
                    <Field label="ALARM STATUS" value={record.alarm_status ?? "—"} />
                </div>

                {/* Linked incident summary or match picker */}
                {linkedIncident ? (
                    <div className="mb-4 border border-[#3EBD6B]/40 bg-[#0F1A13] p-4 text-sm">
                        <p className="mb-2 font-mono text-[11px] tracking-wide text-[#3EBD6B]">LINKED INCIDENT</p>
                        <p className="text-[#EDEDEC]">{linkedIncident.location}</p>
                        <p className="mt-1 font-mono text-[11px] text-[#6A6A6E]">
                            {linkedIncident.date_of_response} · {linkedIncident.station} · {linkedIncident.cause_of_fire}
                        </p>
                    </div>
                ) : null}

                <div className="mb-4">
                    <ManualMatchPicker
                        investigationId={record.id}
                        suggestedDate={record.date_of_fire}
                        suggestedLocation={record.exact_location}
                        currentIncidentId={record.incident_id}
                    />
                </div>

                <EditInvestigationForm
                    id={record.id}
                    initial={{
                        date_of_fire: record.date_of_fire,
                        exact_location: record.exact_location,
                        city_municipality: record.city_municipality,
                        cause: record.cause,
                        classification_of_case: record.classification_of_case,
                        fire_arson_investigator: record.fire_arson_investigator,
                        remarks: record.remarks,
                    }}
                />

                <p className="mt-4 font-mono text-[11px] text-[#5A5A5E]">
                    Source: {record.source_file_name} ·{" "}
                    <a href={record.cloudinary_url} target="_blank" rel="noopener noreferrer" className="text-[#F5751E] hover:underline">
                        view original file
                    </a>
                </p>
            </div>
        </PageShell>
    );
}

function Field({ label, value, accent }: { label: string; value: string; accent?: string }) {
    return (
        <div>
            <p className="font-mono text-[10px] text-[#5A5A5E]">{label}</p>
            <p className="mt-0.5" style={accent ? { color: accent } : undefined}>
                {value}
            </p>
        </div>
    );
}