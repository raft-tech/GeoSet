import { SupersetClient, JsonValue } from '@superset-ui/core';
import { CURRENT_VERSION } from '../layers/common';

export interface ValidationResult {
  success: boolean;
  error?: string;
}

export interface MigrationResult {
  success: boolean;
  data?: object;
  error?: string;
}

export interface SchemaCheckResult {
  success: boolean;
  error?: string | null;
  migrated?: boolean;
  fromVersion?: number;
  toVersion?: number;
}

async function validateSchema(
  version: string,
  payload: object,
): Promise<ValidationResult> {
  try {
    await SupersetClient.post({
      endpoint: `/api/v1/geoset_map/schema/${version}`,
      jsonPayload: payload,
    });
    return { success: true };
  } catch (err: any) {
    const body = await err?.json?.().catch(() => null);
    return {
      success: false,
      error: body?.message
        ? JSON.stringify(body.message, null, 2)
        : 'Validation API unavailable',
    };
  }
}

async function migrateSchema(
  fromVersion: string,
  toVersion: string,
  payload: object,
): Promise<MigrationResult> {
  try {
    const response = await SupersetClient.post({
      endpoint: `/api/v1/geoset_map/schema/${fromVersion}/${toVersion}`,
      jsonPayload: payload,
    });
    return { success: true, data: response.json?.result };
  } catch (err: any) {
    const body = await err?.json?.().catch(() => null);
    return {
      success: false,
      error: body?.message
        ? JSON.stringify(body.message, null, 2)
        : 'Migration API unavailable',
    };
  }
}

/**
 * Migrate form_data if needed (for use in Multi.tsx where we don't have setControlValue).
 * Returns the migrated form_data or the original if no migration needed.
 */
export async function multiChartMigration(
  formData: Record<string, any>,
): Promise<Record<string, any>> {
  const { geojsonConfig } = formData;
  const schemaVersion = formData.schema_version ?? formData.schemaVersion ?? 1;

  // No migration needed
  if (!geojsonConfig || schemaVersion >= CURRENT_VERSION) {
    return formData;
  }

  // Parse geojsonConfig if it's a string
  let config: object;
  try {
    config =
      typeof geojsonConfig === 'string'
        ? JSON.parse(geojsonConfig)
        : geojsonConfig;
  } catch {
    return formData;
  }

  // Call migration API
  try {
    const result = await migrateSchema(
      `v${schemaVersion}`,
      `v${CURRENT_VERSION}`,
      config,
    );

    if (result.success && result.data) {
      return {
        ...formData,
        geojsonConfig: JSON.stringify(result.data, null, 2),
        schema_version: CURRENT_VERSION,
      };
    }
  } catch {
    // Migration failed, use original
  }

  return formData;
}

export async function handleSchemaCheck(
  geojsonConfig: string,
  schemaVersion = 1,
  setControlValue: (control: string, value: JsonValue) => void,
): Promise<SchemaCheckResult> {
  if (!geojsonConfig) {
    return { success: true, error: null };
  }

  // Determine if migration is needed based on schema version
  const needsMigration = schemaVersion < CURRENT_VERSION;

  let config: object;
  try {
    config = JSON.parse(geojsonConfig);
  } catch {
    return { success: false, error: 'Invalid JSON syntax' };
  }

  if (needsMigration) {
    // Migration needed - convert from old version to current version
    const fromVersion = `v${schemaVersion}`;
    const toVersion = `v${CURRENT_VERSION}`;

    const migrationResult = await migrateSchema(fromVersion, toVersion, config);

    if (migrationResult.success && migrationResult.data) {
      // Update the geojsonConfig with migrated data
      const migratedConfigString = JSON.stringify(
        migrationResult.data,
        null,
        2,
      );
      setControlValue('geojsonConfig', migratedConfigString);
      setControlValue('schema_version', CURRENT_VERSION);
      return {
        success: true,
        error: null,
        migrated: true,
        fromVersion: schemaVersion,
        toVersion: CURRENT_VERSION,
      };
    }

    return {
      success: false,
      error: migrationResult.error || 'Migration failed',
    };
  }

  // No migration needed - just validate against current version
  const result = await validateSchema(`v${CURRENT_VERSION}`, config);
  return {
    success: result.success,
    error: result.success ? null : result.error || null,
  };
}
