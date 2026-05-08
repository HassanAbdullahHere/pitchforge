import os
import json
import chromadb
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from dotenv import load_dotenv

load_dotenv()

# Initializing ChromaDB
client = chromadb.PersistentClient(path="./chromadb")


embeddings = GoogleGenerativeAIEmbeddings(
    model="gemini-embedding-2-preview",
    google_api_key=os.getenv("GEMINI_API_KEY")
)

# Load profile
with open("profile/profile.json", "r") as f:
    profile = json.load(f)

# Smaller chunks = more precise retrieval
chunks = []

# Skills chunk
chunks.append({
    "id": "skills",
    "text": f"Skills: {', '.join(profile['skills'])}"
})

# Each project as separate chunk
for i, project in enumerate(profile["projects"]):
    chunks.append({
        "id": f"project_{i}",
        "text": f"Project: {project['name']}. {project['description']}. Tech: {', '.join(project['tech'])}"
    })

# Experience chunks
for i, exp in enumerate(profile["experience"]):
    chunks.append({
        "id": f"experience_{i}",
        "text": f"Experience: {exp}"
    })

# Niches chunk
chunks.append({
    "id": "niches",
    "text": f"Specializes in: {', '.join(profile['niches'])}"
})

# Rates chunk
chunks.append({
    "id": "rates",
    "text": f"Hourly rate: ${profile['rates']['hourly_min']}-${profile['rates']['hourly_max']}. Minimum fixed: ${profile['rates']['fixed_min']}"
})

# Create or reset collection
try:
    client.delete_collection("freelancer_profile")
except:
    pass

collection = client.create_collection("freelancer_profile")

# Embed and store each chunk
print("Indexing profile into ChromaDB...")
for chunk in chunks:
    vector = embeddings.embed_query(chunk["text"])
    collection.add(
        ids=[chunk["id"]],
        embeddings=[vector],
        documents=[chunk["text"]]
    )
    print(f"  ✓ Indexed: {chunk['id']}")

print(f"\nDone — {len(chunks)} chunks indexed into ChromaDB")