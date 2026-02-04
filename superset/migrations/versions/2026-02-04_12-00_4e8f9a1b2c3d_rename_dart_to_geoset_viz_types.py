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
"""rename_dart_to_geoset_viz_types

Revision ID: 4e8f9a1b2c3d
Revises: c233f5365c9e
Create Date: 2026-02-04 12:00:00.000000

"""

from alembic import op
from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db
from superset.migrations.shared.utils import paginated_update
from superset.utils import json

# revision identifiers, used by Alembic.
revision = "4e8f9a1b2c3d"
down_revision = "c233f5365c9e"


Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    viz_type = Column(String(250))
    params = Column(Text)


# Mapping of old viz_type names to new viz_type names
viz_type_mapping = {
    "deck_dart_map": "deck_geoset_map",
    "deck_dart_map_layer": "deck_geoset_map_layer",
}


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    # Update all charts with old viz_types using paginated_update for efficiency
    for slc in paginated_update(
        session.query(Slice).filter(Slice.viz_type.in_(viz_type_mapping.keys()))
    ):
        old_type = slc.viz_type
        new_type = viz_type_mapping[old_type]

        # Update viz_type column
        slc.viz_type = new_type

        # Update any references to viz_type in params JSON
        try:
            params = json.loads(slc.params)
            if params.get("viz_type") == old_type:
                params["viz_type"] = new_type
                slc.params = json.dumps(params)
        except (json.JSONDecodeError, TypeError):
            # If params can't be parsed, leave them as-is
            pass

    session.commit()
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    # Reverse mapping for downgrade
    reverse_mapping = {v: k for k, v in viz_type_mapping.items()}

    # Revert all charts with new viz_types back to old viz_types
    for slc in paginated_update(
        session.query(Slice).filter(Slice.viz_type.in_(reverse_mapping.keys()))
    ):
        old_type = slc.viz_type
        new_type = reverse_mapping[old_type]

        # Revert viz_type column
        slc.viz_type = new_type

        # Revert any references to viz_type in params JSON
        try:
            params = json.loads(slc.params)
            if params.get("viz_type") == old_type:
                params["viz_type"] = new_type
                slc.params = json.dumps(params)
        except (json.JSONDecodeError, TypeError):
            # If params can't be parsed, leave them as-is
            pass

    session.commit()
    session.close()
