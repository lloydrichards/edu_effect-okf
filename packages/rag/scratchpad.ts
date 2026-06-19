import { Effect } from "effect";
import { RagService } from "./src";

const main = Effect.gen(function* () {
  yield* Effect.log("Hello, Rag Scratchpad!");
  const rag = yield* RagService;

  // Example usage of RagService
  const collectionName = "testCollection";
  const documents = [
    "The capital of France is Paris.",
    "The largest planet in our solar system is Jupiter.",
    "The Great Wall of China is visible from space.",
  ];
  const ids = ["doc1", "doc2", "doc3"];

  const inputResult = yield* rag.ingest({
    collection: collectionName,
    ids,
    documents,
  });
  console.log("Ingest result:", inputResult);

  const query = "What is the capital of France?";

  const outputResults = yield* rag.retrieve({
    collection: collectionName,
    queries: [query],
    topK: 2,
  });

  console.log("Retrieval results:", outputResults);

  // List documents in the collection
  const listedDocuments = yield* rag.listDocuments({
    collection: collectionName,
    limit: 2,
  });

  console.log("Listed documents:", listedDocuments.documents);
});

Effect.runPromise(main.pipe(Effect.provide(RagService.Default))).catch(
  (error) => {
    console.error("Error in Rag Scratchpad:", error);
    process.exit(1);
  },
);
