"""
Usage aggregator task — runs every 60 seconds.
Flushes packet_capture counters into bandwidth_usage and dns_queries tables.
"""
import logging
from datetime import datetime, timezone

from sqlalchemy import select, text
from backend.database.engine import AsyncSessionLocal
from backend.database.models.device import Device
from backend.database.models.usage import BandwidthUsage, DnsQuery
from backend.services.packet_capture import (
    get_and_reset_counters, get_and_reset_dns_queue,
    merge_counters, merge_dns_queue,
)
from backend.services.threat_service import check_domain

logger = logging.getLogger("roost.usage_aggregator")


def _bucket(dt: datetime) -> datetime:
    """Truncate datetime to 1-minute resolution."""
    return dt.replace(second=0, microsecond=0)


async def flush_usage() -> None:
    """
    Pull counters from packet_capture, match IPs to devices, and upsert rows.
    This function is safe to call even when no data has been captured.
    """
    byte_counters = get_and_reset_counters()
    dns_queue = get_and_reset_dns_queue()

    if not byte_counters and not dns_queue:
        return

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    bucket = _bucket(now)

    committed = False
    try:
        async with AsyncSessionLocal() as session:
            # Load all devices keyed by ip_address
            result = await session.execute(
                select(Device.id, Device.ip_address).where(Device.ip_address.isnot(None))
            )
            ip_to_device: dict[str, int] = {row.ip_address: row.id for row in result}

            # ── bandwidth upsert ────────────────────────────────────────────
            for ip, (sent, recv) in byte_counters.items():
                device_id = ip_to_device.get(ip)
                if device_id is None:
                    continue
                if sent == 0 and recv == 0:
                    continue

                await session.execute(
                    text(
                        """
                        INSERT INTO bandwidth_usage
                            (device_id, bucket_time, bytes_sent, bytes_recv,
                             packets_sent, packets_recv)
                        VALUES
                            (:device_id, :bucket_time, :sent, :recv, 0, 0)
                        ON CONFLICT (device_id, bucket_time)
                        DO UPDATE SET
                            bytes_sent  = bandwidth_usage.bytes_sent  + excluded.bytes_sent,
                            bytes_recv  = bandwidth_usage.bytes_recv  + excluded.bytes_recv
                        """
                    ),
                    {
                        "device_id": device_id,
                        "bucket_time": bucket,
                        "sent": sent,
                        "recv": recv,
                    },
                )

            # ── dns upsert ──────────────────────────────────────────────────
            # Track new threats to alert after session commit
            new_threats: list[tuple[int, str, str, str]] = []  # (device_id, src_ip, domain, threat_type)

            for (src_ip, domain), count in dns_queue.items():
                device_id = ip_to_device.get(src_ip)
                if device_id is None:
                    continue

                is_threat, threat_type = await check_domain(domain)

                await session.execute(
                    text(
                        """
                        INSERT INTO dns_queries
                            (device_id, domain, query_count, first_seen, last_seen,
                             is_threat, threat_type)
                        VALUES
                            (:device_id, :domain, :count, :now, :now, :is_threat, :threat_type)
                        ON CONFLICT (device_id, domain)
                        DO UPDATE SET
                            query_count = dns_queries.query_count + excluded.query_count,
                            last_seen   = excluded.last_seen,
                            is_threat   = excluded.is_threat,
                            threat_type = excluded.threat_type
                        """
                    ),
                    {
                        "device_id": device_id,
                        "domain": domain,
                        "count": count,
                        "now": now,
                        "is_threat": 1 if is_threat else 0,
                        "threat_type": threat_type,
                    },
                )

                if is_threat:
                    new_threats.append((device_id, src_ip, domain, threat_type or "unknown"))

            await session.commit()
            committed = True
            logger.debug(
                f"Usage flush: {len(byte_counters)} IPs, {len(dns_queue)} DNS entries"
            )

        # Bandwidth enforcement (auto-block devices that exceed their limit)
        if byte_counters:
            from backend.services.bandwidth_limiter import enforce_bandwidth_limits
            await enforce_bandwidth_limits(ip_to_device, byte_counters)

        # Fire threat alerts outside the DB session (session already committed)
        for device_id, src_ip, domain, threat_type in new_threats:
            try:
                from backend.database.models.alert import create_alert
                await create_alert(
                    type="threat_detected",
                    severity="warning",
                    title="Threat Domain Detected",
                    message=f"A device at {src_ip} queried {domain} ({threat_type}).",
                    device_id=device_id,
                )
            except Exception as e:
                logger.error(f"Failed to create threat alert: {e}")

    except Exception as e:
        logger.error(f"Usage aggregator error: {e}")
        if not committed:
            # DB write never landed — put the counters back so the data is
            # retried next cycle instead of being silently lost.
            merge_counters(byte_counters)
            merge_dns_queue(dns_queue)
