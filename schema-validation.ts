import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

/**
 * SCHEMA VALIDATION & DRIFT PREVENTION SYSTEM
 * 
 * This system prevents future schema drift by:
 * 1. Validating schema consistency across environments
 * 2. Enforcing migration-only changes
 * 3. Automated testing and monitoring
 * 4. Pre-deployment validation
 */

interface SchemaValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    tablesChecked: number;
    columnsChecked: number;
    inconsistenciesFound: number;
  };
}

interface TableSchema {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    defaultValue: string | null;
    primaryKey: boolean;
  }>;
  foreignKeys: Array<{
    column: string;
    referencedTable: string;
    referencedColumn: string;
  }>;
}

// MASTER SCHEMA DEFINITION - Single Source of Truth
const MASTER_SCHEMA_DEFINITION = {
  version: "1.0.0",
  description: "Unified SQLite Schema - Single Source of Truth",
  lastUpdated: new Date().toISOString(),
  
  tables: {
    organizations: {
      requiredColumns: [
        "id", "name", "domain", "subdomain", "plan", "status", 
        "timezone", "date_format", "currency", "settings", 
        "billing_settings", "compliance_settings", "integration_settings",
        "created_at", "updated_at"
      ],
      requiredTypes: {
        id: "INTEGER",
        name: "TEXT",
        timezone: "TEXT",
        settings: "TEXT"
      }
    },
    
    users: {
      requiredColumns: [
        "id", "organization_id", "email", "first_name", "last_name",
        "password_hash", "phone", "role", "manager_id", "is_active",
        "permissions", "has_temporary_password", "temporary_password",
        "settings", "last_login_at", "created_at", "updated_at"
      ],
      requiredTypes: {
        id: "INTEGER",
        organization_id: "INTEGER",
        email: "TEXT",
        is_active: "INTEGER"
      }
    },
    
    jobs: {
      requiredColumns: [
        "id", "organization_id", "team_id", "created_by", "title",
        "description", "experience_level", "job_type", "keywords",
        "requirements", "location", "salary_min", "salary_max",
        "original_file_name", "status", "approved_by", "approved_at",
        "closed_at", "filled_at", "requires_approval", "auto_publish_at",
        "application_deadline", "settings", "created_at", "updated_at"
      ],
      requiredTypes: {
        id: "INTEGER",
        organization_id: "INTEGER",
        title: "TEXT",
        salary_min: "INTEGER",
        salary_max: "INTEGER"
      }
    },
    
    candidates: {
      requiredColumns: [
        "id", "organization_id", "added_by", "name", "email", "phone",
        "experience", "resume_content", "resume_file_name", "source",
        "tags", "status", "created_at", "updated_at"
      ],
      requiredTypes: {
        id: "INTEGER",
        organization_id: "INTEGER",
        experience: "INTEGER"
      }
    },
    
    job_matches: {
      requiredColumns: [
        "id", "organization_id", "job_id", "candidate_id", "matched_by",
        "match_percentage", "ai_reasoning", "match_criteria", "status",
        "created_at", "updated_at"
      ],
      requiredTypes: {
        id: "INTEGER",
        match_percentage: "REAL"
      }
    },
    
    interviews: {
      requiredColumns: [
        "id", "organization_id", "job_id", "candidate_id", "match_id",
        "scheduled_by", "scheduled_date_time", "duration", "status",
        "interview_type", "meeting_link", "notes", "interviewer_name",
        "interviewer_email", "reminder_sent", "transcript_path", "outcome",
        "feedback", "created_at", "updated_at"
      ],
      requiredTypes: {
        id: "INTEGER",
        duration: "INTEGER",
        reminder_sent: "INTEGER"
      }
    },
    
    // Additional tables that must exist
    teams: { requiredColumns: ["id", "organization_id", "name", "description", "manager_id", "settings", "created_at", "updated_at"] },
    user_teams: { requiredColumns: ["id", "organization_id", "user_id", "team_id", "role", "created_at"] },
    audit_logs: { requiredColumns: ["id", "organization_id", "user_id", "action", "entity_type", "entity_id", "details", "ip_address", "user_agent", "created_at"] },
    usage_metrics: { requiredColumns: ["id", "organization_id", "user_id", "metric_type", "metric_value", "billing_period", "metadata", "created_at"] },
    organization_credentials: { requiredColumns: ["id", "organization_id", "admin_user_id", "email", "temporary_password", "is_password_changed", "expires_at", "created_at", "updated_at"] },
    user_credentials: { requiredColumns: ["id", "organization_id", "email", "temporary_password", "is_password_changed", "expires_at", "created_at", "updated_at"] },
    applications: { requiredColumns: ["id", "organization_id", "job_id", "candidate_id", "applied_by", "status", "substatus", "current_stage", "applied_at", "match_percentage", "source", "notes", "last_stage_change_at", "last_stage_changed_by", "created_at", "updated_at"] },
    job_assignments: { requiredColumns: ["id", "job_id", "user_id", "role", "assigned_by", "created_at"] },
    candidate_assignments: { requiredColumns: ["id", "candidate_id", "user_id", "role", "assigned_by", "created_at"] },
    candidate_submissions: { requiredColumns: ["id", "organization_id", "submitted_by", "name", "email", "phone", "experience", "resume_content", "resume_file_name", "source", "tags", "status", "submission_notes", "reviewed_by", "reviewed_at", "review_notes", "created_at", "updated_at"] },
    status_history: { requiredColumns: ["id", "organization_id", "entity_type", "entity_id", "old_status", "new_status", "changed_by", "reason", "notes", "changed_at"] },
    job_templates: { requiredColumns: ["id", "job_id", "organization_id", "position_title", "seniority_level", "department", "mandatory_skills", "preferred_skills", "skill_proficiency_levels", "primary_technologies", "secondary_technologies", "technology_categories", "minimum_years_required", "specific_domain_experience", "industry_background", "technical_tasks_percentage", "leadership_tasks_percentage", "domain_tasks_percentage", "skills_match_weight", "experience_weight", "keyword_weight", "technical_depth_weight", "domain_knowledge_weight", "raw_job_description", "ai_generated_data", "template_version", "status", "reviewed_by", "created_at", "updated_at"] }
  }
};

