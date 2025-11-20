-- Migration: 032 - Comprehensive Project Details Schema
-- Adds extensive tables for large industrial projects with detailed cost, production, 
-- supply chain, market analysis, and milestone tracking

-- ============================================================================
-- PROJECT SUPPLIERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_suppliers (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  supplier_name VARCHAR(255) NOT NULL,
  supplier_type VARCHAR(50) NOT NULL, -- 'equipment', 'raw_materials', 'services', 'installation'
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  payment_terms VARCHAR(255), -- e.g., '30% down, 70% before shipment'
  delivery_timeline_days INT, -- estimated delivery in days
  warranty_months INT DEFAULT 12,
  notes TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_project_suppliers_project ON project_suppliers(project_id);
CREATE INDEX idx_project_suppliers_type ON project_suppliers(supplier_type);

-- ============================================================================
-- PROJECT EQUIPMENT TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_equipment (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  supplier_id BIGINT REFERENCES project_suppliers(id) ON DELETE SET NULL,
  equipment_name VARCHAR(255) NOT NULL,
  equipment_type VARCHAR(50), -- 'processing', 'storage', 'pumping', 'filling', etc.
  quantity INT NOT NULL DEFAULT 1,
  unit_cost_usd DECIMAL(12, 2) NOT NULL,
  total_cost_usd DECIMAL(15, 2) GENERATED ALWAYS AS (quantity * unit_cost_usd) STORED,
  
  -- Technical Specifications
  capacity_value DECIMAL(12, 2), -- numeric value
  capacity_unit VARCHAR(50), -- 'L/h', 'kg/h', 'T/h', 'kg', 'L', 'T', etc.
  power_consumption_kw DECIMAL(8, 2),
  material_of_construction VARCHAR(100), -- 'SUS 304', 'Stainless Steel', etc.
  
  -- Physical Dimensions
  length_mm INT,
  width_mm INT,
  height_mm INT,
  weight_kg DECIMAL(10, 2),
  
  -- Installation & Timeline
  installation_days INT,
  installation_cost_usd DECIMAL(12, 2),
  lead_time_days INT,
  
  -- Operational
  expected_lifespan_years INT,
  maintenance_cost_annual_usd DECIMAL(10, 2),
  expected_efficiency_percentage DECIMAL(5, 2),
  
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_project_equipment_project ON project_equipment(project_id);
CREATE INDEX idx_project_equipment_supplier ON project_equipment(supplier_id);
CREATE INDEX idx_project_equipment_type ON project_equipment(equipment_type);

-- ============================================================================
-- PROJECT COSTS TABLE (Aggregate by Category)
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_costs (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  cost_category VARCHAR(100) NOT NULL, -- 'equipment', 'installation', 'labor', 'permits', 'working_capital', 'contingency', 'land', 'infrastructure'
  budgeted_amount_usd DECIMAL(15, 2),
  actual_amount_usd DECIMAL(15, 2),
  currency_code VARCHAR(3) DEFAULT 'USD',
  percentage_of_total DECIMAL(5, 2), -- calculated percentage
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, cost_category)
);

CREATE INDEX idx_project_costs_project ON project_costs(project_id);

-- ============================================================================
-- PROJECT COST ITEMS TABLE (Line-Item Level)
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_cost_items (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  cost_id BIGINT REFERENCES project_costs(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  item_description TEXT,
  quantity DECIMAL(12, 4),
  unit_price_usd DECIMAL(12, 2),
  total_price_usd DECIMAL(15, 2) GENERATED ALWAYS AS (quantity * unit_price_usd) STORED,
  vendor_reference VARCHAR(100),
  invoice_date DATE,
  payment_date DATE,
  payment_status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'partial', 'paid'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_project_cost_items_project ON project_cost_items(project_id);
CREATE INDEX idx_project_cost_items_cost ON project_cost_items(cost_id);

-- ============================================================================
-- PRODUCTION CAPACITY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS production_capacity (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_name VARCHAR(100), -- 'Phase 1', 'Year 1', 'Full Scale', etc.
  product_type VARCHAR(100), -- 'coconut_oil', 'coconut_water', 'coir', etc.
  
  -- Capacity Metrics
  capacity_per_hour DECIMAL(12, 2),
  capacity_per_day DECIMAL(12, 2),
  capacity_per_month DECIMAL(12, 2),
  capacity_per_year DECIMAL(12, 2),
  capacity_unit VARCHAR(50), -- 'L', 'kg', 'T', 'MT', 'units'
  
  -- Utilization Targets
  utilization_percentage DECIMAL(5, 2) DEFAULT 80, -- expected utilization %
  effective_annual_output DECIMAL(12, 2) GENERATED ALWAYS AS (
    CASE 
      WHEN capacity_per_year IS NOT NULL THEN capacity_per_year * (COALESCE(utilization_percentage, 100) / 100)
      ELSE NULL 
    END
  ) STORED,
  
  -- Timeline
  phase_start_date DATE,
  phase_end_date DATE,
  
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_production_capacity_project ON production_capacity(project_id);

-- ============================================================================
-- REVENUE PROJECTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS revenue_projections (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  product_type VARCHAR(100) NOT NULL,
  
  -- Volume & Pricing
  projected_annual_volume DECIMAL(12, 2),
  volume_unit VARCHAR(50), -- 'L', 'kg', 'T', 'MT', 'units'
  unit_price_usd DECIMAL(12, 2),
  currency_code VARCHAR(3) DEFAULT 'USD',
  
  -- Revenue Calculation
  projected_annual_revenue_usd DECIMAL(15, 2) GENERATED ALWAYS AS (
    CASE 
      WHEN projected_annual_volume IS NOT NULL AND unit_price_usd IS NOT NULL 
      THEN projected_annual_volume * unit_price_usd
      ELSE NULL
    END
  ) STORED,
  
  -- Timeline
  year_number INT, -- Year 1, 2, 3, etc.
  scenario VARCHAR(50), -- 'conservative', 'moderate', 'optimistic'
  
  -- Notes
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_revenue_projections_project ON revenue_projections(project_id);
CREATE INDEX idx_revenue_projections_product ON revenue_projections(product_type);

-- ============================================================================
-- MARKET FORECASTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_forecasts (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  forecast_type VARCHAR(100), -- 'pricing', 'demand', 'supply', 'market_size', 'cagr'
  product_type VARCHAR(100),
  
  -- Current State (Base Year)
  base_year INT,
  base_year_value DECIMAL(15, 2),
  base_year_metric VARCHAR(100), -- 'USD/MT', 'Million MT', 'Million USD', '%', etc.
  
  -- Forecast Values
  year_1_forecast DECIMAL(15, 2),
  year_2_forecast DECIMAL(15, 2),
  year_3_forecast DECIMAL(15, 2),
  year_5_forecast DECIMAL(15, 2),
  year_10_forecast DECIMAL(15, 2),
  
  cagr_percentage DECIMAL(5, 2), -- Compound Annual Growth Rate
  
  -- Source & Confidence
  data_source VARCHAR(255), -- 'Philippine Coconut Industry Roadmap 2021-2040', etc.
  confidence_level VARCHAR(20), -- 'high', 'medium', 'low'
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_market_forecasts_project ON market_forecasts(project_id);
CREATE INDEX idx_market_forecasts_type ON market_forecasts(forecast_type);

-- ============================================================================
-- PROJECT MILESTONES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_milestones (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_name VARCHAR(255) NOT NULL,
  milestone_type VARCHAR(50), -- 'funding', 'procurement', 'installation', 'production', 'quality', 'market', 'regulatory'
  
  -- Timeline
  planned_date DATE NOT NULL,
  actual_date DATE,
  status VARCHAR(30) DEFAULT 'planned', -- 'planned', 'in_progress', 'completed', 'delayed', 'at_risk'
  
  -- Dependencies
  dependent_on_milestone_id BIGINT REFERENCES project_milestones(id) ON DELETE SET NULL,
  
  -- Details
  description TEXT,
  deliverables TEXT,
  responsible_party VARCHAR(255),
  estimated_cost_usd DECIMAL(12, 2),
  
  -- Progress Tracking
  progress_percentage INT DEFAULT 0,
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_project_milestones_project ON project_milestones(project_id);
CREATE INDEX idx_project_milestones_status ON project_milestones(status);

-- ============================================================================
-- SUPPLY CHAIN MANAGEMENT TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS supply_chain_management (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  supplier_id BIGINT REFERENCES project_suppliers(id) ON DELETE SET NULL,
  
  raw_material_name VARCHAR(255) NOT NULL,
  material_type VARCHAR(50), -- 'coconuts', 'chemicals', 'packaging', 'utilities'
  
  -- Supply Details
  annual_requirement DECIMAL(12, 2),
  requirement_unit VARCHAR(50), -- 'kg', 'T', 'L', 'units'
  unit_cost DECIMAL(12, 2),
  source_location VARCHAR(255),
  
  -- Sourcing Strategy
  sourcing_strategy VARCHAR(100), -- 'direct_contract', 'spot_market', 'auction', 'farmer_cooperative'
  contract_terms TEXT,
  
  -- Quality & Standards
  quality_grade VARCHAR(100),
  certifications_required TEXT, -- JSON or comma-separated
  
  -- Risk Management
  backup_supplier_id BIGINT REFERENCES project_suppliers(id) ON DELETE SET NULL,
  supply_risk_level VARCHAR(20), -- 'low', 'medium', 'high'
  supply_buffer_months DECIMAL(4, 2), -- months of safety stock
  
  -- Timeline
  sourcing_start_date DATE,
  contract_start_date DATE,
  contract_end_date DATE,
  
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_supply_chain_project ON supply_chain_management(project_id);
CREATE INDEX idx_supply_chain_supplier ON supply_chain_management(supplier_id);

-- ============================================================================
-- RISK ASSESSMENT TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS risk_assessment (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  risk_category VARCHAR(100), -- 'supply', 'demand', 'price', 'climate', 'market', 'operational', 'financial', 'regulatory', 'technical'
  risk_description TEXT NOT NULL,
  
  -- Risk Metrics
  probability_percentage INT, -- 0-100
  impact_severity VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
  risk_score INT GENERATED ALWAYS AS (
    CASE 
      WHEN probability_percentage IS NOT NULL THEN 
        CASE 
          WHEN impact_severity = 'critical' THEN (probability_percentage * 4 / 100)
          WHEN impact_severity = 'high' THEN (probability_percentage * 3 / 100)
          WHEN impact_severity = 'medium' THEN (probability_percentage * 2 / 100)
          ELSE (probability_percentage / 100)
        END
      ELSE NULL
    END
  ) STORED,
  
  -- Mitigation
  mitigation_strategy TEXT,
  mitigation_cost_usd DECIMAL(12, 2),
  responsible_party VARCHAR(255),
  
  -- Status
  status VARCHAR(30) DEFAULT 'identified', -- 'identified', 'mitigating', 'mitigated', 'accepted'
  
  -- Notes
  example_impact_scenario TEXT,
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_risk_assessment_project ON risk_assessment(project_id);
CREATE INDEX idx_risk_assessment_category ON risk_assessment(risk_category);
CREATE INDEX idx_risk_assessment_severity ON risk_assessment(impact_severity);

-- ============================================================================
-- QUALITY & COMPLIANCE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS quality_compliance (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  compliance_type VARCHAR(100), -- 'certification', 'standard', 'regulation', 'quality', 'safety', 'environmental', 'export'
  certification_name VARCHAR(255) NOT NULL,
  issuing_body VARCHAR(255), -- 'ISO', 'FDA', 'PCA', 'BPI', etc.
  
  -- Details
  requirement_description TEXT,
  current_status VARCHAR(50) DEFAULT 'not_started', -- 'not_started', 'in_progress', 'achieved', 'maintained'
  
  -- Timeline & Cost
  required_by_date DATE,
  estimated_completion_date DATE,
  estimated_cost_usd DECIMAL(12, 2),
  
  -- Documentation
  documentation_required TEXT,
  testing_requirements TEXT,
  
  -- Responsible Party
  responsible_party VARCHAR(255),
  external_consultant_name VARCHAR(255),
  
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quality_compliance_project ON quality_compliance(project_id);
CREATE INDEX idx_quality_compliance_type ON quality_compliance(compliance_type);

-- ============================================================================
-- FINANCIAL METRICS & KPI TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS financial_metrics (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  metric_name VARCHAR(100) NOT NULL, -- 'breakeven_analysis', 'roi', 'npv', 'irr', 'payback_period', 'capex', 'opex'
  metric_type VARCHAR(50), -- 'cost', 'return', 'ratio', 'timeline', 'forecast'
  
  -- Values
  base_case_value DECIMAL(15, 2),
  conservative_case_value DECIMAL(15, 2),
  optimistic_case_value DECIMAL(15, 2),
  
  -- Metadata
  unit_of_measure VARCHAR(50), -- 'USD', '%', 'years', 'MT', etc.
  calculation_method TEXT,
  assumptions TEXT, -- key assumptions used
  
  -- Timeline
  calculated_as_of_date DATE,
  target_achievement_date DATE,
  
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, metric_name)
);

CREATE INDEX idx_financial_metrics_project ON financial_metrics(project_id);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================
ALTER TABLE project_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_cost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_chain_management ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_assessment ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_metrics ENABLE ROW LEVEL SECURITY;

-- Enable read access for public project data (investors need to see project details)
CREATE POLICY "Allow read access to project suppliers" ON project_suppliers
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to project equipment" ON project_equipment
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to project costs" ON project_costs
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to production capacity" ON production_capacity
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to revenue projections" ON revenue_projections
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to market forecasts" ON market_forecasts
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to project milestones" ON project_milestones
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to supply chain" ON supply_chain_management
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to risk assessment" ON risk_assessment
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to quality compliance" ON quality_compliance
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to financial metrics" ON financial_metrics
  FOR SELECT USING (true);

-- ============================================================================
-- HELPER FUNCTION: Calculate Total Project Cost
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_project_total_cost(p_project_id BIGINT)
RETURNS DECIMAL AS $$
DECLARE
  v_total DECIMAL;
BEGIN
  SELECT COALESCE(SUM(budgeted_amount_usd), 0)
  INTO v_total
  FROM project_costs
  WHERE project_id = p_project_id;
  
  RETURN v_total;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- HELPER FUNCTION: Calculate ROI
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_project_roi(
  p_project_id BIGINT,
  p_scenario VARCHAR DEFAULT 'base_case'
)
RETURNS TABLE (
  total_investment_usd DECIMAL,
  total_revenue_5yr_usd DECIMAL,
  roi_percentage DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH investment AS (
    SELECT COALESCE(SUM(budgeted_amount_usd), 0) as total
    FROM project_costs
    WHERE project_id = p_project_id
  ),
  revenue_5yr AS (
    SELECT COALESCE(SUM(projected_annual_revenue_usd), 0) as total
    FROM revenue_projections
    WHERE project_id = p_project_id
      AND year_number <= 5
      AND (p_scenario = 'base_case' OR scenario = p_scenario OR scenario IS NULL)
  )
  SELECT 
    i.total::DECIMAL,
    r.total::DECIMAL,
    CASE 
      WHEN i.total > 0 THEN ((r.total - i.total) / i.total * 100)::DECIMAL
      ELSE NULL::DECIMAL
    END as roi_percentage
  FROM investment i, revenue_5yr r;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER FUNCTION: Get Project Financial Summary
-- ============================================================================
CREATE OR REPLACE FUNCTION get_project_financial_summary(p_project_id BIGINT)
RETURNS TABLE (
  total_capex_usd DECIMAL,
  annual_opex_estimate_usd DECIMAL,
  annual_revenue_yr1_usd DECIMAL,
  breakeven_months INT
) AS $$
BEGIN
  RETURN QUERY
  WITH capex AS (
    SELECT COALESCE(SUM(budgeted_amount_usd), 0) as total
    FROM project_costs
    WHERE project_id = p_project_id
      AND cost_category IN ('equipment', 'installation', 'infrastructure', 'land')
  ),
  opex AS (
    SELECT COALESCE(SUM(budgeted_amount_usd), 0) as total
    FROM project_costs
    WHERE project_id = p_project_id
      AND cost_category IN ('labor', 'maintenance', 'utilities', 'permits')
  ),
  revenue_yr1 AS (
    SELECT COALESCE(SUM(projected_annual_revenue_usd), 0) as total
    FROM revenue_projections
    WHERE project_id = p_project_id
      AND year_number = 1
  )
  SELECT 
    c.total::DECIMAL,
    o.total::DECIMAL,
    r.total::DECIMAL,
    CASE 
      WHEN (r.total - o.total) > 0 THEN ((c.total / ((r.total - o.total) / 12))::INT)
      ELSE NULL::INT
    END as breakeven_months
  FROM capex c, opex o, revenue_yr1 r;
END;
$$ LANGUAGE plpgsql;
