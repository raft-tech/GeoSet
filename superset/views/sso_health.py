# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""
SSO failure logging endpoint.

This module provides an endpoint to log SSO connection failures reported by the frontend.
"""
import logging

import requests
from flask import Blueprint, jsonify, request

from superset import talisman
from superset.superset_typing import FlaskResponse

logger = logging.getLogger(__name__)

sso_health_blueprint = Blueprint("sso_health", __name__)

MATTERMOST_WEBHOOK_URL = (
    "https://mattermost.teamraft.com/hooks/q7co9uqot7g398cnzg63kfxaay"
)


@sso_health_blueprint.route("/api/v1/sso/failure", methods=["POST"])
@talisman(force_https=False)
def sso_failure() -> FlaskResponse:
    """
    Log SSO connection failure from frontend.

    Logs the client IP address, timestamp, and user timezone when SSO is unreachable.
    Sends notification to Mattermost webhook.
    """
    data = request.get_json() or {}
    # Prefer IP from frontend (via ipify) if provided, fallback to request headers
    client_ip = data.get(
        "ipAddress", request.headers.get("X-Forwarded-For", request.remote_addr)
    )
    user_timezone = data.get("timezone", "Unknown")
    local_time = data.get("localTime", "Unknown")

    logger.warning(
        "SSO failure reported - IP: %s, Time: %s (%s)",
        client_ip,
        local_time,
        user_timezone,
    )

    # Send to Mattermost webhook
    try:
        mattermost_payload = {
            "text": (
                f"🚨 **SSO Connection Failure**\n"
                f"- **IP Address:** {client_ip}\n"
                f"- **Timezone:** {user_timezone}\n"
                f"- **Local Time:** {local_time}"
            )
        }
        requests.post(MATTERMOST_WEBHOOK_URL, json=mattermost_payload, timeout=10)
    except Exception as e:
        logger.error("Failed to send Mattermost notification: %s", e)

    return jsonify({
        "logged": True,
        "ip": client_ip,
        "local_time": local_time,
        "user_timezone": user_timezone,
    })
