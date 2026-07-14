/**
 * Seed script: create (or update) a demo plant with Unit 3 knowledge graph.
 *
 * Usage: pnpm --filter vc-screener-backend run seed:engram
 * Requires MONGODB_URI in env (root .env or backend .env).
 */
import "../src/loadEnv";
import mongoose from "mongoose";
import { connectDb, disconnectDb } from "../src/lib/infra/db";
import { Startup } from "../src/models/startup";
import {
  buildDemoKnowledgeGraph,
  buildDemoRiskReport,
  DEMO_PLANT_NAME,
} from "../src/lib/engram/demoData";

async function main() {
  await connectDb();
  const graph = buildDemoKnowledgeGraph();
  const riskReport = buildDemoRiskReport(graph);

  const ownerId = process.env.SEED_OWNER_ID ?? null;
  let plant = await Startup.findOne({ name: DEMO_PLANT_NAME });
  if (!plant) {
    plant = await Startup.create({
      name: DEMO_PLANT_NAME,
      ownerId,
      knowledgeGraph: graph,
      riskReport,
    });
    console.log(`Created plant ${plant._id} — ${DEMO_PLANT_NAME}`);
  } else {
    plant.knowledgeGraph = graph as never;
    plant.riskReport = riskReport as never;
    await plant.save();
    console.log(`Updated plant ${plant._id} — ${DEMO_PLANT_NAME}`);
  }

  console.log(
    `Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`,
  );
  console.log(`Risk: ${riskReport.summary}`);
  const critical = riskReport.atRiskAssets.filter(
    (a) => a.riskLevel === "critical",
  );
  console.log(
    `Critical assets: ${critical.map((a) => a.assetName).join(", ")}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDb().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  });