export class SchemaValidator {
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async validateAgainstMasterSchema(): Promise<SchemaValidationResult> {
    const result: SchemaValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      summary: {
        tablesChecked: 0,
        columnsChecked: 0,
        inconsistenciesFound: 0
      }
    };

    try {
      console.log(`🔍 Validating database schema: ${this.dbPath}`);
      
      if (!fs.existsSync(this.dbPath)) {
        result.errors.push(`Database file does not exist: ${this.dbPath}`);
        result.isValid = false;
        return result;
      }

      const db = new Database(this.dbPath, { readonly: true });
      
      // Get actual database schema
      const actualSchema = await this.extractDatabaseSchema(db);
      
      // Validate against master schema
      await this.validateTablesExist(actualSchema, result);
      await this.validateRequiredColumns(actualSchema, result);
      await this.validateColumnTypes(actualSchema, result);
      
      db.close();
      
      result.isValid = result.errors.length === 0;
      
      console.log(`📊 Schema validation completed:`);
      console.log(`   Tables checked: ${result.summary.tablesChecked}`);
      console.log(`   Columns checked: ${result.summary.columnsChecked}`);
      console.log(`   Issues found: ${result.summary.inconsistenciesFound}`);
      
      return result;
      
    } catch (error) {
      result.errors.push(`Validation failed: ${error.message}`);
      result.isValid = false;
      return result;
    }
  }

  private async extractDatabaseSchema(db: Database.Database): Promise<Map<string, TableSchema>> {
    const schema = new Map<string, TableSchema>();
    
    // Get all tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    
    for (const tableRow of tables) {
      const tableName = tableRow.name;
      
      // Get columns for this table
      const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
      
      // Get foreign keys for this table
      const foreignKeys = db.prepare(`PRAGMA foreign_key_list(${tableName})`).all();
      
      const tableSchema: TableSchema = {
        name: tableName,
        columns: columns.map((col: any) => ({
          name: col.name,
          type: col.type,
          nullable: col.notnull === 0,
          defaultValue: col.dflt_value,
          primaryKey: col.pk === 1
        })),
        foreignKeys: foreignKeys.map((fk: any) => ({
          column: fk.from,
          referencedTable: fk.table,
          referencedColumn: fk.to
        }))
      };
      
      schema.set(tableName, tableSchema);
    }
    
    return schema;
  }

  private async validateTablesExist(actualSchema: Map<string, TableSchema>, result: SchemaValidationResult): Promise<void> {
    const requiredTables = Object.keys(MASTER_SCHEMA_DEFINITION.tables);
    
    for (const requiredTable of requiredTables) {
      result.summary.tablesChecked++;
      
      if (!actualSchema.has(requiredTable)) {
        result.errors.push(`Missing required table: ${requiredTable}`);
        result.summary.inconsistenciesFound++;
      }
    }
    
    // Check for unexpected tables
    for (const actualTable of actualSchema.keys()) {
      if (!requiredTables.includes(actualTable)) {
        result.warnings.push(`Unexpected table found: ${actualTable}`);
      }
    }
  }

  private async validateRequiredColumns(actualSchema: Map<string, TableSchema>, result: SchemaValidationResult): Promise<void> {
    for (const [tableName, requirements] of Object.entries(MASTER_SCHEMA_DEFINITION.tables)) {
      const actualTable = actualSchema.get(tableName);
      
      if (!actualTable) continue; // Already reported as missing table
      
      const actualColumnNames = actualTable.columns.map(col => col.name);
      
      for (const requiredColumn of requirements.requiredColumns) {
        result.summary.columnsChecked++;
        
        if (!actualColumnNames.includes(requiredColumn)) {
          result.errors.push(`Table '${tableName}' missing required column: ${requiredColumn}`);
          result.summary.inconsistenciesFound++;
        }
      }
    }
  }

  private async validateColumnTypes(actualSchema: Map<string, TableSchema>, result: SchemaValidationResult): Promise<void> {
    for (const [tableName, requirements] of Object.entries(MASTER_SCHEMA_DEFINITION.tables)) {
      const actualTable = actualSchema.get(tableName);
      
      if (!actualTable || !requirements.requiredTypes) continue;
      
      for (const [columnName, expectedType] of Object.entries(requirements.requiredTypes)) {
        const actualColumn = actualTable.columns.find(col => col.name === columnName);
        
        if (actualColumn && actualColumn.type !== expectedType) {
          result.errors.push(`Table '${tableName}' column '${columnName}' has type '${actualColumn.type}', expected '${expectedType}'`);
          result.summary.inconsistenciesFound++;
        }
      }
    }
  }

  // Generate a schema report for documentation
  async generateSchemaReport(): Promise<string> {
    const db = new Database(this.dbPath, { readonly: true });
    const actualSchema = await this.extractDatabaseSchema(db);
    db.close();
    
    let report = `# Database Schema Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Database: ${this.dbPath}\n\n`;
    
    for (const [tableName, tableSchema] of actualSchema) {
      report += `## Table: ${tableName}\n\n`;
      report += `| Column | Type | Nullable | Default | Primary Key |\n`;
      report += `|--------|------|----------|---------|-------------|\n`;
      
      for (const column of tableSchema.columns) {
        report += `| ${column.name} | ${column.type} | ${column.nullable} | ${column.defaultValue || 'NULL'} | ${column.primaryKey} |\n`;
      }
      
      if (tableSchema.foreignKeys.length > 0) {
        report += `\n### Foreign Keys:\n`;
        for (const fk of tableSchema.foreignKeys) {
          report += `- ${fk.column} → ${fk.referencedTable}.${fk.referencedColumn}\n`;
        }
      }
      
      report += `\n`;
    }
    
    return report;
  }
}

