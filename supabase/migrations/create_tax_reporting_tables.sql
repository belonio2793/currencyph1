-- Tax Payments Table
CREATE TABLE IF NOT EXISTS tax_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  reference_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for tax payments
CREATE INDEX idx_tax_payments_business_id ON tax_payments(business_id);
CREATE INDEX idx_tax_payments_payment_date ON tax_payments(payment_date);

-- Tax Reports Archive Table (optional - for storing generated reports)
CREATE TABLE IF NOT EXISTS tax_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  report_period VARCHAR(20) NOT NULL, -- 'annual', 'Q1', 'Q2', 'Q3', 'Q4', 'ytd'
  report_year INTEGER NOT NULL,
  total_sales DECIMAL(12, 2) DEFAULT 0,
  total_expenses DECIMAL(12, 2) DEFAULT 0,
  net_income DECIMAL(12, 2) DEFAULT 0,
  tax_liability DECIMAL(12, 2) DEFAULT 0,
  tax_paid DECIMAL(12, 2) DEFAULT 0,
  profit_margin DECIMAL(5, 2) DEFAULT 0,
  receipt_count INTEGER DEFAULT 0,
  expense_count INTEGER DEFAULT 0,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for tax reports
CREATE INDEX idx_tax_reports_business_id ON tax_reports(business_id);
CREATE INDEX idx_tax_reports_period ON tax_reports(report_year, report_period);

-- Modify miscellaneous_costs table to add expense category if not exists
ALTER TABLE miscellaneous_costs
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'other';

-- Grant permissions (adjust as needed for your Supabase setup)
GRANT ALL ON tax_payments TO authenticated;
GRANT ALL ON tax_reports TO authenticated;
GRANT ALL ON miscellaneous_costs TO authenticated;
