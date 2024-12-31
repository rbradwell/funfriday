import asyncio
import json
import os
import uuid
from typing import List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
import redis
from pydantic import BaseModel

# Load environment variables
redis_host = os.getenv("REDIS_HOST", "redis")
redis_port = int(os.getenv("REDIS_PORT", 6379))

# Initialize Redis and FastAPI
redis_client = redis.StrictRedis(host=redis_host, port=redis_port, decode_responses=True)
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow your frontend's origin
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)

websocket_connections = {}

# Define allowed origins
ALLOWED_ORIGINS = ["http://localhost:5173"]

class UserCreateRequest(BaseModel):
    user_name: str

class PartyInitRequest(BaseModel):
    player_id: str
    category: str
    rounds: int
    timeout: int = 30  # Default timeout of 30 seconds for each question

class PartyJoinRequest(BaseModel):
    user_id: str

class PartyStartRequest(BaseModel):
    party_id: str
    user_id: str

class PartyMessage(BaseModel):
    event: str
    message: str


def get_db_connection():
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME", "quizdb"),
        user=os.getenv("DB_USER", "quizuser"),
        password=os.getenv("DB_PASSWORD", "quizpassword"),
        host=os.getenv("DB_HOST", "quizdb"),
        port=os.getenv("DB_PORT", 5432)
    )