// Pre-deployment validation function
export async function preDeploymentValidation(developmentDbPath: string, testDbPath?: string): Promise<boolean> {
  console.log(`🚀 Running pre-deployment schema validation...`);
  
  try {
    // Validate development database
    const devValidator = new SchemaValidator(developmentDbPath);
    const devResult = await devValidator.validateAgainstMasterSchema();
    
    if (!devResult.isValid) {
      console.error(`❌ Development database validation failed:`);
      devResult.errors.forEach(error => console.error(`   - ${error}`));
      return false;
    }
    
    // Validate test database if provided
    if (testDbPath && fs.existsSync(testDbPath)) {
      const testValidator = new SchemaValidator(testDbPath);
      const testResult = await testValidator.validateAgainstMasterSchema();
      
      if (!testResult.isValid) {
        console.error(`❌ Test database validation failed:`);
        testResult.errors.forEach(error => console.error(`   - ${error}`));
        return false;
      }
    }
    
    console.log(`✅ Pre-deployment validation passed`);
    return true;
    
  } catch (error) {
    console.error(`❌ Pre-deployment validation error:`, error);
    return false;
  }
}

// Continuous monitoring function
export async function monitorSchemaDrift(dbPath: string): Promise<void> {
  console.log(`📊 Monitoring schema drift for: ${dbPath}`);
  
  const validator = new SchemaValidator(dbPath);
  const result = await validator.validateAgainstMasterSchema();
  
  if (!result.isValid) {
    console.error(`🚨 SCHEMA DRIFT DETECTED!`);
    console.error(`Database: ${dbPath}`);
    console.error(`Issues found: ${result.summary.inconsistenciesFound}`);
    result.errors.forEach(error => console.error(`   - ${error}`));
    
    // In production, this could send alerts, create tickets, etc.
    await sendSchemaDriftAlert(dbPath, result);
  } else {
    console.log(`✅ Schema monitoring: No drift detected`);
  }
}

async function sendSchemaDriftAlert(dbPath: string, result: SchemaValidationResult): Promise<void> {
  // Placeholder for alerting system
  // Could integrate with Slack, email, monitoring systems, etc.
  console.log(`📧 Schema drift alert would be sent for: ${dbPath}`);
}

// CLI usage for schema validation
if (require.main === module) {
  const command = process.argv[2];
  const dbPath = process.argv[3] || "./data/development.db";
  
  switch (command) {
    case 'validate':
      const validator = new SchemaValidator(dbPath);
      validator.validateAgainstMasterSchema()
        .then(result => {
          if (result.isValid) {
            console.log(`✅ Schema validation passed`);
            process.exit(0);
          } else {
            console.error(`❌ Schema validation failed`);
            result.errors.forEach(error => console.error(`   - ${error}`));
            process.exit(1);
          }
        });
      break;
      
    case 'report':
      const reportValidator = new SchemaValidator(dbPath);
      reportValidator.generateSchemaReport()
        .then(report => {
          const reportPath = `schema-report-${Date.now()}.md`;
          fs.writeFileSync(reportPath, report);
          console.log(`📋 Schema report generated: ${reportPath}`);
        });
      break;
      
    case 'monitor':
      monitorSchemaDrift(dbPath);
      break;
      
    default:
      console.log(`Usage: node schema-validation.js [validate|report|monitor] [dbPath]`);
      process.exit(1);
  }
}
