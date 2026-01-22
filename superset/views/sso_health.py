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

from flask import Blueprint, jsonify, request

from superset import talisman
from superset.superset_typing import FlaskResponse

logger = logging.getLogger(__name__)

sso_health_blueprint = Blueprint("sso_health", __name__)


@sso_health_blueprint.route("/api/v1/sso/failure", methods=["POST"])
@talisman(force_https=False)
def sso_failure() -> FlaskResponse:
    """
    Log SSO connection failure from frontend.

    Logs the client IP address, timestamp, and user timezone when SSO is unreachable.
    """
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    data = request.get_json() or {}
    user_timezone = data.get("timezone", "Unknown")
    local_time = data.get("localTime", "Unknown")

    logger.warning(
        "SSO failure reported - IP: %s, Time: %s (%s)",
        client_ip,
        local_time,
        user_timezone,
    )

    return jsonify({
        "logged": True,
        "ip": client_ip,
        "local_time": local_time,
        "user_timezone": user_timezone,
    })
