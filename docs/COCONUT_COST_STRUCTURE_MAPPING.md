# Coconut Oil & Water Processing Plant - Cost Structure Mapping

## Overview
This document maps the detailed cost structure and business plan for the Coconut Oil & Water Processing Plant into the database schema.

## Data Mapping Summary

### 1. PROJECT METADATA (`projects` table)
- **Name**: Coconut Oil & Water Processing Plant
- **Description**: Sustainable facility for coconut oil & bottled coconut water - Fully integrated zero-waste processing plant
- **Type**: agriculture
- **Total Cost**: $280,000 USD (mid-range from $180k-$390k breakdown)
- **Status**: funding
- **Min Investment**: $1,000

---

## 2. CAPEX BREAKDOWN - Cost Categories (`project_costs` table)

| Category | Amount | % of Total | Description |
|----------|--------|-----------|-------------|
| Equipment Base | $94,130 | 33.6% | Original grinding, squeezing, filtration, UHT equipment |
| Husk/Coir Processing | $32,500 | 11.6% | Decorticator, peat screener, dryer, fiber baler |
| Coconut Water Line | $29,000 | 10.4% | Bottle sterilizer, rinser, capping, labeling machines |
| Oil Production | $22,500 | 8.0% | Centrifuge (VCO), oil press, refining pans |
| Cold Storage | $15,000 | 5.4% | 10-20 sqm cold room facility |
| Shell Charcoal Kiln | $5,500 | 2.0% | 1-3 ton/day kiln |
| Quality Laboratory | $5,250 | 1.9% | Lab equipment & testing tools |
| Construction & Infrastructure | $82,500 | 29.5% | Building, electrical, water treatment, office |
| Working Capital | $19,250 | 6.9% | Salaries, raw material, packaging |
| Contingency | $20,000 | 7.1% | Project reserve (3.1% budgeted) |
| **TOTAL** | **$280,000** | **100%** | |

### Cost Line Items (`project_cost_items` table)

**Husk/Coir Processing ($32,500)**
- Decorticator: $12,000
- Peat Screener: $6,500
- Dryer: $8,000
- Fiber Baler: $6,000

**Young Coconut Water Line ($29,000)**
- Bottle Sterilizer: $8,000
- Bottle Rinser: $6,500
- Capping Machine: $7,000
- Labeling Machine: $7,500

**Oil Production Equipment ($22,500)**
- Centrifuge (VCO): $10,000
- Oil Press Upgrades: $8,500
- Refining Pans: $4,000

**Cold Storage ($15,000)**
- 10-20 sqm Cold Room Setup: $15,000

**Shell Charcoal Kiln ($5,500)**
- 1-3 ton/day Kiln: $5,500

**Quality Laboratory ($5,250)**
- Basic Lab & Testing Equipment: $5,250

**Construction & Infrastructure ($82,500)**
- Processing Building (200-400 sqm): $82,500

**Working Capital ($19,250)**
- Initial Salaries (1-2 months for 15-22 workers): $9,000
- First Batch Coconut Purchases: $6,500
- Packaging Inventory: $3,750

---

## 3. PRODUCTION CAPACITY (`production_capacity` table)

### Daily Throughput
- **Raw Coconuts**: 7,500 nuts/day (75% utilization)
- Daily Output Breakdown (per 1,000 nuts processed):

| Product | Daily Output | Capacity Unit | Utilization |
|---------|--------------|---------------|------------|
| Coconut Water (Bottled) | 400 | L | 80% |
| Virgin Coconut Oil (VCO) | 80 | L | 85% |
| Coconut Milk/Cream | 180 | L | 80% |
| Coir Fiber | 120 | kg | 75% |
| Coco Peat | 250 | kg | 80% |
| Shell Charcoal | 150 | kg | 75% |
| Organic Fertilizer | 100 | kg | 70% |

### Annual Capacity
- Coconut Water: 144,000 L (Year 1)
- VCO: 28,800 L (Year 1)
- Coconut Milk: 64,800 L (Year 1)
- Coir Fiber: 43,200 kg (Year 1)
- Coco Peat: 90,000 kg (Year 1)
- Shell Charcoal: 54,000 kg (Year 1)
- Organic Fertilizer: 36,000 kg (Year 1)

