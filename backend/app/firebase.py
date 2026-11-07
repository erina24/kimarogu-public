import firebase_admin
from firebase_admin import credentials

from app.config import settings


def init_firebase() -> None:
    try:
        firebase_admin.get_app()
    except ValueError:
        cred = credentials.Certificate(settings.firebase_credentials_path)
        firebase_admin.initialize_app(cred)