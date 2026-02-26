"""CLI commands for GeoSet example data."""

import logging
from pathlib import Path

import click
from flask.cli import with_appcontext

from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)


@click.command()
@with_appcontext
@transaction()
def load_geoset_examples() -> None:
    """Load GeoSet example configs (databases, datasets, charts) into Superset."""
    from superset.examples.geoset import resolve_geoset_multi_map_layers
    from superset.examples.utils import load_configs_from_directory

    geoset_configs = Path(__file__).parent.parent / "examples" / "geoset_configs"

    logger.info("Loading GeoSet example configs from %s", geoset_configs)
    load_configs_from_directory(geoset_configs, overwrite=True)

    logger.info("Resolving GeoSet multi-map layer references")
    resolve_geoset_multi_map_layers()
