from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Alert, User
from ..security import current_user
from ..serializers import row

router = APIRouter(prefix="/api/alerts", tags=["alertas"])


@router.get("")
def list_alerts(unread: bool = False, limit: int = 100, user: User = Depends(current_user), db: Session = Depends(get_db)):
    stmt = select(Alert).where(Alert.user_id == user.id)
    if unread:
        stmt = stmt.where(Alert.read.is_(False))
    return [row(a) for a in db.scalars(stmt.order_by(Alert.created_at.desc()).limit(min(limit, 500)))]


@router.post("/{alert_id}/read")
def mark_read(alert_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = db.get(Alert, alert_id)
    if not a or a.user_id != user.id:
        raise HTTPException(404, "Alerta no encontrada")
    a.read = True
    db.commit()
    return {"ok": True}


@router.post("/read-all")
def mark_all(user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(update(Alert).where(Alert.user_id == user.id).values(read=True))
    db.commit()
    return {"ok": True}