---

## 4. REVENUE STREAMS (`revenue_projections` table)

### Year 1 (Conservative Scenario)
| Product | Volume | Unit | Price/Unit | Annual Revenue |
|---------|--------|------|-----------|-----------------|
| Coconut Water | 144,000 | L | $1.00 | $144,000 |
| VCO | 28,800 | L | $6.00 | $172,800 |
| Coconut Milk | 64,800 | L | $2.50 | $162,000 |
| Coir Fiber | 43,200 | kg | $0.30 | $12,960 |
| Coco Peat | 90,000 | kg | $0.40 | $36,000 |
| Shell Charcoal | 54,000 | kg | $0.60 | $32,400 |
| Organic Fertilizer | 36,000 | kg | $0.20 | $7,200 |
| **Total Year 1** | | | | **$567,360** |

### Daily Revenue (Average)
- Daily: ~$1,576
- Monthly (30 days): ~$47,000
- Annual: ~$564,000

### Growth Projections
- **Year 2** (Moderate): 15-20% growth + slight price increases
- **Year 3+** (Optimistic): 20-25% growth with premium pricing for export markets

---

## 5. OPERATING COSTS (`financial_metrics` table)

### Daily Operating Costs (Average)
| Item | Daily Cost | Annual Cost |
|------|-----------|------------|
| Raw Coconuts (10,000 @ $0.05-$0.07) | $500-$700 | $182,500-$255,500 |
| Labor (15-22 workers) | $200-$300 | $73,000-$109,500 |
| Electricity | $80-$150 | $29,200-$54,750 |
| Packaging | $50-$150 | $18,250-$54,750 |
| Fuel/Biomass | $0-$40 | $0-$14,600 |
| Maintenance | $20-$40 | $7,300-$14,600 |
| **Total Daily** | **$850-$1,300** | **$310,250-$503,700** |
| **Average** | **$1,115** | **$406,975** |

### Cost Scenarios (Financial Metrics)
- **Conservative Case**: $1,300/day = $473,500/year
- **Base Case**: $1,115/day = $406,975/year
- **Optimistic Case**: $850/day = $310,250/year

---

## 6. PROFITABILITY ANALYSIS (`financial_metrics` table)

### Profit Calculations
**Base Case:**
- Daily Revenue: $1,576
- Daily Costs: $1,115
- Daily Profit: **$461**
- Monthly Profit: **$11,000**
- Annual Profit: **$120,000** (Years 1-2)

**Conservative Case:**
- Daily Revenue: $1,276 (reduced by 19%)
- Daily Costs: $1,300
- Daily Profit: -$24 (Breakeven with slight loss)
- Annual Loss: ~$75,000

**Optimistic Case:**
- Daily Revenue: $1,876 (with premium pricing)
- Daily Costs: $850 (improved efficiency)
- Daily Profit: **$1,026**
- Monthly Profit: **$30,780**
- Annual Profit: **$150,000+**

### Key Financial Metrics
| Metric | Conservative | Base Case | Optimistic |
|--------|-------------|-----------|-----------|
| CAPEX | $390,000 | $280,000 | $180,000 |
| Daily Operating Cost | $1,300 | $1,115 | $850 |
| Daily Revenue | $1,276 | $1,576 | $1,876 |
| Daily Net Profit | -$24 | $461 | $1,026 |
| Annual Net Profit | -$75,000 | $120,000 | $150,000 |
| Monthly Net Profit | -$6,250 | $11,000 | $21,800 |
| Breakeven (months) | 36+ | 24 | 16 |
| ROI (years) | 3.0 | 2.3 | 1.5 |
| Payback Period | 3 years | 2.3 years | 1.5 years |

---

## 7. RISK ASSESSMENT (`risk_assessment` table)

### High Severity Risks
1. **Raw Material Supply** (60% probability)
   - Coconut shortage or price spikes
   - Mitigation: Farmer contracts, mini-farm, buy-back programs

2. **Regulatory Compliance** (40% probability)
   - FDA and export requirements
   - Mitigation: HACCP program, QA staff, lab testing

