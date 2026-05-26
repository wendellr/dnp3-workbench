from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from uuid import uuid4

app = FastAPI(title="DNP3 Outstation Simulator")

class DataPoint(BaseModel):
    id: str
    index: int
    group: int
    variation: int
    value: str = "0"
    quality: str = "ONLINE"
    description: str = ""

points_db: List[DataPoint] = []

@app.get("/points", response_model=List[DataPoint])
def list_points():
    return points_db

@app.post("/points", response_model=DataPoint)
def create_point(point: DataPoint):
    points_db.append(point)
    return point

@app.post("/points/auto", response_model=DataPoint)
def create_point_auto(point: DataPoint):
    point.id = str(uuid4())
    points_db.append(point)
    return point

@app.get("/points/{point_id}", response_model=DataPoint)
def get_point(point_id: str):
    for p in points_db:
        if p.id == point_id:
            return p
    raise HTTPException(status_code=404, detail="Point not found")

@app.put("/points/{point_id}", response_model=DataPoint)
def update_point(point_id: str, update: DataPoint):
    for i, p in enumerate(points_db):
        if p.id == point_id:
            points_db[i] = update
            return update
    raise HTTPException(status_code=404, detail="Point not found")

@app.delete("/points/{point_id}")
def delete_point(point_id: str):
    global points_db
    points_db = [p for p in points_db if p.id != point_id]
    return {"ok": True}
