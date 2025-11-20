-- Migration: 037 - Fix RLS Policies for Mutations
-- Adds INSERT, UPDATE, DELETE policies for all project detail tables
-- These were missing from migration 032, causing write operations to fail

-- ============================================================================
-- PROJECT SUPPLIERS MUTATIONS
-- ============================================================================
CREATE POLICY "Allow insert project suppliers" ON project_suppliers
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update project suppliers" ON project_suppliers
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete project suppliers" ON project_suppliers
  FOR DELETE
  USING (true);

-- ============================================================================
-- PROJECT EQUIPMENT MUTATIONS
-- ============================================================================
CREATE POLICY "Allow insert project equipment" ON project_equipment
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update project equipment" ON project_equipment
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete project equipment" ON project_equipment
  FOR DELETE
  USING (true);

-- ============================================================================
-- PROJECT COSTS MUTATIONS
-- ============================================================================
CREATE POLICY "Allow insert project costs" ON project_costs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update project costs" ON project_costs
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete project costs" ON project_costs
  FOR DELETE
  USING (true);

-- ============================================================================
-- PROJECT COST ITEMS MUTATIONS
-- ============================================================================
CREATE POLICY "Allow insert project cost items" ON project_cost_items
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update project cost items" ON project_cost_items
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete project cost items" ON project_cost_items
  FOR DELETE
  USING (true);

-- ============================================================================
-- PRODUCTION CAPACITY MUTATIONS
-- ============================================================================
CREATE POLICY "Allow insert production capacity" ON production_capacity
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update production capacity" ON production_capacity
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete production capacity" ON production_capacity
  FOR DELETE
  USING (true);

-- ============================================================================
-- REVENUE PROJECTIONS MUTATIONS
-- ============================================================================
CREATE POLICY "Allow insert revenue projections" ON revenue_projections
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update revenue projections" ON revenue_projections
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete revenue projections" ON revenue_projections
  FOR DELETE
  USING (true);

-- ============================================================================
-- MARKET FORECASTS MUTATIONS
-- ============================================================================
CREATE POLICY "Allow insert market forecasts" ON market_forecasts
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update market forecasts" ON market_forecasts
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete market forecasts" ON market_forecasts
  FOR DELETE
  USING (true);

-- ============================================================================
-- PROJECT MILESTONES MUTATIONS
-- ============================================================================
CREATE POLICY "Allow insert project milestones" ON project_milestones
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update project milestones" ON project_milestones
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete project milestones" ON project_milestones
  FOR DELETE
  USING (true);

-- ============================================================================
-- SUPPLY CHAIN MANAGEMENT MUTATIONS
-- ============================================================================
CREATE POLICY "Allow insert supply chain" ON supply_chain_management
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update supply chain" ON supply_chain_management
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete supply chain" ON supply_chain_management
  FOR DELETE
  USING (true);

-- ============================================================================
-- RISK ASSESSMENT MUTATIONS
-- ============================================================================
CREATE POLICY "Allow insert risk assessment" ON risk_assessment
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update risk assessment" ON risk_assessment
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete risk assessment" ON risk_assessment
  FOR DELETE
  USING (true);

-- ============================================================================
-- QUALITY COMPLIANCE MUTATIONS
-- ============================================================================
CREATE POLICY "Allow insert quality compliance" ON quality_compliance
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update quality compliance" ON quality_compliance
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete quality compliance" ON quality_compliance
  FOR DELETE
  USING (true);

-- ============================================================================
-- FINANCIAL METRICS MUTATIONS
-- ============================================================================
CREATE POLICY "Allow insert financial metrics" ON financial_metrics
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update financial metrics" ON financial_metrics
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete financial metrics" ON financial_metrics
  FOR DELETE
  USING (true);