async def initialize_question_pool(category: str, num_questions: int) -> List[dict]:
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id, question, answer, choice1, choice2, choice3
                FROM questions WHERE category = %s
                ORDER BY RANDOM() LIMIT %s
            """, (category, num_questions))
            questions = cursor.fetchall()

    if not questions or len(questions) < num_questions:
        raise HTTPException(status_code=400, detail="Not enough questions in the selected category")
    
    return [{
        "id": q[0],
        "question": q[1],
        "choices": [q[2], q[3], q[4], q[5]],
        "answer": q[2]
    } for q in questions]

@app.post("/api/user/create")
async def create_user(request: UserCreateRequest):
    user_id = str(uuid.uuid4())
    user_data = {
        "user_id": user_id,
        "user_name": request.user_name,
        "current_party": { "score": 0, "category_scores": {}}
    }
    save_user_to_redis(user_id, user_data)
    return JSONResponse({"user_id": user_id})


@app.post("/api/party/init")
async def init_party(request: PartyInitRequest):
    party_id = str(uuid.uuid4())
    game_id = str(uuid.uuid4())

    # Fetch question pool during initialization
    question_pool = await initialize_question_pool(request.category, request.rounds)
    
    # Store party details in Redis only
    party_data = {
        "game_id": game_id,
        "creator": request.player_id,
        "category": request.category,
        "rounds": request.rounds,
        "timeout": request.timeout,
        "current_round": 1,
        "state": "waiting_for_players",
        "question_pool": question_pool
    }
    print(f"saving initialized party data: {party_data}")
    save_party_to_redis(party_id, party_data)

    return JSONResponse({"party_id": party_id})

async def start_game(request: PartyStartRequest):
    print(f"Starting game for party: {request.party_id}")
    party = get_party_or_404(request.party_id)
    # Ensure the user is the creator
    if party["creator"] != request.user_id:
        raise HTTPException(status_code=403, detail="Only the party creator can start the game")
    
    # Ensure the first round hasn't already started
    if party["state"] != "waiting_for_players":
        raise HTTPException(status_code=400, detail="The game is already in progress or has ended")

    party = set_party_state(party, "in_progress")
    save_party_to_redis(request.party_id, party)

    # Start the first round
    asyncio.create_task(start_round(request.party_id))

    return JSONResponse({"message": "First round started successfully"})

async def start_round(party_id: str):
    print(f"Starting round for party: {party_id}")
    party = load_party_from_redis(party_id)
    if not party:
        return

    if party["current_round"] > party["rounds"]:
        # Game over
        party = set_party_state(party, "ended_successfully")
        save_party_to_redis(party_id, party)
        await broadcast_to_party(party_id, {"event": "game_over", "scores": get_player_scores(party_id) })
        return

    # Use question from the pre-fetched pool
    question = party["question_pool"].pop(0)
    party = update_current_question(party, question)
    save_party_to_redis(party_id, party)

    await broadcast_to_party(party_id, {
        "event": "new_question",
        "round": party["current_round"],
        "timeout": party["timeout"],
        "question": question["question"],
        "choices": question["choices"]
    })

    # Wait for the timeout
    await asyncio.sleep(party["timeout"])

    party = load_party_from_redis(party_id)

    if "current_question" in party:
        party.pop("current_question")
        set_current_round(party)
        save_party_to_redis(party_id, party)
        await broadcast_to_party(party_id, {"event": "question_timeout"})
        await start_round(party_id)

@app.post("/api/party/{party_id}/join")
async def join_party(party_id: str, request: PartyJoinRequest):
    print(f"Joining party: {party_id}, user_id: {request.user_id}")
    party = get_party_or_404(party_id)

    print(f"Party in join: {party}")
    if is_user_in_party(party_id, request.user_id):
        print(f"User already in party: {request.user_id}")
        raise HTTPException(status_code=400, detail="User already in party")

    print(f"Party after join: {party}")

    return JSONResponse({"message": "Joined party successfully", "game_id": party["game_id"]})

def add_websocket_for_userid(party_id: str, user_id: str, websocket: WebSocket):
    # TODO: probably need to lock this shared resource
    party_sockets = websocket_connections.get(party_id, {})
    party_sockets[user_id] = websocket
    websocket_connections[party_id] = party_sockets

@app.websocket("/ws/{party_id}")
async def websocket_endpoint(websocket: WebSocket, party_id: str, user_id: str):
    print(f"Client connected to party: {party_id}")
    # Check the Origin header
    origin = websocket.headers.get("origin")
    print(f"Origin: {origin}")
    if origin not in ALLOWED_ORIGINS:
        print(f"Origin not in ALLOWED_ORIGINS: {origin}")
        await websocket.close(code=1008)  # Policy Violation
        return

    await websocket.accept()

    # Load the party from Redis
    party = load_party_from_redis(party_id)
    if not party:
        print(f"Party not found: {party_id}")
        await websocket.close()
        return

    add_websocket_for_userid(party_id, user_id, websocket)

    try:
        while True:
            print("waiting for data")
            response = await websocket.receive_json()
            print(f"Received data: {response}")

            # all events must have a party_id and user_id
            party_id = response.get("party_id")
            if not party_id:
                print(f"Party not found: {party_id}")
                continue

            user_id = response.get("user_id")
            if not user_id:
                print(f"User not connected to party: {user_id}")
                continue

            party = load_party_from_redis(party_id)
            if not party:
                print(f"Party not found: {party_id}")
                continue

            if not is_user_in_party(party_id, user_id):
                await websocket.close(code=1008)
                raise HTTPException(status_code=404, detail="User not connected to party")

            if response.get("event") == "answer":
                answer = response.get("answer")
                print(f"Received answer: {answer} for user: {user_id}")
                if answer == party["current_question"]["answer"]:
                    update_player_score(party_id, party["category"], user_id)
            elif response.get("event") == "start_game":
                print(f"Starting game for party: {party_id}")
                await start_game(PartyStartRequest(party_id=party_id, user_id=user_id))
                
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for party: {party_id}")
        # Find and remove the disconnected websocket
        party_sockets = websocket_connections.get(party_id, {})
        if user_id in party_sockets and party_sockets[user_id] == websocket:
            print(f"Removing disconnected websocket for user: {user_id}")
            del party_sockets[user_id]
            await broadcast_to_party(party_id, {
                "event": "player_left",
                "user_id": user_id,
                "participants": get_user_ids_for_party(party_id)
            })
        if not party_sockets:
            # Remove party if no players are connected, this will lose all user scores!
            delete_party_from_redis(party_id)
        else:
            websocket_connections[party_id] = party_sockets


async def broadcast_to_party(party_id: str, message: dict):
    party = load_party_from_redis(party_id)
    if party:
        party_sockets = websocket_connections.get(party_id, {})
        for user_id, websocket in party_sockets.items():
            await websocket.send_json(message)


def load_party_from_redis(party_id):
    data = redis_client.get(f"party:{party_id}")
    return json.loads(data) if data else None


def delete_party_from_redis(party_id):
    redis_client.delete(f"party:{party_id}")

@app.get("/api/party/{party_id}")
def get_party_details(party_id: str):
    party = load_party_from_redis(party_id)
    if not party:
        raise HTTPException(status_code=405, detail="Party not found")
    # Return relevant party details, including the creator's ID
    return JSONResponse({
        "party_id": party_id,
        "creator_id": party.get("creator"),
        "state": party.get("state"),
        "rounds": party.get("rounds"),
        "participants": get_user_ids_for_party(party_id)
    })

@app.get("/api/parties")
async def get_all_parties():
    users = await get_all_users()
    parties = []
    for key in redis_client.scan_iter("party:*"):
        party_data = redis_client.get(key)
        party_id = key.split(":")[1]
        if party_data:
            party = json.loads(party_data)
            party_creator = party.get("creator")
            parties.append({
                "party_id": party_id,
                "creator": users[party_creator].get("user_name"), # TODO: fix this.  User may not be in redis
                "state": party.get("state"),
                "rounds": party.get("rounds"),
                "participants": get_user_ids_for_party(party_id)
            })
    return JSONResponse({"parties": parties})

@app.get("/api/categories")
async def get_categories():
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT DISTINCT category FROM questions")
            categories = cursor.fetchall()
    
    category_list = [category[0] for category in categories]
    
    return JSONResponse({"categories": category_list})

def get_party_or_404(party_id: str):
    party = load_party_from_redis(party_id)
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    return party

def set_party_state(party: dict, state: str) -> dict:
    party["state"] = state
    return party

def update_current_question(party: dict, question: dict) -> dict:
    party["current_question"] = question
    return party

def set_current_round(party: dict) -> dict:
    party["current_round"] += 1
    return party

def update_player_score(party_id, category, user_id):
    user_data = load_user_from_redis(user_id)
    if user_data:
        user_data["current_party"]["party_id"] = party_id
        user_data["current_party"]["score"] = user_data["current_party"]["score"] + 1
        user_data["current_party"]["category_scores"][category] = user_data["current_party"]["category_scores"].get(category, 0) + 1
        save_user_to_redis(user_id, user_data)

def save_party_to_redis(party_id, party_data):
    redis_client.set(f"party:{party_id}", json.dumps(party_data))

def save_user_to_redis(user_id, user_data):
    redis_client.set(f"user:{user_id}", json.dumps(user_data))

def load_user_from_redis(user_id):
    data = redis_client.get(f"user:{user_id}")
    return json.loads(data) if data else None

async def get_all_users():
    users = {}
    for key in redis_client.scan_iter("user:*"):
        user_data = redis_client.get(key)
        if user_data:
            user = json.loads(user_data)
            user_id = key.split(':')[1]
            users[user_id] = user
    return users

def get_user_ids_for_party(party_id: str) -> str:
    party_sockets = websocket_connections.get(party_id, {})
    user_names = []
    for user_id in party_sockets.keys():
        user_data = load_user_from_redis(user_id)
        if user_data:
            user_names.append(user_data.get("user_name", "Unknown"))
    return ','.join(user_names)

def get_player_scores(party_id: str) -> dict:
    party = load_party_from_redis(party_id)
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")

    player_scores = {}
    party_sockets = websocket_connections.get(party_id, {})
    
    for user_id in party_sockets.keys():
        user_data = load_user_from_redis(user_id)
        if user_data:
            user_name = user_data.get("user_name", "Unknown")
            current_party = user_data.get("current_party", {})
            player_scores[user_name] = {
                "total_score": current_party.get("score", 0),
                "category_scores": current_party.get("category_scores", {})
            }

    return player_scores

def is_user_in_party(party_id: str, user_id: str) -> bool:
    party_sockets = websocket_connections.get(party_id, {})
    return user_id in party_sockets

