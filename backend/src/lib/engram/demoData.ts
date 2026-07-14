import type { EngramEdge, EngramNode, KnowledgeGraph, RiskReport } from "./types";
import { computeRiskReport } from "./riskAgent";

/**
 * Pre-built Bharat Engineering Works, Pune — Unit 3 (Cooling Water Circuit) demo graph.
 * Matches PRD §16 expected graph after ingestion.
 */
export function buildDemoKnowledgeGraph(): KnowledgeGraph {
  const nodes: EngramNode[] = [
    // Assets (6)
    {
      id: "asset-pump-p-101",
      name: "Pump P-101",
      type: "Asset",
      tag: "P-101",
      description: "Centrifugal feed water pump, Kirloskar KDS-550, Unit 3",
      sources: ["Maintenance_Report_P101_2019.pdf"],
    },
    {
      id: "asset-compressor-c-3",
      name: "Compressor C-3",
      type: "Asset",
      tag: "C-3",
      description: "Process air compressor, Unit 3",
      sources: ["Incident_Log_2021_C3.docx"],
    },
    {
      id: "asset-boiler-b-7",
      name: "Boiler B-7",
      type: "Asset",
      tag: "B-7",
      description: "Auxiliary boiler for process steam, Unit 3",
      sources: ["Email_Archive_Ramesh_2020.txt"],
    },
    {
      id: "asset-hx-12",
      name: "Heat Exchanger HX-12",
      type: "Asset",
      tag: "HX-12",
      description: "Cooling water heat exchanger, Unit 3",
      sources: ["Parts_Master_Unit3.xlsx"],
    },
    {
      id: "asset-valve-v-44",
      name: "Control Valve V-44",
      type: "Asset",
      tag: "V-44",
      description: "Feed water control valve upstream of P-101",
      sources: ["Parts_Master_Unit3.xlsx"],
    },
    {
      id: "asset-tank-t-2",
      name: "Surge Tank T-2",
      type: "Asset",
      tag: "T-2",
      description: "Cooling water surge tank",
      sources: ["Parts_Master_Unit3.xlsx"],
    },

    // Persons (3)
    {
      id: "person-ramesh-kumar",
      name: "Ramesh Kumar",
      type: "Person",
      description: "Sr. Maintenance Engineer — Unit 3 cooling water circuit",
      sources: ["Maintenance_Report_P101_2019.pdf", "Email_Archive_Ramesh_2020.txt"],
    },
    {
      id: "person-priya-singh",
      name: "Priya Singh",
      type: "Person",
      description: "Maintenance Engineer — Boiler systems",
      sources: ["SOP_Impeller_Replacement_v3.pdf"],
    },
    {
      id: "person-anand-mehta",
      name: "Anand Mehta",
      type: "Person",
      description: "Plant Manager, Unit 3",
      sources: ["SOP_Impeller_Replacement_v3.pdf"],
    },

    // Incidents (4)
    {
      id: "incident-seal-failure-2019",
      name: "Seal failure, March 2019",
      type: "Incident",
      description: "P-101 mechanical seal failure due to cavitation",
      sources: ["Maintenance_Report_P101_2019.pdf"],
      metadata: { date: "2019-03-14", rootCause: "cavitation" },
    },
    {
      id: "incident-bearing-failure-2021",
      name: "Bearing failure, August 2021",
      type: "Incident",
      description: "C-3 drive-end bearing seizure",
      sources: ["Incident_Log_2021_C3.docx"],
      metadata: { date: "2021-08-09" },
    },
    {
      id: "incident-vibration-2020",
      name: "High vibration event, June 2020",
      type: "Incident",
      description: "P-101 elevated vibration during monsoon load swing",
      sources: ["Email_Archive_Ramesh_2020.txt"],
      metadata: { date: "2020-06-22" },
    },
    {
      id: "incident-boiler-trip-2022",
      name: "Boiler trip, January 2022",
      type: "Incident",
      description: "B-7 low-water trip — corrected by Priya and Ramesh",
      sources: ["Email_Archive_Ramesh_2020.txt"],
      metadata: { date: "2022-01-11" },
    },

    // Documents (5)
    {
      id: "document-maint-report-2341",
      name: "Maintenance Report #2341",
      type: "Document",
      description: "P-101 seal failure investigation, March 2019",
      sources: ["Maintenance_Report_P101_2019.pdf"],
    },
    {
      id: "document-sop-v3",
      name: "SOP Impeller Replacement v3.2",
      type: "Document",
      description: "Standard procedure document for KDS-550 impeller replacement",
      sources: ["SOP_Impeller_Replacement_v3.pdf"],
    },
    {
      id: "document-parts-master",
      name: "Parts Master Unit 3",
      type: "Document",
      description: "Spare parts list for Unit 3 cooling water circuit",
      sources: ["Parts_Master_Unit3.xlsx"],
    },
    {
      id: "document-incident-c3",
      name: "Incident Log C-3 2021",
      type: "Document",
      description: "Compressor C-3 bearing failure incident log",
      sources: ["Incident_Log_2021_C3.docx"],
    },
    {
      id: "document-email-ramesh",
      name: "Email Archive Ramesh 2020",
      type: "Document",
      description: "Informal troubleshooting threads not captured in DMS",
      sources: ["Email_Archive_Ramesh_2020.txt"],
      metadata: { informal: true },
    },

    // Procedures (3)
    {
      id: "procedure-impeller-replacement",
      name: "Impeller replacement procedure",
      type: "Procedure",
      description: "Step sequence for KDS-550 impeller + seal upgrade",
      sources: ["SOP_Impeller_Replacement_v3.pdf"],
    },
    {
      id: "procedure-bearing-change",
      name: "Bearing change-out procedure",
      type: "Procedure",
      description: "Drive-end bearing replacement for C-3 class compressors",
      sources: ["Incident_Log_2021_C3.docx"],
    },
    {
      id: "procedure-seal-upgrade",
      name: "Mechanical seal upgrade procedure",
      type: "Procedure",
      description: "Type-A seal installation after cavitation damage",
      sources: ["Maintenance_Report_P101_2019.pdf"],
    },

    // Parts (8)
    {
      id: "part-skf-6205",
      name: "SKF Bearing 6205",
      type: "Part",
      description: "Deep groove ball bearing",
      sources: ["Parts_Master_Unit3.xlsx"],
    },
    {
      id: "part-seal-type-a",
      name: "Mechanical Seal Type-A",
      type: "Part",
      description: "Upgraded mechanical seal for KDS-550 pumps",
      sources: ["Parts_Master_Unit3.xlsx"],
    },
    {
      id: "part-oring-set",
      name: "O-ring set (Viton)",
      type: "Part",
      sources: ["Parts_Master_Unit3.xlsx"],
    },
    {
      id: "part-impeller-kds",
      name: "KDS-550 Impeller",
      type: "Part",
      sources: ["Parts_Master_Unit3.xlsx"],
    },
    {
      id: "part-gasket-kit",
      name: "Gasket kit P-101",
      type: "Part",
      sources: ["Parts_Master_Unit3.xlsx"],
    },
    {
      id: "part-coupling-insert",
      name: "Coupling insert C-3",
      type: "Part",
      sources: ["Parts_Master_Unit3.xlsx"],
    },
    {
      id: "part-filter-element",
      name: "Suction strainer element",
      type: "Part",
      sources: ["Parts_Master_Unit3.xlsx"],
    },
    {
      id: "part-lube-oil",
      name: "ISO VG 46 Lube Oil",
      type: "Part",
      sources: ["Parts_Master_Unit3.xlsx"],
    },
  ];

  const edges: EngramEdge[] = [
    // Asset → Incident
    { id: "e1", from: "asset-pump-p-101", to: "incident-seal-failure-2019", type: "had_incident", label: "had_incident" },
    { id: "e2", from: "asset-pump-p-101", to: "incident-vibration-2020", type: "had_incident", label: "had_incident" },
    { id: "e3", from: "asset-compressor-c-3", to: "incident-bearing-failure-2021", type: "had_incident", label: "had_incident" },
    { id: "e4", from: "asset-boiler-b-7", to: "incident-boiler-trip-2022", type: "had_incident", label: "had_incident" },

    // Incident → Person (fixed_by)
    { id: "e5", from: "incident-seal-failure-2019", to: "person-ramesh-kumar", type: "fixed_by", label: "fixed_by" },
    { id: "e6", from: "incident-vibration-2020", to: "person-ramesh-kumar", type: "fixed_by", label: "fixed_by" },
    { id: "e7", from: "incident-bearing-failure-2021", to: "person-ramesh-kumar", type: "fixed_by", label: "fixed_by" },
    { id: "e8", from: "incident-boiler-trip-2022", to: "person-ramesh-kumar", type: "fixed_by", label: "fixed_by" },
    { id: "e9", from: "incident-boiler-trip-2022", to: "person-priya-singh", type: "fixed_by", label: "fixed_by" },

    // Incident → Procedure / Document
    { id: "e10", from: "incident-seal-failure-2019", to: "procedure-impeller-replacement", type: "resolved_using", label: "resolved_using" },
    { id: "e11", from: "incident-seal-failure-2019", to: "procedure-seal-upgrade", type: "resolved_using", label: "resolved_using" },
    { id: "e12", from: "incident-bearing-failure-2021", to: "procedure-bearing-change", type: "resolved_using", label: "resolved_using" },
    { id: "e13", from: "incident-seal-failure-2019", to: "document-maint-report-2341", type: "documented_in", label: "documented_in" },
    { id: "e14", from: "incident-bearing-failure-2021", to: "document-incident-c3", type: "documented_in", label: "documented_in" },

    // Person expertise
    { id: "e15", from: "person-ramesh-kumar", to: "asset-pump-p-101", type: "expert_on", label: "expert_on" },
    { id: "e16", from: "person-ramesh-kumar", to: "asset-compressor-c-3", type: "expert_on", label: "expert_on" },
    { id: "e17", from: "person-ramesh-kumar", to: "asset-boiler-b-7", type: "expert_on", label: "expert_on" },
    { id: "e18", from: "person-priya-singh", to: "asset-boiler-b-7", type: "expert_on", label: "expert_on" },

    // Authored
    { id: "e19", from: "person-ramesh-kumar", to: "document-maint-report-2341", type: "authored", label: "authored" },
    { id: "e20", from: "person-ramesh-kumar", to: "document-sop-v3", type: "authored", label: "authored" },
    { id: "e21", from: "person-ramesh-kumar", to: "document-email-ramesh", type: "authored", label: "authored" },
    { id: "e22", from: "person-ramesh-kumar", to: "procedure-impeller-replacement", type: "authored", label: "authored" },
    { id: "e23", from: "person-ramesh-kumar", to: "procedure-seal-upgrade", type: "authored", label: "authored" },

    // Asset → Procedure / Part
    { id: "e24", from: "asset-pump-p-101", to: "procedure-impeller-replacement", type: "governed_by", label: "governed_by" },
    { id: "e25", from: "asset-pump-p-101", to: "procedure-seal-upgrade", type: "governed_by", label: "governed_by" },
    { id: "e26", from: "asset-compressor-c-3", to: "procedure-bearing-change", type: "governed_by", label: "governed_by" },
    { id: "e27", from: "asset-pump-p-101", to: "part-seal-type-a", type: "requires_part", label: "requires_part" },
    { id: "e28", from: "asset-pump-p-101", to: "part-impeller-kds", type: "requires_part", label: "requires_part" },
    { id: "e29", from: "asset-pump-p-101", to: "part-skf-6205", type: "requires_part", label: "requires_part" },
    { id: "e30", from: "asset-compressor-c-3", to: "part-skf-6205", type: "requires_part", label: "requires_part" },
    { id: "e31", from: "asset-compressor-c-3", to: "part-coupling-insert", type: "requires_part", label: "requires_part" },
    { id: "e32", from: "asset-boiler-b-7", to: "part-gasket-kit", type: "requires_part", label: "requires_part" },

    // Procedure → Part, Document → Procedure
    { id: "e33", from: "procedure-impeller-replacement", to: "part-impeller-kds", type: "references_part", label: "references_part" },
    { id: "e34", from: "procedure-impeller-replacement", to: "part-seal-type-a", type: "references_part", label: "references_part" },
    { id: "e35", from: "procedure-bearing-change", to: "part-skf-6205", type: "references_part", label: "references_part" },
    { id: "e36", from: "document-sop-v3", to: "procedure-impeller-replacement", type: "describes", label: "describes" },
    { id: "e37", from: "document-maint-report-2341", to: "procedure-seal-upgrade", type: "describes", label: "describes" },
    { id: "e38", from: "document-parts-master", to: "part-skf-6205", type: "describes", label: "describes" },
    { id: "e39", from: "document-incident-c3", to: "procedure-bearing-change", type: "describes", label: "describes" },
    { id: "e40", from: "asset-hx-12", to: "part-oring-set", type: "requires_part", label: "requires_part" },
  ];

  return {
    nodes,
    edges,
    updatedAt: new Date().toISOString(),
  };
}

export function buildDemoRiskReport(graph?: KnowledgeGraph): RiskReport {
  return computeRiskReport(graph ?? buildDemoKnowledgeGraph());
}

export const DEMO_PLANT_NAME = "Bharat Engineering Works — Unit 3";
