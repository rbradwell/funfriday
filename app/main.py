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

@app.get("/api/categories")
async def get_categories():
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT DISTINCT category FROM questions")
            categories = cursor.fetchall()
    
    # Extract categories from the query result
    category_list = [category[0] for category in categories]
    
    return JSONResponse({"categories": category_list})

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

@app.on_event("startup")
def log_routes():
    print("Registered Routes:")
    for route in app.routes:
        if hasattr(route, "methods"):
            methods = ", ".join(route.methods)
            print(f"Path: {route.path}, Methods: {methods}")

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
        "players": {},
        "question_pool": question_pool # TODO: separate question pool from party data
    }
    save_party_to_redis(party_id, party_data)

    return JSONResponse({"party_id": party_id})

# @app.post("/api/party/start")
async def start_game(request: PartyStartRequest):
    # Load the party from Redis
    party = load_party_from_redis(request.party_id)
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    
    # Ensure the user is the creator
    if party["creator"] != request.user_id:
        raise HTTPException(status_code=403, detail="Only the party creator can start the game")
    
    # Ensure the first round hasn't already started
    # TODO: allow users to join after the first round has started?
    if party["state"] != "waiting_for_players":
        raise HTTPException(status_code=400, detail="The game is already in progress or has ended")
    
    # Update the game state to in progress
    party["state"] = "in_progress"
    save_party_to_redis(request.party_id, party)

    # Start the first round
    asyncio.create_task(start_round(request.party_id))

    return JSONResponse({"message": "First round started successfully"})

async def start_round(party_id: str):
    party = load_party_from_redis(party_id)
    if not party:
        return

    if party["current_round"] > party["rounds"]:
        # Game over
        party["state"] = "ended_successfully"
        await broadcast_to_party(party_id, {"event": "game_over", "scores": party["players"]})
        delete_party_from_redis(party_id)
        return

    # Use question from the pre-fetched pool
    question = party["question_pool"].pop(0)
    party["current_question"] = question
    save_party_to_redis(party_id, party);

    await broadcast_to_party(party_id, {
        "event": "new_question",
        "round": party["current_round"],
        "timeout": party["timeout"],
        "question": question["question"],
        "choices": question["choices"]
    })

    # Wait for the timeout
    await asyncio.sleep(party["timeout"])

    if "current_question" in party:
        party.pop("current_question")
        await broadcast_to_party(party_id, {"event": "question_timeout"})
        party["current_round"] += 1
        save_party_to_redis(party_id, party)
        await start_round(party_id)


@app.post("/api/party/{party_id}/join")
def join_party(party_id: str, request: PartyJoinRequest):
    print(f"Joining party: {party_id}, user_id: {request.user_id}")
    # Load the party from Redis
    party = load_party_from_redis(party_id)
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")

    if request.user_id in party["players"]:
        print(f"User already in party: {request.user_id}")
        raise HTTPException(status_code=400, detail="User already in party")

    party["players"][request.user_id] = {"score": 0, "category_scores": {}}
    save_party_to_redis(party_id, party)

    print(f"Party after join: {party}")
    return JSONResponse({"message": "Joined party successfully", "game_id": party["game_id"]})


@app.websocket("/ws/{party_id}")
async def websocket_endpoint(websocket: WebSocket, party_id: str):
    print(f"Client connected to party: {party_id}")
    # Check the Origin header
    origin = websocket.headers.get("origin")
    print(f"Origin: {origin}")
    if origin not in ALLOWED_ORIGINS:
        print(f"Origin not in ALLOWED_ORIGINS: {origin}")
        await websocket.close(code=1008)  # Policy Violation
        return

    print(f"Origin is in ALLOWED_ORIGINS: {origin}")
    print(f"websocket.headers: {websocket.headers}")

    await websocket.accept()

    print("after accept")
    # Load the party from Redis
    party = load_party_from_redis(party_id)
    print(f"Party: {party_id}")
    if not party:
        print(f"Party not found: {party_id}")
        await websocket.close()
        return

    print(f"Current websocket connections for party {party_id}: {websocket_connections.get(party_id, [])}")

    # Add the client to the party's connection list
    websocket_connections.setdefault(party_id, []).append(websocket)

    print(f"Checking if current_question is in party: {party}")

    try:
        while True:
            print("waiting for data")
            data = await websocket.receive_json()
            print(f"Received data: {data}")

            # all events must have a party_id and user_id
            party_id = data.get("party_id")
            if not party_id:
                continue

            user_id = data.get("user_id")
            if not user_id:
                continue

            party = load_party_from_redis(party_id)
            print(f"Party loaded from redis: {party}")

            if not party:
                print(f"Party not found: {party_id}")
                continue

            if user_id not in party["players"]:
                print(f"User not in party: {user_id}")
                continue

            if data.get("event") == "answer":
                answer = data.get("answer")
                print(f"Received answer: {answer} for user: {user_id}")
                correct_answer = party["current_question"]["answer"]
                print(f"Correct answer: {correct_answer}")

                user_score = party["players"][user_id]["score"]
                print(f"User score: {user_score}")

                if answer == correct_answer:
                    print(f"Correct answer: {answer} for user: {user_id}")
                    party["players"][user_id]["score"] = user_score + 1
                    print(f"User score after correct answer: {party['players'][user_id]['score']}")

                # Update performance by category
                category = party["category"]
                party["players"][user_id]["category_scores"][category] = party["players"][user_id]["category_scores"].get(category, 0) + 1
                print(f"User category score: {party['players'][user_id]['category_scores'][category]}")

                print(f"Saving party to redis: {party}")
                save_party_to_redis(party_id, party)

                await broadcast_to_party(party_id, {
                    "event": "score_update",
                    "user_id": user_id,
                    "score": party["players"][user_id]["score"]
                })
            elif data.get("event") == "start_game":
                await start_game(PartyStartRequest(party_id=party_id, user_id=user_id))
                
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for party: {party_id}")
        # rework so that disconnected users are removed from the party
        websocket_connections[party_id].remove(websocket)
        if not websocket_connections[party_id]:
            party["state"] = "aborted"  # Mark the game as aborted if no connections remain
            # Remove party if no players are connected
            delete_party_from_redis(party_id)


async def broadcast_to_party(party_id: str, message: dict):
    party = load_party_from_redis(party_id)
    if party:
        for websocket in websocket_connections[party_id]:
            await websocket.send_json(message)


def save_party_to_redis(party_id, party_data):
    redis_client.set(f"party:{party_id}", json.dumps(party_data))


def load_party_from_redis(party_id):
    data = redis_client.get(f"party:{party_id}")
    return json.loads(data) if data else None


def delete_party_from_redis(party_id):
    redis_client.delete(f"party:{party_id}")

@app.get("/api/parties")
async def get_all_parties():
    parties = []
    for key in redis_client.scan_iter("party:*"):
        party_data = redis_client.get(key)
        if party_data:
            party = json.loads(party_data)
            parties.append({
                "party_id": key.split(":")[1],
                "creator": party.get("creator"),
                "state": party.get("state"),
                "rounds": party.get("rounds"),
                "participants": list(party.get("players", {}).keys())
            })
    return JSONResponse({"parties": parties})


