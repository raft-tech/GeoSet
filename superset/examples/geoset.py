"""Post-import hooks for GeoSet example data."""

from superset import db
from superset.models.slice import Slice
from superset.utils import json


def resolve_geoset_multi_map_layers() -> None:
    """Resolve UUID references to runtime chart IDs for GeoSet multi-layer maps.

    Also fixes the ``datasource`` field inside each GeoSet chart's ``params``
    JSON so that the Multi Map can query sub-chart data correctly.  The YAML
    importer sets the chart model's ``datasource_id`` / ``datasource_type`` but
    leaves the ``params`` blob with the placeholder ``0__table``.
    """
    # Fix datasource in params for all GeoSet charts (layers + multi-maps)
    all_geoset = (
        db.session.query(Slice)
        .filter(
            Slice.viz_type.in_(["deck_geoset_map_layer", "deck_geoset_map"])
        )
        .all()
    )
    for chart in all_geoset:
        if not chart.datasource_id:
            continue
        chart_params = json.loads(chart.params or "{}")
        correct_ds = f"{chart.datasource_id}__{chart.datasource_type}"
        if chart_params.get("datasource") != correct_ds:
            chart_params["datasource"] = correct_ds
            chart.params = json.dumps(chart_params)

    # Resolve UUID references to runtime slice IDs for multi-layer maps
    charts = (
        db.session.query(Slice)
        .filter(Slice.viz_type == "deck_geoset_map")
        .all()
    )
    for chart in charts:
        chart_params = json.loads(chart.params or "{}")
        deck_slice_uuids = chart_params.pop("deck_slice_uuids", None)
        if not deck_slice_uuids:
            continue

        resolved_slices = []
        for item in deck_slice_uuids:
            uuid_ref = item.get("uuid") if isinstance(item, dict) else str(item)
            layer_chart = (
                db.session.query(Slice).filter_by(uuid=uuid_ref).first()
            )
            if not layer_chart:
                continue
            resolved_slices.append(
                {
                    "sliceId": layer_chart.id,
                    "autozoom": item.get("autozoom", True)
                    if isinstance(item, dict)
                    else True,
                    "legendCollapsed": item.get("legendCollapsed", False)
                    if isinstance(item, dict)
                    else False,
                    "initiallyHidden": item.get("initiallyHidden", False)
                    if isinstance(item, dict)
                    else False,
                }
            )

        if resolved_slices:
            chart_params["deck_slices"] = resolved_slices
            chart.params = json.dumps(chart_params)
