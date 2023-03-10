import dotenv from "dotenv";
import { ipfs } from "./constants.js";
import {
  querySubgraphProjects,
  querySepanaProjects,
  getLatestBlock,
  writeSepanaDocs,
} from "./utils.js";
dotenv.config();

// Synchronizes the Sepana engine with the latest Juicebox Subgraph/IPFS data
async function main() {
  const sep = await querySepanaProjects();

  let docs = (await querySubgraphProjects()).filter((el) => {
    let r = sep.hits.hits.find((val) => el.id === val._id)?._source;
    return (
      !r ||
      el.id !== r.id ||
      el.projectId !== r.projectId ||
      el.pv !== r.pv ||
      el.handle !== r.handle ||
      el.metadataUri !== r.metadataUri ||
      el.currentBalance !== r.currentBalance ||
      el.totalPaid !== r.totalPaid ||
      el.createdAt !== r.createdAt ||
      el.trendingScore !== r.trendingScore ||
      el.deployer !== r.deployer
    );
  });

  const ipfsPromises = [];
  const now = await getLatestBlock();
  for (const i in docs) {
    docs[i]._id = docs[i].id;
    docs[i].lastUpdated = now;
    ipfsPromises.push(
      fetch(ipfs + docs[i].metadataUri)
        .then(async (res) => {
          if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
          return res.json();
        })
        .then((metadata) => {
          console.log(docs[i].id + ": " + metadata?.name);
          docs[i].name = metadata?.name;
          docs[i].description = metadata?.description;
          docs[i].logoUri = metadata?.logoUri;
        })
        .catch((e) => {
          throw new Error(`Error with CID ${docs[i].metadataUri}: ${e}`);
        })
    );

    if (i && i % 100 === 0) await new Promise((r) => setTimeout(r, 750));
  }

  await Promise.all(ipfsPromises);
  await writeSepanaDocs(docs);
}

main();
