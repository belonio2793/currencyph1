-- Create function to initialize wallets for all currencies when a new user is created
CREATE OR REPLACE FUNCTION public.initialize_user_wallets()
RETURNS TRIGGER AS $$
DECLARE
  currency_code TEXT;
  fiat_currencies TEXT[] := ARRAY['PHP', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'AUD', 'CAD', 'CHF', 'SEK', 'NZD', 'SGD', 'HKD', 'IDR', 'MYR', 'THB', 'VND', 'KRW', 'ZAR', 'BRL', 'MXN', 'NOK', 'DKK', 'AED'];
BEGIN
  -- Create fiat wallets for all supported currencies
  FOREACH currency_code IN ARRAY fiat_currencies
  LOOP
    INSERT INTO public.wallets_fiat (
      user_id,
      provider,
      provider_account_id,
      currency,
      balance,
      status,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      'internal',
      'internal-' || currency_code || '-' || NEW.id::TEXT,
      currency_code,
      0,
      'active',
      now(),
      now()
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_initialize_user_wallets ON auth.users;

-- Create trigger to call the function when a new user is created
CREATE TRIGGER trigger_initialize_user_wallets
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.initialize_user_wallets();

-- For existing users, populate their wallets if they don't have them
DO $$
DECLARE
  user_record RECORD;
  currency_code TEXT;
  fiat_currencies TEXT[] := ARRAY['PHP', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'AUD', 'CAD', 'CHF', 'SEK', 'NZD', 'SGD', 'HKD', 'IDR', 'MYR', 'THB', 'VND', 'KRW', 'ZAR', 'BRL', 'MXN', 'NOK', 'DKK', 'AED'];
BEGIN
  -- For each existing user
  FOR user_record IN SELECT id FROM auth.users LOOP
    -- Create wallets for all currencies if they don't exist
    FOREACH currency_code IN ARRAY fiat_currencies
    LOOP
      INSERT INTO public.wallets_fiat (
        user_id,
        provider,
        provider_account_id,
        currency,
        balance,
        status,
        created_at,
        updated_at
      ) VALUES (
        user_record.id,
        'internal',
        'internal-' || currency_code || '-' || user_record.id::TEXT,
        currency_code,
        0,
        'active',
        now(),
        now()
      ) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
