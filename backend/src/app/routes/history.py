from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Query

from app.models.schema import HistoryPoint, HistoryResponse, HistorySeries
from app.services import history_store
from app.settings import get_settings

router = APIRouter(tags=["history"])


@router.get("/history", response_model=HistoryResponse, response_model_by_alias=True)
def get_history(
    since: datetime | None = Query(
        None,
        description="UTC ISO Zeitfenster Untergrenze fuer Buckets",
    ),
    until: datetime | None = Query(
        None,
        description="UTC ISO Zeitfenster Obergrenze (inklusive Bucket-Zeit)",
    ),
    quota_ids: str | None = Query(
        None,
        alias="quotaIds",
        description="Komma-getrennte Quota-IDs",
    ),
) -> HistoryResponse:
    settings = get_settings()
    history_store.init_history_store(settings)

    since_epoch = int(since.timestamp()) if since is not None else None
    until_epoch = int(until.timestamp()) if until is not None else None
    quotas = (
        [q.strip() for q in quota_ids.split(",") if q.strip()]
        if quota_ids and quota_ids.strip()
        else None
    )

    raw = history_store.read_history(
        settings,
        quota_ids=quotas if quotas else None,
        since_epoch=since_epoch,
        until_epoch=until_epoch,
    )

    series = [
        HistorySeries(
            quota_id=qid,
            points=[
                HistoryPoint(
                    t=int(pt["t"]),
                    booked=int(pt["booked"]) if pt["booked"] is not None else None,
                    total=int(pt["total"]) if pt["total"] is not None else None,
                    waiting=int(pt["waiting"]) if pt["waiting"] is not None else None,
                    free=int(pt["free"]) if pt["free"] is not None else None,
                )
                for pt in pts
            ],
        )
        for qid, pts in sorted(raw.items(), key=lambda kv: kv[0])
    ]

    fetched = datetime.now(UTC)
    started = history_store.get_first_recorded_bucket(settings)

    return HistoryResponse(
        fetched_at=fetched,
        bucket_seconds=settings.history_bucket_seconds,
        recording_started_at=started,
        series=series,
    )
