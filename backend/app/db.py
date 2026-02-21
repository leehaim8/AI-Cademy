from __future__ import annotations

import certifi
from pymongo import ASCENDING, MongoClient
from pymongo.collection import Collection

from .config import MONGODB_DB_NAME, MONGODB_URI

mongo_client = MongoClient(MONGODB_URI, tlsCAFile=certifi.where())
database = mongo_client[MONGODB_DB_NAME]
users_collection: Collection = database["users"]


def init_indexes() -> None:
    users_collection.create_index([("email", ASCENDING)], unique=True)
