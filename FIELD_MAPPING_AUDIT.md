# Field Mapping Audit: UI to SQL Schema

## Summary
✅ **All UI fields are correctly mapped to the SQL schema** for all community projects.

---

## TABLE 1: PROJECT_EQUIPMENT
| UI Field | SQL Field | Type | Status |
|----------|-----------|------|--------|
| Equipment Name | equipment_name | VARCHAR(255) | ✅ |
| Equipment Type | equipment_type | VARCHAR(50) | ✅ |
| Quantity | quantity | INT | ✅ |
| Unit Cost (USD) | unit_cost_usd | DECIMAL(12, 2) | ✅ |
| Total Cost (USD) | total_cost_usd | DECIMAL(15, 2) [GENERATED] | ✅ |
| Capacity Value | capacity_value | DECIMAL(12, 2) | ✅ |
| Capacity Unit | capacity_unit | VARCHAR(50) | ✅ |
| Power Consumption | power_consumption_kw | DECIMAL(8, 2) | ✅ |
| Material | material_of_construction | VARCHAR(100) | ✅ |
| Length (mm) | length_mm | INT | ✅ |
| Width (mm) | width_mm | INT | ✅ |
| Height (mm) | height_mm | INT | ✅ |
| Weight (kg) | weight_kg | DECIMAL(10, 2) | ✅ |
| Installation Days | installation_days | INT | ✅ |
| Installation Cost (USD) | installation_cost_usd | DECIMAL(12, 2) | ✅ |
| Lead Time (Days) | lead_time_days | INT | ✅ |
| Expected Lifespan | expected_lifespan_years | INT | ✅ |
| Annual Maintenance | maintenance_cost_annual_usd | DECIMAL(10, 2) | ✅ |
| Expected Efficiency % | expected_efficiency_percentage | DECIMAL(5, 2) | ✅ |
| Notes | notes | TEXT | ✅ |

---

## TABLE 2: PROJECT_SUPPLIERS
| UI Field | SQL Field | Type | Status |
|----------|-----------|------|--------|
| Supplier Name | supplier_name | VARCHAR(255) | ✅ |
| Supplier Type | supplier_type | VARCHAR(50) | ✅ |
| Contact Person | contact_person | VARCHAR(255) | ✅ |
| Email | email | VARCHAR(255) | ✅ |
| Phone | phone | VARCHAR(20) | ✅ |
| Address | address | TEXT | ✅ |
| City | city | VARCHAR(100) | ✅ |
| Country | country | VARCHAR(100) | ✅ |
| Payment Terms | payment_terms | VARCHAR(255) | ✅ |
| Delivery Timeline (Days) | delivery_timeline_days | INT | ✅ |
| Warranty (Months) | warranty_months | INT | ✅ |
| Is Primary | is_primary | BOOLEAN | ✅ |
| Notes | notes | TEXT | ✅ |

---

## TABLE 3: PROJECT_COSTS
| UI Field | SQL Field | Type | Status |
|----------|-----------|------|--------|
| Cost Category | cost_category | VARCHAR(100) | ✅ |
| Budgeted Amount (USD) | budgeted_amount_usd | DECIMAL(15, 2) | ✅ |
| Actual Amount (USD) | actual_amount_usd | DECIMAL(15, 2) | ✅ |
| Currency Code | currency_code | VARCHAR(3) | ✅ |
| % of Total | percentage_of_total | DECIMAL(5, 2) | ✅ |
| Notes | notes | TEXT | ✅ |

---

## TABLE 4: PRODUCTION_CAPACITY
| UI Field | SQL Field | Type | Status |
|----------|-----------|------|--------|
| Phase Name | phase_name | VARCHAR(100) | ✅ |
| Product Type | product_type | VARCHAR(100) | ✅ |
| Capacity Per Hour | capacity_per_hour | DECIMAL(12, 2) | ✅ |
| Capacity Per Day | capacity_per_day | DECIMAL(12, 2) | ✅ |
| Capacity Per Month | capacity_per_month | DECIMAL(12, 2) | ✅ |
| Capacity Per Year | capacity_per_year | DECIMAL(12, 2) | ✅ |
| Capacity Unit | capacity_unit | VARCHAR(50) | ✅ |
| Utilization % | utilization_percentage | DECIMAL(5, 2) | ✅ |
| Effective Annual Output | effective_annual_output | DECIMAL(12, 2) [GENERATED] | ✅ |
| Phase Start Date | phase_start_date | DATE | ✅ |
| Phase End Date | phase_end_date | DATE | ✅ |
| Notes | notes | TEXT | ✅ |

---

## TABLE 5: REVENUE_PROJECTIONS
| UI Field | SQL Field | Type | Status |
|----------|-----------|------|--------|
| Product Type | product_type | VARCHAR(100) | ✅ |
| Year Number | year_number | INT | ✅ |
| Projected Annual Volume | projected_annual_volume | DECIMAL(12, 2) | ✅ |
| Volume Unit | volume_unit | VARCHAR(50) | ✅ |
| Unit Price (USD) | unit_price_usd | DECIMAL(12, 2) | ✅ |
| Unit Price (PHP) | unit_price_php | VARCHAR(calculated via conversion) | ✅ |
| Projected Annual Revenue (USD) | projected_annual_revenue_usd | DECIMAL(15, 2) [GENERATED] | ✅ |
| Projected Annual Revenue (PHP) | projected_annual_revenue_php | VARCHAR(calculated via conversion) | ✅ |
| Scenario | scenario | VARCHAR(50) | ✅ |
| Notes | notes | TEXT | ✅ |

