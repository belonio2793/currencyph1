-- Business Requests Table: Track job applications/requests from users to businesses
CREATE TABLE IF NOT EXISTS public.business_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  requesting_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Request Details
  occupation VARCHAR(255) NOT NULL,
  requested_salary DECIMAL(12, 2),
  salary_currency VARCHAR(10) DEFAULT 'PHP',
  
  -- Skills and Resume
  skills TEXT[] DEFAULT ARRAY[]::TEXT[],
  resume_text TEXT,
  resume_file_url VARCHAR(255),
  
  -- Additional Information
  message TEXT,
  availability_date DATE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'reviewed', 'accepted', 'rejected', 'withdrawn'
  
  -- Timeline
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_request_status CHECK (status IN ('pending', 'reviewed', 'accepted', 'rejected', 'withdrawn'))
);

CREATE INDEX IF NOT EXISTS idx_business_requests_business ON public.business_requests(business_id);
CREATE INDEX IF NOT EXISTS idx_business_requests_user ON public.business_requests(requesting_user_id);
CREATE INDEX IF NOT EXISTS idx_business_requests_status ON public.business_requests(status);
CREATE INDEX IF NOT EXISTS idx_business_requests_created_at ON public.business_requests(created_at DESC);

-- Request Responses Table: Track business owner responses to requests
CREATE TABLE IF NOT EXISTS public.business_request_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.business_requests(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  responding_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Response Details
  response_status VARCHAR(50) NOT NULL, -- 'offer_accepted', 'offer_rejected', 'needs_interview', 'hire_request'
  response_message TEXT,
  offered_salary DECIMAL(12, 2),
  offered_position VARCHAR(255),
  
  -- Timeline
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_response_status CHECK (response_status IN ('offer_accepted', 'offer_rejected', 'needs_interview', 'hire_request'))
);

CREATE INDEX IF NOT EXISTS idx_business_request_responses_request ON public.business_request_responses(request_id);
CREATE INDEX IF NOT EXISTS idx_business_request_responses_business ON public.business_request_responses(business_id);
CREATE INDEX IF NOT EXISTS idx_business_request_responses_status ON public.business_request_responses(response_status);

-- Enable Row Level Security
ALTER TABLE public.business_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_request_responses ENABLE ROW LEVEL SECURITY;

-- Business Requests RLS Policies
CREATE POLICY "Users can view their own requests" ON public.business_requests
  FOR SELECT USING (auth.uid() = requesting_user_id);

CREATE POLICY "Business owners can view requests for their businesses" ON public.business_requests
  FOR SELECT USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can submit requests" ON public.business_requests
  FOR INSERT WITH CHECK (auth.uid() = requesting_user_id);

CREATE POLICY "Users can withdraw their requests" ON public.business_requests
  FOR UPDATE USING (
    auth.uid() = requesting_user_id AND status IN ('pending', 'reviewed')
  );

CREATE POLICY "Business owners can update request status" ON public.business_requests
  FOR UPDATE USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
  );

-- Business Request Responses RLS Policies
CREATE POLICY "Users can view responses to their requests" ON public.business_request_responses
  FOR SELECT USING (
    request_id IN (
      SELECT id FROM public.business_requests WHERE requesting_user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can view responses from their businesses" ON public.business_request_responses
  FOR SELECT USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Business owners can respond to requests" ON public.business_request_responses
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    AND responding_user_id = auth.uid()
  );

CREATE POLICY "Business owners can update their responses" ON public.business_request_responses
  FOR UPDATE USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
  );
