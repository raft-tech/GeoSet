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
SSO Health Check endpoint.

This module provides an endpoint to check connectivity to the SSO provider.
Used by the frontend login page to detect if the user is on VPN.
"""
import logging

import requests
from flask import Blueprint, current_app, jsonify

from superset import talisman
from superset.superset_typing import FlaskResponse

logger = logging.getLogger(__name__)

sso_health_blueprint = Blueprint("sso_health", __name__)


@sso_health_blueprint.route("/api/v1/sso/health")
@talisman(force_https=False)
def sso_health_check() -> FlaskResponse:
    """
    Check connectivity to the SSO provider.

    Returns a JSON response with:
    - reachable: boolean indicating if SSO endpoint is reachable
    - status_code: HTTP status code from SSO endpoint (if any)
    - error: error message (if any)
    """
    sso_url = current_app.config.get("SSO_HEALTH_CHECK_URL")

    if not sso_url:
        return jsonify({
            "reachable": True,
            "status_code": None,
            "error": "SSO_HEALTH_CHECK_URL not configured",
            "configured": False,
        })

    try:
        response = requests.head(
            sso_url,
            timeout=5,
            allow_redirects=True,
        )
        return jsonify({
            "reachable": response.status_code < 400,
            "status_code": response.status_code,
            "error": None,
            "configured": True,
        })
    except requests.exceptions.Timeout:
        logger.warning("SSO health check timed out for URL: %s", sso_url)
        return jsonify({
            "reachable": False,
            "status_code": None,
            "error": "Connection timed out - you may not be connected to VPN",
            "configured": True,
        })
    except requests.exceptions.ConnectionError as e:
        logger.warning("SSO health check connection error: %s", str(e))
        return jsonify({
            "reachable": False,
            "status_code": None,
            "error": "Unable to connect - you may not be connected to VPN",
            "configured": True,
        })
    except requests.exceptions.RequestException as e:
        logger.error("SSO health check failed: %s", str(e))
        return jsonify({
            "reachable": False,
            "status_code": None,
            "error": str(e),
            "configured": True,
        })