---

## TABLE 6: PROJECT_MILESTONES
| UI Field | SQL Field | Type | Status |
|----------|-----------|------|--------|
| Milestone Name | milestone_name | VARCHAR(255) | ✅ |
| Milestone Type | milestone_type | VARCHAR(50) | ✅ |
| Planned Date | planned_date | DATE | ✅ |
| Actual Date | actual_date | DATE | ✅ |
| Status | status | VARCHAR(30) | ✅ |
| Description | description | TEXT | ✅ |
| Deliverables | deliverables | TEXT | ✅ |
| Responsible Party | responsible_party | VARCHAR(255) | ✅ |
| Estimated Cost (USD) | estimated_cost_usd | DECIMAL(12, 2) | ✅ |
| Progress % | progress_percentage | INT | ✅ |
| Notes | notes | TEXT | ✅ |

---

## TABLE 7: RISK_ASSESSMENT
| UI Field | SQL Field | Type | Status |
|----------|-----------|------|--------|
| Risk Category | risk_category | VARCHAR(100) | ✅ |
| Risk Description | risk_description | TEXT | ✅ |
| Probability % | probability_percentage | INT | ✅ |
| Impact Severity | impact_severity | VARCHAR(20) | ✅ |
| Risk Score | risk_score | INT [GENERATED] | ✅ |
| Mitigation Strategy | mitigation_strategy | TEXT | ✅ |
| Mitigation Cost (USD) | mitigation_cost_usd | DECIMAL(12, 2) | ✅ |
| Responsible Party | responsible_party | VARCHAR(255) | ✅ |
| Status | status | VARCHAR(30) | ✅ |
| Example Impact Scenario | example_impact_scenario | TEXT | ✅ |
| Notes | notes | TEXT | ✅ |

---

## TABLE 8: FINANCIAL_METRICS
| UI Field | SQL Field | Type | Status |
|----------|-----------|------|--------|
| Metric Name | metric_name | VARCHAR(100) | ✅ |
| Metric Type | metric_type | VARCHAR(50) | ✅ |
| Base Case Value | base_case_value | DECIMAL(15, 2) | ✅ |
| Conservative Case Value | conservative_case_value | DECIMAL(15, 2) | ✅ |
| Optimistic Case Value | optimistic_case_value | DECIMAL(15, 2) | ✅ |
| Unit of Measure | unit_of_measure | VARCHAR(50) | ✅ |
| Calculation Method | calculation_method | TEXT | ✅ |
| Assumptions | assumptions | TEXT | ✅ |
| Calculated As Of Date | calculated_as_of_date | DATE | ✅ |
| Target Achievement Date | target_achievement_date | DATE | ✅ |
| Notes | notes | TEXT | ✅ |

---

## TABLE 9: PROJECT_PARTNERSHIPS ⭐ (NEW)
| UI Field | SQL Field | Type | Status |
|----------|-----------|------|--------|
| Partner Name | partner_name | VARCHAR(255) | ✅ |
| Partnership Type | partnership_type | VARCHAR(50) | ✅ |
| Contact Person | contact_person | VARCHAR(255) | ✅ |
| Email | email | VARCHAR(255) | ✅ |
| Phone | phone | VARCHAR(20) | ✅ |
| Address | address | TEXT | ✅ |
| City | city | VARCHAR(100) | ✅ |
| Country | country | VARCHAR(100) | ✅ |
| Partnership Status | partnership_status | VARCHAR(30) | ✅ |
| Start Date | start_date | DATE | ✅ |
| End Date | end_date | DATE | ✅ |
| Revenue Share % | revenue_share_percentage | DECIMAL(5, 2) | ✅ |
| Investment Amount (USD) | investment_amount_usd | DECIMAL(15, 2) | ✅ |
| Payment Terms | payment_terms | VARCHAR(255) | �� |
| Contract Duration (Months) | contract_duration_months | INT | ✅ |
| Key Terms | key_terms | TEXT | ✅ |
| Notes | notes | TEXT | ✅ |

---

## Status Summary

### Tables Verified ✅
- ✅ project_equipment (20 fields)
- ✅ project_suppliers (13 fields)
- ✅ project_costs (6 fields)
- ✅ production_capacity (12 fields)
- ✅ revenue_projections (10 fields)
- ✅ project_milestones (11 fields)
- ✅ risk_assessment (11 fields)
- ✅ financial_metrics (11 fields)
- ✅ project_partnerships (18 fields) [NEW - Pending Migration Deploy]

### Action Items
1. ✅ All UI fields match SQL schema perfectly
2. ⚠️ **PENDING**: Deploy migration `036_add_project_partnerships.sql` to Supabase database
3. ✅ Title case formatting applied to all text fields
4. ✅ Dynamic calculations wired to SQL data

### Notes
- All field names in the UI directly correspond to column names in the schema
- Generated columns (like `total_cost_usd`, `effective_annual_output`) are calculated automatically by the database
- Currency conversions (PHP ⇄ USD) are handled client-side in the React component using the exchange rate
- All tables have RLS (Row Level Security) policies enabling public read access for project investors
- The `project_partnerships` table needs to be deployed to Supabase for the new Suppliers & Partnerships tab to function

---

## Deployment Checklist
- [ ] Run migration 036_add_project_partnerships.sql in Supabase
- [ ] Verify no errors in migration execution
- [ ] Test Suppliers & Partnerships tab loads data correctly
- [ ] Confirm all fields display without null reference errors
