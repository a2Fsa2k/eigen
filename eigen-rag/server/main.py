from dotenv import load_dotenv
load_dotenv()  # reads .env before anything else imports os.getenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import pdf, chat
from api.middleware.logging import LoggingMiddleware

app = FastAPI(title="eigen-rag", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(LoggingMiddleware)

app.include_router(pdf.router)
app.include_router(chat.router)


@app.get("/status")
def status():
    return {"ready": True, "version": "0.1.0"}