3. **Market Competition** (70% probability)
   - Large established competitors
   - Mitigation: Niche export markets, organic cert, branding

4. **Price Volatility** (75% probability)
   - Coconut oil/water market fluctuations
   - Mitigation: Multi-product model, by-products, OEM orders

### Medium Severity Risks
- Product shelf-life (50%)
- Equipment downtime (35%)
- Financing delays (45%)
- Logistics costs (55%)

---

## 8. PROJECT TIMELINE (`project_milestones` table)

| Phase | Duration | Notes |
|-------|----------|-------|
| Feasibility Study & Market Analysis | 3-5 weeks | Raw material supply, buyer mapping |
| Permits + Environmental Compliance | 4-8 weeks | LGU + DENR + FDA approvals |
| Factory Design & Engineering | 2-4 weeks | Layout, utilities, drainage |
| Equipment Procurement | 6-10 weeks | Supplier lead times |
| Factory Construction | 6-12 weeks | Parallel with equipment shipping |
| Installation & Commissioning | 2-3 weeks | Calibration, water testing |
| Trial Production | 2 weeks | Quality assurance |
| **Total Timeline** | **5-8 months** | From start to full operation |

---

## 9. ZERO-WASTE VALUE PROPOSITION

Every part of the coconut becomes a product:

| Coconut Component | Product | Use | Revenue Stream |
|------------------|---------|-----|-----------------|
| Liquid (Meat) | Coconut Milk | Food ingredient | $2.50/L |
| Water | Bottled Water | Beverage | $1.00/L |
| Oil | VCO/RBD Oil | Food, cosmetics | $6.00/L |
| Coir (Husk Fiber) | Fiber Products | Matting, rope, etc | $0.30/kg |
| Peat | Coco Peat | Soil amendment | $0.40/kg |
| Shell | Charcoal | Fuel, filtration | $0.60/kg |
| Pulp | Organic Fertilizer | Farming inputs | $0.20/kg |

---

## 10. DATABASE INSERTION ORDER

For proper foreign key resolution:
1. `projects` - Base project
2. `project_suppliers` - Equipment suppliers
3. `project_equipment` - Equipment items (FK to suppliers)
4. `project_costs` - Cost categories
5. `project_cost_items` - Cost line items (FK to costs)
6. `production_capacity` - Production phases
7. `revenue_projections` - Revenue streams
8. `financial_metrics` - KPIs and metrics
9. `project_milestones` - Timeline and milestones
10. `risk_assessment` - Risk register
11. `quality_compliance` - Certifications needed

---

## Scripts

### Enrichment Script
Run: `node scripts/enrich-coconut-project-details.js`

This script:
- Updates project total cost and description
- Adds all cost categories and line items
- Updates production capacity with detailed breakdown
- Adds comprehensive revenue projections
- Adds operating cost metrics
- Updates financial KPIs
- Adds risk assessment entries
- Creates project timeline/milestones

### Expected Output
```
✓ Updated project metadata
✓ Added 9 cost categories
✓ Added 32 cost line items
✓ Added 8 production capacity phases
✓ Added 21 revenue projections
✓ Added 11 operating cost metrics
✓ Updated 4 key financial metrics
✓ Added 8 risk assessments
✓ Added 8 timeline milestones
```

---

## Usage in Frontend

Data is accessed via:
- `projectEquipment` - All equipment with specs
- `projectCosts` - Cost summary by category
- `productionCapacity` - Product capacity details
- `revenueForecast` - Year-by-year revenue
- `financialMetrics` - ROI, breakeven, profit metrics
- `riskAssessment` - Risk register with mitigations
- `projectMilestones` - Timeline and phases

All data is displayed in detail tabs in the Investment Details modal.

---

## Notes

- All amounts in USD
- Dates calculated relative to today + offset months
- Utilization percentages represent realistic operational capacity
- Growth projections assume market stability
- Operating costs include all direct + indirect expenses
- ROI calculated as: (Annual Profit × 5 years - CAPEX) / CAPEX
- All costs include labor, utilities, raw materials, and overhead
