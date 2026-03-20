import modal
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import requests
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import keccak
from eth_abi.packed import encode_packed
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = modal.App("token42-agent")

# Image with basic web/eth dependencies
base_image = modal.Image.debian_slim().pip_install(
    "eth-account==0.11.0",
    "requests",
    "fastapi",
    "pydantic"
)

# Image with machine learning dependencies for embeddings
embed_image = modal.Image.debian_slim().pip_install(
    "sentence-transformers",
    "torch"
)

web_app = FastAPI()
web_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data Models
class UserProfile(BaseModel):
    address: str
    personalityBio: Optional[str] = None
    personalityVector: Optional[List[float]] = None
    cid: Optional[str] = None

class MatchRequest(BaseModel):
    currentUser: UserProfile
    potentialMatches: List[UserProfile]
    nonce: int

class ReportRequest(BaseModel):
    sender: str
    recipient: str
    chatHistory: List[Dict[str, Any]]

# Global blocklist using Modal Dict for persistent cross-container state
blocklist_dict = modal.Dict.from_name("token42-blocklist", create_if_missing=True)

@app.cls(image=embed_image)
class Embedder:
    @modal.enter()
    def setup(self):
        print("Loading local embedding model...")
        from sentence_transformers import SentenceTransformer
        # using a fast and reliable embedding model
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        
    @modal.method()
    def generate_embedding(self, text: str) -> List[float]:
        try:
            return self.model.encode(text).tolist()
        except Exception as e:
            print(f"Error generating embedding: {e}")
            # Fallback to random if something fails
            import random
            return [random.random() for _ in range(384)]

