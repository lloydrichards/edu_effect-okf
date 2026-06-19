
### Local ChromaDB (Docker)

For local dev, run the ChromaDB container and point the server at it:

```bash
# Start the ChromaDB service only
docker run -d --name edu_chroma -p 8000:8000 chromadb/chroma

# In another shell, run the server with ChromaDB env vars
CHROMA_HOST=localhost CHROMA_PORT=8000 bun dev --filter=server
```

ChromaDB will be available at `http://localhost:8000`.