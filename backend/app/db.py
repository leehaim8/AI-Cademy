from __future__ import annotations

import certifi
from pymongo import ASCENDING, MongoClient
from pymongo.collection import Collection

from .config import MONGODB_DB_NAME, MONGODB_URI

mongo_client = MongoClient(MONGODB_URI, tlsCAFile=certifi.where())
database = mongo_client[MONGODB_DB_NAME]
users_collection: Collection = database["users"]
courses_collection: Collection = database["courses"]
course_members_collection: Collection = database["course_members"]
course_agents_collection: Collection = database["course_agents"]
sessions_collection: Collection = database["sessions"]
session_runs_collection: Collection = database["session_runs"]


def init_indexes() -> None:
    users_collection.create_index([("email", ASCENDING)], unique=True)
    courses_collection.create_index([("owner_user_id", ASCENDING)])
    course_members_collection.create_index(
        [("course_id", ASCENDING), ("user_id", ASCENDING)],
        unique=True,
    )
    course_agents_collection.create_index(
        [("course_id", ASCENDING), ("agent_key", ASCENDING)],
        unique=True,
    )
    sessions_collection.create_index([("course_id", ASCENDING), ("agent_key", ASCENDING)])
    session_runs_collection.create_index([("session_id", ASCENDING)])