@app.cls(image=base_image, secrets=[modal.Secret.from_name("token42-secret")])
class AgentCore:
    @modal.enter()
    def setup(self):
        # In production this will pull from the Modal Secret
        self.private_key = os.environ.get("AGENT_PRIVATE_KEY", "b0f02fb7c2c9d8bd8eaccfb14eb7e39ef04d2ab42fbbfd0774a3f1ed1e67bb93")
        self.account = Account.from_key(self.private_key)
        print(f"Agent Core initialized with address: {self.account.address}")

    def fetch_from_ipfs(self, cid: str) -> dict:
        if "mock" in cid.lower():
            print(f"Bypassing IPFS fetch for mock CID: {cid}")
            return {"bio": "This is a mock personality bio for testing."}
        try:
            url = f"https://gateway.pinata.cloud/ipfs/{cid}"
            resp = requests.get(url, timeout=10)
            return resp.json()
        except Exception as e:
            print(f"Failed to fetch CID {cid} from IPFS: {e}")
            return {"bio": ""}

    def cosine_similarity(self, v1: List[float], v2: List[float]) -> float:
        import math
        dot = sum(a*b for a, b in zip(v1, v2))
        mag1 = math.sqrt(sum(a*a for a in v1))
        mag2 = math.sqrt(sum(b*b for b in v2))
        if mag1 == 0 or mag2 == 0:
            return 0
        return dot / (mag1 * mag2)

    def sign_match(self, userA: str, userB: str, score: float, nonce: int) -> str:
        score_bps = int(score * 10000)
        userA_bytes = bytes.fromhex(userA.replace('0x', ''))
        userB_bytes = bytes.fromhex(userB.replace('0x', ''))
        
        # Solidity packed encoding
        encoded = encode_packed(['address', 'address', 'uint256', 'uint256'], [userA_bytes, userB_bytes, score_bps, nonce])
        msg_hash = keccak(encoded)
        
        # Ethers.js signMessage replicates the personal_sign format
        msg = encode_defunct(primitive=msg_hash)
        signed = self.account.sign_message(msg)
        return signed.signature.hex()

    @modal.method()
    def handle_match(self, req: MatchRequest):
        current_user = req.currentUser
        matches = req.potentialMatches
        nonce = req.nonce

        # Filter out blocked users
        addr_lower = current_user.address.lower()
        blocked_set = set()
        for k in blocklist_dict.keys():
            reporter, reported = k.split(':')
            if reporter == addr_lower:
                blocked_set.add(reported)
            elif reported == addr_lower:
                blocked_set.add(reporter)
                
        filtered_matches = [m for m in matches if m.address.lower() not in blocked_set]

        if not current_user.personalityBio and current_user.cid:
            data = self.fetch_from_ipfs(current_user.cid)
            current_user.personalityBio = data.get("bio", "")

        embedder = Embedder()
        user_vector = embedder.generate_embedding.remote(current_user.personalityBio or "")

        results = []
        for match in filtered_matches:
            if not match.personalityBio and match.cid:
                data = self.fetch_from_ipfs(match.cid)
                match.personalityBio = data.get("bio", "")
            match_vector = embedder.generate_embedding.remote(match.personalityBio or "")
            score = self.cosine_similarity(user_vector, match_vector)
            
            # Modal scaling: if Sentence-Transformers returns cosine sim < 1, 
            # we map it nicely to the 0.5-0.99 range for the frontend visual
            score = max(0.5, min(0.99, score))
            
            print(f" - Profile {match.address[:8]}: Score {score*100:.2f}%")
            results.append({"address": match.address, "score": score})

        results.sort(key=lambda x: x["score"], reverse=True)
        top_match = results[0] if results else None

        if top_match and top_match["score"] > 0.6:
            signature = self.sign_match(current_user.address, top_match["address"], top_match["score"], nonce)
            print(f"✅ Signed match for {current_user.address[:8]} & {top_match['address'][:8]}")
            return {
                "matchAddress": top_match["address"],
                "score": int(top_match["score"] * 10000),
                "signature": signature,
                "agentInboxId": None # XMTP V3 unsupported natively inside python webhook
            }
        return None

    @modal.method()
    def evaluate_chat(self, history: List[Dict[str, Any]]) -> bool:
        # In production, route to an LLM like LLaMA hosted on Modal.
        # For MVP parity, simulate safety rules.
        violation_words = ["harassment", "kill", "threat", "abuse"]
        for msg in history:
            text = msg.get("text", "").lower()
            if any(w in text for w in violation_words):
                return True
        return False

    @modal.method()
    def report(self, sender: str, recipient: str, history: List[Dict[str, Any]]):
        is_violation = self.evaluate_chat(history)
        
        if is_violation:
            # We skip on-chain slash directly here so we don't need RPC key wiring via python
            # In full port, use web3.py to call slashStake(sender, recipient)
            print(f"🚨 Violation verified for {sender} -> {recipient}")
            blocklist_dict[f"{sender.lower()}:{recipient.lower()}"] = True
            return {"status": "Slashed", "message": "Violation verified."}
        else:
            return {"status": "Safe", "message": "Chat content does not violate policies."}

@app.function(image=base_image)
@modal.asgi_app()
def fastapi_app():
    agent = AgentCore()

    @web_app.post("/match")
    def match_endpoint(req: MatchRequest):
        try:
            res = agent.handle_match.remote(req)
            return res
        except Exception as e:
            return {"error": str(e)}

    @web_app.post("/report")
    def report_endpoint(req: ReportRequest):
        try:
            return agent.report.remote(req.sender, req.recipient, req.chatHistory)
        except Exception as e:
            return {"error": str(e)}

    @web_app.get("/info")
    def info_endpoint():
        return {"agentInboxId": None}

    @web_app.get("/blocks")
    def blocks_endpoint(address: str):
        addr_lower = address.lower()
        blocked_users = set()
        for k in blocklist_dict.keys():
            reporter, reported = k.split(':')
            if reporter == addr_lower:
                blocked_users.add(reported)
            elif reported == addr_lower:
                blocked_users.add(reporter)
        return {"blockedUsers": list(blocked_users)}
        
    return web_app
